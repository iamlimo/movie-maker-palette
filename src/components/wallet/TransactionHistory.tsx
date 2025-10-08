import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowUpCircle, ArrowDownCircle, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  created_at: string;
  transaction_type: string;
  amount: number;
  description: string;
  balance_after: number;
}

export default function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      try {
        setIsLoading(true);

        // Get user's wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('wallet_id')
          .eq('user_id', user.id)
          .single();

        if (!wallet) return;

        // Get transactions
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', wallet.wallet_id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setTransactions(data || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('wallet-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions'
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          Your recent wallet transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No transactions yet</h3>
            <p className="text-sm text-muted-foreground">
              Your wallet transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/5">
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-muted/5">
                    <TableCell className="font-mono text-sm">
                      {new Date(tx.created_at).toLocaleString('en-NG', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{tx.description || 'Transaction'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "flex items-center gap-1 w-fit",
                          tx.transaction_type === 'credit' && "bg-green-500/10 text-green-500 border-green-500/20",
                          tx.transaction_type === 'debit' && "bg-red-500/10 text-red-500 border-red-500/20"
                        )}
                      >
                        {tx.transaction_type === 'credit' ? (
                          <ArrowUpCircle className="h-3 w-3" />
                        ) : (
                          <ArrowDownCircle className="h-3 w-3" />
                        )}
                        {tx.transaction_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-medium",
                        tx.transaction_type === 'credit' && "text-green-500",
                        tx.transaction_type === 'debit' && "text-red-500"
                      )}>
                        {tx.transaction_type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₦{tx.balance_after.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
