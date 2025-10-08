import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Wallet as WalletIcon, DollarSign, TrendingUp, Users } from 'lucide-react';
import WalletAdjustmentModal from '@/components/admin/WalletAdjustmentModal';

interface UserWallet {
  user_id: string;
  wallet_id: string;
  balance: number;
  name: string;
  email: string;
  updated_at: string;
}

export default function Wallets() {
  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const { toast } = useToast();

  const fetchWallets = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('wallets')
        .select(`
          wallet_id,
          user_id,
          balance,
          updated_at,
          profiles!inner(name, email)
        `)
        .order('balance', { ascending: false });

      if (error) throw error;

      const formattedWallets = data?.map(wallet => ({
        wallet_id: wallet.wallet_id,
        user_id: wallet.user_id,
        balance: wallet.balance,
        updated_at: wallet.updated_at,
        name: (wallet.profiles as any)?.name || 'Unknown',
        email: (wallet.profiles as any)?.email || 'Unknown'
      })) || [];

      setWallets(formattedWallets);
    } catch (error: any) {
      console.error('Error fetching wallets:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load wallets'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const filteredWallets = wallets.filter(wallet =>
    wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wallet.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const avgBalance = wallets.length > 0 ? totalBalance / wallets.length : 0;

  const handleAdjustment = (wallet: UserWallet) => {
    setSelectedWallet(wallet);
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustmentSuccess = () => {
    fetchWallets();
    setIsAdjustmentModalOpen(false);
    setSelectedWallet(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Wallet Management
        </h1>
        <p className="text-muted-foreground">
          Manage user wallets and perform manual adjustments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Platform Balance</CardTitle>
              <div className="text-3xl font-bold text-foreground">
                ₦{totalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Balance</CardTitle>
              <div className="text-3xl font-bold text-foreground">
                ₦{avgBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-accent/10">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-card bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <div className="text-3xl font-bold text-foreground">{wallets.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/10">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Wallets Table */}
      <Card className="border-0 shadow-card bg-card/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>User Wallets</CardTitle>
              <CardDescription>View and manage user wallet balances</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/5">
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((wallet) => (
                  <TableRow key={wallet.wallet_id} className="hover:bg-muted/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {wallet.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="font-medium">{wallet.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{wallet.email}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-lg">
                        ₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(wallet.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdjustment(wallet)}
                      >
                        <WalletIcon className="h-4 w-4 mr-2" />
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredWallets.length === 0 && (
            <div className="text-center py-12">
              <WalletIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No wallets found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria' : 'No user wallets available'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      {selectedWallet && (
        <WalletAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={() => {
            setIsAdjustmentModalOpen(false);
            setSelectedWallet(null);
          }}
          userId={selectedWallet.user_id}
          userName={selectedWallet.name}
          currentBalance={selectedWallet.balance}
          onSuccess={handleAdjustmentSuccess}
        />
      )}
    </div>
  );
}
