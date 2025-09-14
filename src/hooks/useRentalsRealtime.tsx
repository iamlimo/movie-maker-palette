import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRentals } from '@/hooks/useRentals';

export interface RentalWithRealtime extends ReturnType<typeof useRentals> {
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
}

export const useRentalsRealtime = (): RentalWithRealtime => {
  const { user } = useAuth();
  const baseRentals = useRentals();
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Real-time subscription for rental updates with enhanced status tracking
  useEffect(() => {
    if (!user) {
      setRealtimeStatus('disconnected');
      return;
    }

    setRealtimeStatus('connecting');

    const rentalsChannel = supabase
      .channel('user-rentals-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rentals',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Rental update received:', payload);
          // Refresh rentals when changes occur
          baseRentals.fetchActiveRentals();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'payments',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Payment update received:', payload);
          // Check if payment is rental-related and refresh
          const newRecord = payload.new as any;
          if (newRecord && newRecord.purpose === 'rental' && newRecord.enhanced_status === 'success') {
            setTimeout(() => {
              baseRentals.fetchActiveRentals();
            }, 1000); // Small delay to ensure webhook processing
          }
        }
      )
      .subscribe((status) => {
        console.log('Rentals realtime status:', status);
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    return () => {
      console.log('Cleaning up rentals realtime subscription');
      supabase.removeChannel(rentalsChannel);
      setRealtimeStatus('disconnected');
    };
  }, [user, baseRentals.fetchActiveRentals]);

  return {
    ...baseRentals,
    realtimeStatus
  };
};