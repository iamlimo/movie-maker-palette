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
        .maybeSingle();

      if (walletError) {
        console.error('Error fetching wallet:', walletError);
        setError(walletError.message);
        return;
      }

      // If no wallet exists, create one
      if (!data) {
        console.log('No wallet found, creating one for user:', user.id);
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .maybeSingle();
        
        if (createError) {
          console.error('Error creating wallet:', createError);
          setError('Failed to create wallet');
          return;
        }
        
        setWallet(newWallet);
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
    // Balance is stored in kobo, convert to Naira for display
    const balanceInNaira = wallet ? wallet.balance / 100 : 0;
    return `₦${balanceInNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
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