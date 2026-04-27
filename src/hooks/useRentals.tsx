import { useState, useEffect, useCallback } from 'react';
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

  const fetchActiveRentals = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'completed'])
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

      if (error) throw error;
      const normalizedRentals: Rental[] = (data || []).map(
        (rental: {
          id: string;
          user_id: string;
          content_id: string;
          content_type: string;
          price?: number;
          amount?: number;
          status: string;
          expires_at: string;
          created_at: string;
        }) => ({
          id: rental.id,
          user_id: rental.user_id,
          content_id: rental.content_id,
          content_type: rental.content_type,
          amount: rental.amount ?? rental.price ?? 0,
          status: rental.status,
          expires_at: rental.expires_at,
          created_at: rental.created_at,
        })
      );
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
