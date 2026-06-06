import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SeasonUpgradeQuote {
  eligibleSpend: number;   // kobo
  upgradePrice: number;    // kobo
  fullPrice: number;       // kobo
  qualifies: boolean;
}

/**
 * Returns the smart-upgrade quote for a season:
 * sums episode rentals from the last 7 days, deducts from ₦1,200 (120000 kobo).
 */
export const useSeasonUpgradeQuote = (
  seasonId: string | null | undefined,
  enabled = true,
) => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<SeasonUpgradeQuote | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuote = useCallback(async () => {
    if (!user?.id || !seasonId || !enabled) {
      setQuote(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('calculate_season_upgrade_price', {
        p_user_id: user.id,
        p_season_id: seasonId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setQuote({
          eligibleSpend: Number(row.eligible_spend ?? 0),
          upgradePrice: Number(row.upgrade_price ?? 0),
          fullPrice: Number(row.full_price ?? 0),
          qualifies: Boolean(row.qualifies),
        });
      } else {
        setQuote(null);
      }
    } catch (err) {
      console.warn('[useSeasonUpgradeQuote] failed:', err);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, seasonId, enabled]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return { quote, loading, refetch: fetchQuote };
};