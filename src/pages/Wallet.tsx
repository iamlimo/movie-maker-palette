import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { Wallet as WalletIcon, Plus, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import FundWalletModal from '@/components/wallet/FundWalletModal';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '@/hooks/usePlatform';

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatBalance, isLoading, refreshWallet } = useWallet();
  const { isIOS } = usePlatform();
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-24">
        <div className="mb-8 flex items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Wallet
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your balance</h1>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshWallet}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card className="overflow-hidden border-0 bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardDescription className="text-sm text-muted-foreground">Available balance</CardDescription>
                <CardTitle className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  {isLoading ? '...' : formatBalance()}
                </CardTitle>
              </div>

              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <WalletIcon className="h-9 w-9" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {isIOS ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Wallet top-up is unavailable on iOS in the app. Use the web version to fund your wallet.
              </div>
            ) : (
              <Button
                onClick={() => setIsFundModalOpen(true)}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Fund wallet
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="mt-8">
          <TransactionHistory />
        </div>
      </main>

      {!isIOS && (
        <FundWalletModal
          isOpen={isFundModalOpen}
          onClose={() => setIsFundModalOpen(false)}
        />
      )}
    </div>
  );
}
