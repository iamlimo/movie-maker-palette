// Enhanced Wallet Card with Transaction History
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wallet, Plus, RefreshCw, CreditCard, ArrowUp, ArrowDown, 
  Clock, CheckCircle, AlertTriangle, History 
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePaymentService } from '@/hooks/usePaymentService';
import { UnifiedPaymentDialog } from './UnifiedPaymentDialog';
import { supabase } from '@/integrations/supabase/client';

interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
  balance_after: number;
}

export const EnhancedWalletCard = () => {
  const [isTopupDialogOpen, setIsTopupDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const { wallet, formatBalance, isLoading: walletLoading, refreshWallet } = useWallet();
  const { getPaymentHistory } = usePaymentService();

  const fetchTransactions = async () => {
    if (!wallet) return;
    
    setIsLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.wallet_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (wallet && showHistory) {
      fetchTransactions();
    }
  }, [wallet, showHistory]);

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'credit':
        return { label: 'Credit', icon: ArrowUp, color: 'text-green-600' };
      case 'debit':
        return { label: 'Debit', icon: ArrowDown, color: 'text-red-600' };
      case 'refund':
        return { label: 'Refund', icon: RefreshCw, color: 'text-blue-600' };
      default:
        return { label: type, icon: ArrowUp, color: 'text-gray-600' };
    }
  };

  const handleTopupSuccess = () => {
    refreshWallet();
    setIsTopupDialogOpen(false);
  };

  return (
    <>
      <Card className="wallet-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              My Wallet
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-muted-foreground"
            >
              <History className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="text-center py-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className="text-3xl font-bold text-primary">
              {walletLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                formatBalance()
              )}
            </p>
            {wallet && (
              <Badge variant="secondary" className="mt-2">
                Last updated: {new Date(wallet.updated_at).toLocaleDateString()}
              </Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => setIsTopupDialogOpen(true)}
              className="h-12 flex-col gap-1"
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">Top Up</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={refreshWallet}
              className="h-12 flex-col gap-1"
              disabled={walletLoading}
            >
              <RefreshCw className={`h-4 w-4 ${walletLoading ? 'animate-spin' : ''}`} />
              <span className="text-xs">Refresh</span>
            </Button>
          </div>

          {/* Transaction History */}
          {showHistory && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Recent Transactions</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchTransactions}
                    disabled={isLoadingTransactions}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <ScrollArea className="h-64">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Loading transactions...
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No transactions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => {
                        const typeInfo = formatTransactionType(transaction.transaction_type);
                        const TypeIcon = typeInfo.icon;
                        
                        return (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-1 rounded-full bg-background ${typeInfo.color}`}>
                                <TypeIcon className="h-3 w-3" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {transaction.description || typeInfo.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(transaction.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${typeInfo.color}`}>
                                {transaction.transaction_type === 'credit' ? '+' : '-'}
                                ₦{transaction.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Balance: ₦{transaction.balance_after.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}

          {/* Security Notice */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <CreditCard className="h-3 w-3" />
            <span>Your wallet is secured with bank-level encryption</span>
          </div>
        </CardContent>
      </Card>

      {/* Unified Payment Dialog */}
      <UnifiedPaymentDialog
        open={isTopupDialogOpen}
        onOpenChange={setIsTopupDialogOpen}
        type="wallet_topup"
        presetAmount={1000}
        onSuccess={handleTopupSuccess}
      />
    </>
  );
};