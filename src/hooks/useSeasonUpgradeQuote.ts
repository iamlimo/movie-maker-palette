import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SeasonUpgradeQuote {
  eligibleSpend: number; // kobo
  upgradePrice: number; // kobo
  fullPrice: number; // kobo
  qualifies: boolean;
}

type RpcRow = Partial<{
  eligible_spend: unknown;
  upgrade_price: unknown;
  full_price: unknown;
  qualifies: unknown;
}>;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

const mapRpcToQuote = (row: unknown): SeasonUpgradeQuote | null => {
  if (!row || typeof row !== 'object') return null;

  const r = row as RpcRow;

  return {
    eligibleSpend: toNumber(r.eligible_spend),
    upgradePrice: toNumber(r.upgrade_price),
    fullPrice: toNumber(r.full_price),
    qualifies: toBoolean(r.qualifies),
  };
};

/**
 * Returns the smart-upgrade quote for a season:
 * sums episode rentals from the last 7 days, deducts from ₦1,200 (120000 kobo).
 *
 * Note: RPC returns snake_case keys:
 * [ { eligible_spend, upgrade_price, full_price, qualifies } ]
 */
export const useSeasonUpgradeQuote = (
  seasonId: string | null | undefined,
  enabled = true,
  refetchTrigger?: unknown,
) => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<SeasonUpgradeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const fetchQuote = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!user?.id || !seasonId || !enabled) {
      setQuote(null);
      setQuoteError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setQuoteError(null);

    try {
      const { data, error } = await supabase.rpc('calculate_season_upgrade_price', {
        p_user_id: user.id,
        p_season_id: seasonId,
      });

      if (error) throw error;

      // Expected: [{"eligible_spend":..., "upgrade_price":..., "full_price":..., "qualifies": true}]
      const row = Array.isArray(data) ? data[0] : data;
      const nextQuote = mapRpcToQuote(row);

      // Ignore stale responses
      if (requestId === requestIdRef.current) {
        setQuote(nextQuote);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        console.warn('[useSeasonUpgradeQuote] failed:', err);
        setQuote(null);
        setQuoteError('Unable to load upgrade quote');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id, seasonId, enabled]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote, refetchTrigger]);

  const refetch = useCallback(() => {
    fetchQuote();
  }, [fetchQuote]);

  return { quote, loading, quoteError, refetch };
};
