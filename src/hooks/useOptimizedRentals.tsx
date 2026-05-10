import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';

export type RentalType = 'movie' | 'episode' | 'season';
export type PaymentMethod = 'wallet' | 'paystack';

export type RentalRecord = Tables<'rentals'>;

export interface RentalAccess {
  hasAccess: boolean;
  rental: RentalRecord | null;
  timeRemaining: {
    hours: number;
    minutes: number;
    formatted: string;
  } | null;
}

export const useOptimizedRentals = () => {
  const { user } = useAuth();
  const { canAfford, refreshWallet } = useWallet();
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const rentalsChannelNameRef = useRef(
    `rentals-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  // Fetch active rentals for user
  const fetchRentals = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'active'])
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

      if (error) throw error;
      setRentals(data || []);
    } catch (error) {
      console.error('Error fetching rentals:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user has access to specific content
  const checkAccess = useCallback((contentId: string, contentType: RentalType): RentalAccess => {
    const rental = rentals.find(
      (r) =>
        r.content_id === contentId &&
        r.content_type === contentType &&
        (r.status === 'completed' || r.status === 'active') &&
        new Date(r.expires_at) > new Date()
    );

    if (!rental) {
      return {
        hasAccess: false,
        rental: null,
        timeRemaining: null,
      };
    }

    const now = new Date().getTime();
    const expiresAt = new Date(rental.expires_at).getTime();
    const remaining = expiresAt - now;

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    let formatted = '';
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      formatted = `${days}d ${hours % 24}h remaining`;
    } else if (hours > 0) {
      formatted = `${hours}h ${minutes}m remaining`;
    } else {
      formatted = `${minutes}m remaining`;
    }

    return {
      hasAccess: true,
      rental,
      timeRemaining: { hours, minutes, formatted },
    };
  }, [rentals]);

  // Check if season purchase unlocks all episodes
  const checkSeasonAccess = useCallback((seasonId: string): boolean => {
    return rentals.some(
      (r) =>
        r.content_id === seasonId &&
        r.content_type === 'season' &&
        (r.status === 'completed' || r.status === 'active') &&
        new Date(r.expires_at) > new Date()
    );
  }, [rentals]);

  // Process rental payment
  const processRental = useCallback(
    async (
      contentId: string,
      contentType: RentalType,
      price: number,
      paymentMethod: PaymentMethod,
      referralCode?: string
    ): Promise<{
      success: boolean;
      rentalId?: string;
      authorizationUrl?: string;
      error?: string;
    }> => {
      if (!user) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      try {
        // Validate payment method
        if (paymentMethod === 'wallet') {
          if (!canAfford(price)) {
            return {
              success: false,
              error: 'Insufficient wallet balance',
            };
          }
        }

        // Call cloud function to process rental
        const { data, error } = await supabase.functions.invoke('process-rental', {
          body: {
            userId: user.id,
            contentId,
            contentType,
            price,
            paymentMethod,
            referralCode,
          },
        });

        if (error) {
          return {
            success: false,
            error: error.message || 'Payment processing failed',
          };
        }

        if (paymentMethod === 'wallet') {
          // Wallet payment successful
          await fetchRentals();
          await refreshWallet();
          return {
            success: true,
            rentalId: data.rentalId,
          };
        } else if (paymentMethod === 'paystack') {
          // Return authorization URL for Paystack
          return {
            success: true,
            rentalId: data.rentalId,
            authorizationUrl: data.authorizationUrl,
          };
        }

        return {
          success: false,
          error: 'Unknown payment method',
        };
      } catch (error: unknown) {
        console.error('Rental processing error:', error);
        const rentalError = error as { message?: string };
        return {
          success: false,
          error: rentalError.message || 'Failed to process rental',
        };
      }
    },
    [user, canAfford, fetchRentals, refreshWallet]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(rentalsChannelNameRef.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rentals',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchRentals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRentals]);

  // Initial fetch
  useEffect(() => {
    fetchRentals();
  }, [fetchRentals]);

  return {
    rentals,
    loading,
    fetchRentals,
    checkAccess,
    checkSeasonAccess,
    processRental,
  };
};
