import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const fetchWallet = async () => {
    if (!user) {
      setWallet(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
        setError(walletError.message);
        return;
      }

      setWallet(data);
    } catch (err: any) {
      console.error('Error fetching wallet:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWallet = () => {
    fetchWallet();
  };

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
        (payload) => {
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
  }, [user]);

  const canAfford = (amount: number): boolean => {
    return wallet ? wallet.balance >= amount : false;
  };

  const formatBalance = (): string => {
    return wallet ? `₦${wallet.balance.toFixed(2)}` : '₦0.00';
  };

  return {
    wallet,
    balance: wallet?.balance || 0,
    isLoading,
    error,
    refreshWallet,
    canAfford,
    formatBalance
  };
};