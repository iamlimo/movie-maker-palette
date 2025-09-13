import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Rental {
  id: string;
  content_id: string;
  content_type: 'movie' | 'episode';
  expiration_date: string;
  price_paid: number;
  status: 'active' | 'expired';
  rental_date: string;
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

  const fetchActiveRentals = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('expiration_date', new Date().toISOString())
        .order('expiration_date', { ascending: true });

      if (error) throw error;
      setActiveRentals(data || []);
    } catch (error) {
      console.error('Error fetching rentals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const checkContentAccess = useCallback(async (contentId: string, contentType: 'movie' | 'episode'): Promise<RentalAccess> => {
    if (!user) {
      return {
        has_access: false,
        access_type: null,
        rental: null,
        purchase: null,
        expires_at: null
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('rental-access', {
        body: { content_id: contentId, content_type: contentType },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking content access:', error);
      return {
        has_access: false,
        access_type: null,
        rental: null,
        purchase: null,
        expires_at: null
      };
    }
  }, [user]);

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

    const channel = supabase
      .channel('rental-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rentals',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchActiveRentals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchActiveRentals]);

  return {
    activeRentals,
    isLoading,
    fetchActiveRentals,
    checkContentAccess,
    getTimeRemaining,
    formatTimeRemaining,
    refreshRentals: fetchActiveRentals
  };
};