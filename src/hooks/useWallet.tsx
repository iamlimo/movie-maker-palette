import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatNaira, koboToNaira } from '@/lib/priceUtils';

export interface WalletData {
  wallet_id: string;
  balance: number;
  updated_at: string;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchWallet = useCallback(async () => {
    if (!user) {
      console.log('useWallet: No user, setting wallet to null');
      setWallet(null);
      setIsLoading(false);
      return;
    }

    try {
      console.log('useWallet: Fetching wallet for user:', user.id);
      setIsLoading(true);
      setError(null);

      const { data, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) {
        console.error('useWallet: Error fetching wallet:', walletError);
        setError(walletError.message);
        return;
      }

      console.log('useWallet: Wallet data received:', data);

      // If no wallet exists, create one
      if (!data) {
        console.log('useWallet: No wallet found, creating one for user:', user.id);
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('useWallet: Error creating wallet:', createError);
          setError('Failed to create wallet');
          return;
        }

        console.log('useWallet: New wallet created:', newWallet);
        setWallet(newWallet);
        return;
      }

      setWallet(data);
    } catch (err) {
      const error = err as { message: string };
      console.error('useWallet: Error fetching wallet:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refreshWallet = useCallback(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Real-time subscription to wallet changes
  useEffect(() => {
    if (!user) return;

    fetchWallet();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('wallet-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('Wallet updated:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setWallet(payload.new as WalletData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchWallet]);

  const balanceInNaira = (): number => {
    return koboToNaira(wallet?.balance || 0);
  };

  const canAfford = (amountInKobo: number): boolean => {
    return wallet ? wallet.balance >= amountInKobo : false;
  };

  const formatBalance = (): string => {
    // Balance is stored in kobo, use formatNaira for proper formatting
    return formatNaira(wallet?.balance || 0);
  };

  return {
    wallet,
    balance: wallet?.balance || 0,
    balanceInNaira: balanceInNaira(),
    isLoading,
    error,
    refreshWallet,
    canAfford,
    formatBalance
  };
};