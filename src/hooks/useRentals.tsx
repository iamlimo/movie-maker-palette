import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Rental {
  id: string;
  user_id: string;
  content_id: string;
  content_type: string;
  amount: number;
  status: string;
  expires_at: string;
  created_at: string;
}

interface EntitlementRentalRow {
  user_id: string | null;
  content_id: string | null;
  content_type: string | null;
  state: string | null;
  expires_at: string | null;
  access_id: string | null;
  intent_id: string | null;
  access_created_at: string | null;
  intent_created_at: string | null;
}

export interface RentalAccess {
  has_access: boolean;
  access_type: 'rental' | 'purchase' | null;
  rental: Rental | null;
  purchase: any | null;
  expires_at: string | null;
}

export const useRentals = () => {
  const { user } = useAuth();
  const [activeRentals, setActiveRentals] = useState<Rental[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alertedRentals, setAlertedRentals] = useState<Set<string>>(new Set());
  const rentalsChannelNameRef = useRef(
    `rental-updates-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const fetchActiveRentals = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }> })
        .rpc('expire_canonical_rental_access', { p_skew_minutes: 0 })
        .catch((error) => console.warn('[useRentals] expire cleanup failed', error));

      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                gt: (k: string, v: string) => {
                  order: (k: string, opts: { ascending: boolean }) => Promise<{ data: EntitlementRentalRow[] | null; error: Error | null }>;
                };
              };
            };
          };
        };
      })
        .from('v_user_entitlements')
        .select('*')
        .eq('user_id', user.id)
        .eq('state', 'ACTIVE')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

      if (error) throw error;
      const normalizedRentals: Rental[] = (data || [])
        .filter((rental) => rental.user_id && rental.content_id && rental.content_type && rental.expires_at)
        .map((rental) => ({
          id: rental.access_id || rental.intent_id || rental.content_id!,
          user_id: rental.user_id!,
          content_id: rental.content_id!,
          content_type: rental.content_type!,
          amount: 0,
          status: 'active',
          expires_at: rental.expires_at!,
          created_at: rental.access_created_at || rental.intent_created_at || rental.expires_at!,
        })
      );
      console.log('[useRentals] Loaded canonical active rentals', {
        count: normalizedRentals.length,
        user_id: user.id,
      });
      setActiveRentals(normalizedRentals);
    } catch (error) {
      console.error('Error fetching rentals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const checkAccess = useCallback((contentId: string, contentType: string): boolean => {
    return activeRentals.some(rental => 
      rental.content_id === contentId && 
      rental.content_type === contentType &&
      (rental.status === 'active' || rental.status === 'completed') &&
      new Date(rental.expires_at) > new Date()
    );
  }, [activeRentals]);

  const getTimeRemaining = useCallback((expirationDate: string) => {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes, total: diff };
  }, []);

  const formatTimeRemaining = useCallback((expirationDate: string) => {
    const remaining = getTimeRemaining(expirationDate);
    if (!remaining) return 'Expired';
    
    if (remaining.hours > 0) {
      return `${remaining.hours}h ${remaining.minutes}m left`;
    }
    return `${remaining.minutes}m left`;
  }, [getTimeRemaining]);

  useEffect(() => {
    fetchActiveRentals();
  }, [fetchActiveRentals]);

  // Real-time subscription for rental updates
  useEffect(() => {
    if (!user) return;

    let refetchTimer: number | null = null;
    const scheduleRefetch = (source: string) => {
      console.log('[useRentals] rental source changed', { source });
      if (refetchTimer) window.clearTimeout(refetchTimer);
      refetchTimer = window.setTimeout(() => {
        refetchTimer = null;
        fetchActiveRentals();
      }, 150);
    };

    const channel = supabase
      .channel(rentalsChannelNameRef.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_access',
          filter: `user_id=eq.${user.id}`
        },
        () => scheduleRefetch('rental_access')
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_intents',
          filter: `user_id=eq.${user.id}`
        },
        () => scheduleRefetch('rental_intents')
      )
      .subscribe();

    return () => {
      if (refetchTimer) window.clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchActiveRentals]);

  // Expiry alerts
  useEffect(() => {
    if (!activeRentals.length) return;

    const checkExpiringRentals = () => {
      const now = new Date().getTime();
      const tenMinutes = 10 * 60 * 1000;

      activeRentals.forEach(rental => {
        const expiresAt = new Date(rental.expires_at).getTime();
        const timeLeft = expiresAt - now;

        if (timeLeft > 0 && timeLeft <= tenMinutes && !alertedRentals.has(rental.id)) {
          toast({
            title: "Rental Expires Soon",
            description: "Your rental expires in less than 10 minutes. Watch now to avoid interruption.",
            variant: "destructive",
          });
          setAlertedRentals(prev => new Set([...prev, rental.id]));
        }
      });
    };

    checkExpiringRentals();
    const interval = setInterval(checkExpiringRentals, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeRentals, alertedRentals, toast]);

  return {
    activeRentals,
    isLoading,
    fetchActiveRentals,
    fetchRentals: fetchActiveRentals,
    checkAccess,
    getTimeRemaining,
    formatTimeRemaining,
    refreshRentals: fetchActiveRentals
  };
};
