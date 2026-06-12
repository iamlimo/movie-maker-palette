import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';

export type RentalType = 'movie' | 'episode' | 'season';
export type PaymentMethod = 'wallet' | 'paystack';

// Source of truth: rental_intents + rental_access unified view
export interface RentalEntitlement {
  user_id: string;
  content_id: string;
  content_type: string;
  access_id: string | null;
  intent_id: string | null;
  expires_at: string | null;
  payment_method: string | null;
  intent_status: string | null;
  access_status: string | null;
  revoked_at: string | null;
  state: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'PAYMENT_PENDING' | 'PAYMENT_VERIFICATION' | 'FAILED' | 'NOT_RENTED';
}

export interface RentalAccess {
  hasAccess: boolean;
  entitlement: RentalEntitlement | null;
  timeRemaining: {
    hours: number;
    minutes: number;
    formatted: string;
  } | null;
}

export const useOptimizedRentals = () => {
  const { user } = useAuth();
  const { canAfford, refreshWallet } = useWallet();
  const [entitlements, setEntitlements] = useState<RentalEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const entitlementsChannelNameRef = useRef(
    `entitlements-${Math.random().toString(36).slice(2, 10)}`
  );

  const intentsChannelNameRef = useRef<string | null>(null);
  useEffect(() => {
    if (user && !intentsChannelNameRef.current) {
      intentsChannelNameRef.current = `intents-${user.id}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [user]);

  // Fetch all entitlements from unified v_user_entitlements view
  // This is the single source of truth: union of rental_intents + rental_access
  const fetchEntitlements = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_user_entitlements')
        .select('*')
        .eq('user_id', user.id)
        .order('expires_at', { ascending: true });

      if (error) throw error;
      
      // Log the fetched entitlements for debugging (PHASE 8 logging)
      console.log('[useOptimizedRentals] Fetched entitlements:', {
        count: data?.length || 0,
        user_id: user.id,
        states: data?.map(e => e.state) || [],
      });
      
      setEntitlements((data || []) as unknown as RentalEntitlement[]);
    } catch (error) {
      console.error('[useOptimizedRentals] Error fetching entitlements:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user has ACTIVE access to specific content
  const checkAccess = useCallback((contentId: string, contentType: RentalType): RentalAccess => {
    const entitlement = entitlements.find(
      (e) =>
        e.content_id === contentId &&
        e.content_type === contentType &&
        e.state === 'ACTIVE'
    );

    if (!entitlement || !entitlement.expires_at) {
      return {
        hasAccess: false,
        entitlement: null,
        timeRemaining: null,
      };
    }

    const now = new Date().getTime();
    const expiresAt = new Date(entitlement.expires_at).getTime();
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
      entitlement,
      timeRemaining: { hours, minutes, formatted },
    };
  }, [entitlements]);

  // Check if season purchase unlocks all episodes
  const checkSeasonAccess = useCallback((seasonId: string): boolean => {
    return entitlements.some(
      (e) =>
        e.content_id === seasonId &&
        e.content_type === 'season' &&
        e.state === 'ACTIVE'
    );
  }, [entitlements]);

  // Process rental payment (remains the same)
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
      paymentId?: string;
      authorizationUrl?: string;
      paystackReference?: string;
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

        // Check for invoke errors
        if (error) {
          console.error('Edge function error:', error);
          return {
            success: false,
            error: error.message || 'Payment processing failed',
          };
        }

        // Check if response contains an error (edge function returned error response)
        if (data && data.error) {
          console.error('Edge function returned error:', data.error);
          return {
            success: false,
            error: data.error,
          };
        }

        // Validate response structure
        if (!data || typeof data !== 'object') {
          console.error('Invalid response from edge function:', data);
          return {
            success: false,
            error: 'Invalid response from payment service',
          };
        }

        if (paymentMethod === 'wallet') {
          // Wallet payment successful
          if (!data.rentalId) {
            console.error('Missing rentalId in wallet payment response:', data);
            return {
              success: false,
              error: 'Payment processed but rental ID not returned',
            };
          }
          await fetchEntitlements();
          await refreshWallet();
          return {
            success: true,
            rentalId: data.rentalId,
            paymentId: data.paymentId,
          };
        } else if (paymentMethod === 'paystack') {
          // Return authorization URL for Paystack
          if (!data.rentalId || !data.authorizationUrl) {
            console.error('Missing rentalId or authorizationUrl in paystack response:', data);
            return {
              success: false,
              error: 'Paystack setup failed - missing required fields',
            };
          }
          return {
            success: true,
            rentalId: data.rentalId,
            paymentId: data.paymentId,
            authorizationUrl: data.authorizationUrl,
            paystackReference: data.paystackReference,
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
    [user, canAfford, fetchEntitlements, refreshWallet]
  );

  // Set up real-time subscription to rental_access changes (not legacy rentals table)
  // This listens to the canonical source of truth
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(entitlementsChannelNameRef.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_access',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useOptimizedRentals] Rental access changed:', payload.eventType);
          fetchEntitlements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEntitlements]);

  // Also listen to rental_intents for payment pending state changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(intentsChannelNameRef.current ?? `intents-${user.id}-${Math.random().toString(36).slice(2, 10)}`)

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rental_intents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useOptimizedRentals] Rental intent changed:', payload.eventType);
          fetchEntitlements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEntitlements]);

  // Initial fetch
  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  useEffect(() => {
    const handlePaystackCallback = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'paystack:callback') return;
      fetchEntitlements();
    };

    const handleFocus = () => {
      fetchEntitlements();
    };

    window.addEventListener('message', handlePaystackCallback);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('message', handlePaystackCallback);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchEntitlements]);

  return {
    entitlements,
    loading,
    fetchEntitlements,
    checkAccess,
    checkSeasonAccess,
    processRental,
  };
};
