import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { Wallet as WalletIcon, Plus, TrendingUp, TrendingDown, History } from 'lucide-react';
import Header from '@/components/Header';
import FundWalletModal from '@/components/wallet/FundWalletModal';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '@/hooks/usePlatform';

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, formatBalance, isLoading } = useWallet();
  const { isIOS } = usePlatform();
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              My Wallet
            </h1>
            <p className="text-muted-foreground">
              Manage your funds and track your transactions
            </p>
          </div>

          {/* Balance Card */}
          <Card className="border-0 shadow-elegant bg-gradient-to-br from-card via-card to-accent/5 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription className="text-muted-foreground/80">
                    Available Balance
                  </CardDescription>
                  <CardTitle className="text-5xl font-bold mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {isLoading ? '...' : formatBalance()}
                  </CardTitle>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                  <WalletIcon className="h-12 w-12 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {!isIOS ? (
                <Button 
                  onClick={() => setIsFundModalOpen(true)}
                  className="w-full sm:w-auto gradient-accent text-primary-foreground shadow-glow hover:scale-105 transition-bounce"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Fund Wallet
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Wallet funding is available on the Signature TV website.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardDescription className="text-sm">This Month</CardDescription>
                  <CardTitle className="text-2xl font-bold text-foreground">₦0.00</CardTitle>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardDescription className="text-sm">Spent</CardDescription>
                  <CardTitle className="text-2xl font-bold text-foreground">₦0.00</CardTitle>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-card bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardDescription className="text-sm">Transactions</CardDescription>
                  <CardTitle className="text-2xl font-bold text-foreground">0</CardTitle>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Transaction History */}
          <TransactionHistory />
        </div>
      </main>

      {/* Fund Wallet Modal */}
      <FundWalletModal 
        isOpen={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
      />
    </div>
  );
}
