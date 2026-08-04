import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Entitlement,
  NOT_RENTED_ENTITLEMENT,
  RentalContentType,
  RentalState,
} from '@/lib/rentalStates';

interface EntitlementRow {
  user_id: string;
  content_id: string | null;
  content_type: string | null;
  state: string;
  expires_at: string | null;
  intent_id: string | null;
  access_id: string | null;
  payment_method: string | null;
}

/**
 * Single source of truth for rental entitlements.
 * Reads the `v_user_entitlements` view, subscribes to rental_access + rental_intents
 * realtime channels, and exposes a deterministic state-machine lookup.
 */
export function useEntitlements() {
const normalizeType = (t: string): RentalContentType => {
  const v = t.toLowerCase();
  if (v.includes('movie')) return 'movie';
  if (v.includes('episode')) return 'episode';
  if (v.includes('season')) return 'season';
  return v as RentalContentType;
};

  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverSkewMs, setServerSkewMs] = useState(0);
  const channelName = useRef(
    `entitlements-${Math.random().toString(36).slice(2, 8)}`,
  );
  // Fallback reconciliation bookkeeping: how many times we've asked
  // `verify-payment` to reconcile a given pending intent, and whether a
  // reconcile call is currently in flight (avoids duplicate invocations).
  const reconcileAttempts = useRef<Record<string, number>>({});
  const reconcileInFlight = useRef<Set<string>>(new Set());
  // Intents we've already alerted staff about (budget exhausted), so a single
  // stuck intent doesn't emit an alert on every poll tick.
  const budgetAlerted = useRef<Set<string>>(new Set());

  const RECONCILE_BUDGET = 8;

  /**
   * Alerting: when the fallback reconciliation loop burns its whole attempt
   * budget, record a payment alert (with the intent reference) so staff see it
   * on the admin dashboard instead of the failure being invisible.
   */
  const logReconciliationAlert = useCallback(
    async (
      e: Entitlement,
      reason: 'reconciliation_budget_exhausted' | 'reconciliation_error',
      message: string,
    ) => {
      if (!user || !e.intentId) return;
      const key = `${reason}:${e.intentId}`;
      if (budgetAlerted.current.has(key)) return;
      budgetAlerted.current.add(key);
      console.error('[useEntitlements] payment alert', { reason, intentId: e.intentId, message });
      try {
        await (supabase as unknown as {
          from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> };
        })
          .from('payment_alerts')
          .insert({
            source: 'reconciliation',
            severity: reason === 'reconciliation_budget_exhausted' ? 'critical' : 'error',
            reason,
            message,
            user_id: user.id,
            rental_intent_id: e.intentId,
            attempts: reconcileAttempts.current[e.intentId] ?? null,
            detail: {
              content_id: e.contentId,
              content_type: e.contentType,
              state: e.state,
              payment_method: e.paymentMethod,
              expires_at: e.expiresAt,
            },
          });
      } catch (err) {
        console.warn('[useEntitlements] failed to record payment alert', err);
      }
    },
    [user],
  );

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setEntitlements([]);
      return;
    }
    setLoading(true);
    try {
      // View isn't in generated types yet — cast through unknown.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => Promise<{ data: EntitlementRow[] | null; error: Error | null }>;
          };
        };
      })
        .from('v_user_entitlements')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      const mapped: Entitlement[] = (data || [])
        .filter((row) => row.content_id && row.content_type)
        .map((row) => ({
          state: (row.state as RentalState) || 'NOT_RENTED',
          contentId: row.content_id!,
          contentType: normalizeType(row.content_type!),
          expiresAt: row.expires_at,
          intentId: row.intent_id,
          accessId: row.access_id,
          paymentMethod: row.payment_method,
        }));
      
      // Debug logging for payment verification states
      const verifyingEntitlements = mapped.filter(e => e.state === 'PAYMENT_VERIFICATION' || e.state === 'PAYMENT_PENDING');
      if (verifyingEntitlements.length > 0) {
        console.log('[useEntitlements] ⏳ Payment verification states found:', {
          count: verifyingEntitlements.length,
          items: verifyingEntitlements.map(e => ({
            contentId: e.contentId,
            contentType: e.contentType,
            state: e.state,
            paymentMethod: e.paymentMethod,
            intentId: e.intentId,
          })),
        });
      }
      
      setEntitlements(mapped);
    } catch (err) {
      console.error('[useEntitlements] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Server-time skew correction (used by countdowns).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t0 = Date.now();
        const { data } = await supabase.rpc('get_current_user_profile');
        const t1 = Date.now();
        // We don't get server time directly; approximate skew from response Date header.
        // Fallback: 0 (acceptable — backend is still source of truth on access).
        if (!cancelled && data) {
          setServerSkewMs(Math.floor((t1 - t0) / 2));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  // Realtime: refetch on any change to user's intents or access rows.
  useEffect(() => {
    if (!user) return;
    let refetchTimer: number | null = null;
    const scheduleRefetch = (source: string) => {
      console.log('[useEntitlements] entitlement change observed', { source });
      if (refetchTimer) window.clearTimeout(refetchTimer);
      refetchTimer = window.setTimeout(() => {
        refetchTimer = null;
        fetchEntitlements();
      }, 150);
    };
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_access', filter: `user_id=eq.${user.id}` },
        () => scheduleRefetch('rental_access'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_intents', filter: `user_id=eq.${user.id}` },
        () => scheduleRefetch('rental_intents'),
      )
      .subscribe();
    return () => {
      if (refetchTimer) window.clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchEntitlements]);

  // Auto-refresh when an ACTIVE entitlement crosses its expiry.
  useEffect(() => {
    if (!entitlements.length) return;
    const next = entitlements
      .filter((e) => e.state === 'ACTIVE' && e.expiresAt)
      .map((e) => new Date(e.expiresAt!).getTime() - Date.now())
      .filter((ms) => ms > 0)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const t = setTimeout(fetchEntitlements, Math.min(next + 2000, 60 * 60 * 1000));
    return () => clearTimeout(t);
  }, [entitlements, fetchEntitlements]);

  // Refetch on tab focus / visibility so stale PAYMENT_VERIFICATION states
  // clear as soon as the user returns to the app or refreshes the page.
  useEffect(() => {
    if (!user) return;
    const onFocus = () => fetchEntitlements();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchEntitlements();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, fetchEntitlements]);

  /**
   * Fallback for missed/delayed Paystack webhooks.
   *
   * `verify-payment` re-verifies the reference straight against the Paystack API
   * and grants entitlement itself, so it is a complete substitute for the
   * webhook. Ask it to reconcile every pending intent (bounded attempts) so a
   * webhook that never arrives can't leave a paid user without access.
   */
  const reconcilePendingIntents = useCallback(
    async (pending: Entitlement[]) => {
      const targets = pending.filter((e) => e.intentId);
      if (!targets.length) return;

      await Promise.all(
        targets.map(async (e) => {
          const intentId = e.intentId!;
          if (reconcileInFlight.current.has(intentId)) return;
          const attempts = reconcileAttempts.current[intentId] ?? 0;
          if (attempts >= RECONCILE_BUDGET) {
            await logReconciliationAlert(
              e,
              'reconciliation_budget_exhausted',
              `Payment reconciliation gave up after ${attempts} attempts — intent ${intentId} is still ${e.state}. Webhook likely never arrived.`,
            );
            return;
          }

          reconcileInFlight.current.add(intentId);
          reconcileAttempts.current[intentId] = attempts + 1;
          try {
            const { error } = await supabase.functions.invoke('verify-payment', {
              body: { rentalId: intentId, rental_intent_id: intentId },
            });
            if (error) {
              console.warn('[useEntitlements] reconcile failed', intentId, error.message);
              if (reconcileAttempts.current[intentId] >= RECONCILE_BUDGET) {
                await logReconciliationAlert(
                  e,
                  'reconciliation_error',
                  `verify-payment kept failing for intent ${intentId}: ${error.message}`,
                );
              }
            }
          } catch (err) {
            console.warn('[useEntitlements] reconcile threw', intentId, err);
            if ((reconcileAttempts.current[intentId] ?? 0) >= RECONCILE_BUDGET) {
              await logReconciliationAlert(
                e,
                'reconciliation_error',
                `verify-payment threw for intent ${intentId}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          } finally {
            reconcileInFlight.current.delete(intentId);
          }
        }),
      );

      await fetchEntitlements();
    },
    [fetchEntitlements, logReconciliationAlert],
  );

  // While any payment is still pending, poll lightly and reconcile through
  // `verify-payment` so webhook delays or missed Realtime messages cannot leave
  // the UI stuck indefinitely.
  useEffect(() => {
    if (!user) return;
    const pending = entitlements.filter(
      (e) => e.state === 'PAYMENT_PENDING' || e.state === 'PAYMENT_VERIFICATION',
    );
    if (!pending.length) return;

    // Immediate reconcile pass, then backoff polling while still pending.
    reconcilePendingIntents(pending);
    const interval = window.setInterval(() => {
      reconcilePendingIntents(pending);
    }, 8_000);
    return () => window.clearInterval(interval);
  }, [user, entitlements, reconcilePendingIntents]);

  // Reset attempt counters once nothing is pending, so a later rental for the
  // same content starts with a fresh budget.
  useEffect(() => {
    const stillPending = new Set(
      entitlements
        .filter((e) => e.state === 'PAYMENT_PENDING' || e.state === 'PAYMENT_VERIFICATION')
        .map((e) => e.intentId)
        .filter(Boolean) as string[],
    );
    Object.keys(reconcileAttempts.current).forEach((id) => {
      if (!stillPending.has(id)) delete reconcileAttempts.current[id];
    });
    budgetAlerted.current.forEach((key) => {
      const id = key.split(':').slice(1).join(':');
      if (!stillPending.has(id)) budgetAlerted.current.delete(key);
    });
  }, [entitlements]);

  const getEntitlement = useCallback(
    (contentId: string, contentType: RentalContentType): Entitlement => {
      const statePriority: Record<RentalState, number> = {
        ACTIVE: 0,
        EXPIRED: 1,
        FAILED: 2,
        REFUNDED: 3,
        REVOKED: 4,
        PAYMENT_VERIFICATION: 5,
        PAYMENT_PENDING: 6,
        NOT_RENTED: 7,
      };

      const found = entitlements
        .filter((e) => e.contentId === contentId && e.contentType === contentType)
        .sort((a, b) => statePriority[a.state] - statePriority[b.state])[0];

      if (!found) return NOT_RENTED_ENTITLEMENT(contentId, contentType);

      // Auto-clear stuck verification states: if the intent's own
      // expires_at is in the past, treat as NOT_RENTED so the user can
      // rent again instead of being blocked by a "Verifying…" button.
      if (found.state === 'ACTIVE' && found.expiresAt && new Date(found.expiresAt).getTime() <= Date.now()) {
        return { ...found, state: 'EXPIRED' };
      }

      const intentAgeMs = found.expiresAt ? Date.now() - new Date(found.expiresAt).getTime() : 0;
      if (
        (found.state === 'PAYMENT_PENDING' || found.state === 'PAYMENT_VERIFICATION') &&
        found.expiresAt &&
        (new Date(found.expiresAt).getTime() <= Date.now() || intentAgeMs > 0)
      ) {
        return NOT_RENTED_ENTITLEMENT(contentId, contentType);
      }

      return found;
    },
    [entitlements],
  );

  const checkAccess = useCallback(
    (contentId: string, contentType: RentalContentType) =>
      getEntitlement(contentId, contentType).state === 'ACTIVE',
    [getEntitlement],
  );

  const activeEntitlements = useMemo(
    () => entitlements.filter((e) => e.state === 'ACTIVE'),
    [entitlements],
  );

  return {
    entitlements,
    activeEntitlements,
    loading,
    serverSkewMs,
    getEntitlement,
    checkAccess,
    refresh: fetchEntitlements,
  };
}
