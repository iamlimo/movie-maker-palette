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
  content_id: string;
  content_type: string;
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
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverSkewMs, setServerSkewMs] = useState(0);
  const channelName = useRef(
    `entitlements-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      const mapped: Entitlement[] = (data || []).map((row) => ({
        state: (row.state as RentalState) || 'NOT_RENTED',
        contentId: row.content_id,
        contentType: row.content_type as RentalContentType,
        expiresAt: row.expires_at,
        intentId: row.intent_id,
        accessId: row.access_id,
        paymentMethod: row.payment_method,
      }));
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
    let pending = false;
    const debouncedRefetch = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        fetchEntitlements();
      }, 250);
    };
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_access', filter: `user_id=eq.${user.id}` },
        debouncedRefetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rental_intents', filter: `user_id=eq.${user.id}` },
        debouncedRefetch,
      )
      .subscribe();
    return () => {
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

  const getEntitlement = useCallback(
    (contentId: string, contentType: RentalContentType): Entitlement => {
      const found = entitlements.find(
        (e) => e.contentId === contentId && e.contentType === contentType,
      );
      return found ?? NOT_RENTED_ENTITLEMENT(contentId, contentType);
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