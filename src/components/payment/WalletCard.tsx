import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus, RefreshCw, CreditCard } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePayments } from '@/hooks/usePayments';
import { toast } from '@/hooks/use-toast';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export const WalletCard = () => {
  const [topupAmount, setTopupAmount] = useState<number>(1000);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const { wallet, formatBalance, isLoading: walletLoading } = useWallet();
  const { walletTopup, openPaystackCheckout, isLoading: paymentLoading } = usePayments();

  const handleTopup = async () => {
    if (!topupAmount || topupAmount < 100) {
      toast({
        title: "Invalid Amount",
        description: "Minimum topup amount is ₦100",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await walletTopup(topupAmount * 100); // Convert to kobo
      
      if (result.success && result.checkout_url) {
        openPaystackCheckout(result.checkout_url);
        toast({
          title: "Redirecting to Payment",
          description: "Complete your payment to top up your wallet.",
        });
      } else {
        toast({
          title: "Payment Error",
          description: result.error || "Failed to initiate payment",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  const selectPresetAmount = (amount: number) => {
    setTopupAmount(amount);
    setIsCustomAmount(false);
  };

  const handleCustomAmount = (value: string) => {
    const amount = parseFloat(value);
    if (!isNaN(amount)) {
      setTopupAmount(amount);
      setIsCustomAmount(true);
    }
  };

  return (
    <Card className="wallet-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          My Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Display */}
        <div className="text-center py-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg">
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

        {/* Top-up Section */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Top up your wallet</Label>
          
          {/* Preset Amounts */}
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant={!isCustomAmount && topupAmount === amount ? "default" : "outline"}
                size="sm"
                onClick={() => selectPresetAmount(amount)}
                className="text-xs"
              >
                ₦{amount.toLocaleString()}
              </Button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Custom Amount (₦)</Label>
            <Input
              id="custom-amount"
              type="number"
              min="100"
              step="100"
              placeholder="Enter amount"
              value={isCustomAmount ? topupAmount : ''}
              onChange={(e) => handleCustomAmount(e.target.value)}
              className="text-center"
            />
          </div>

          {/* Top-up Button */}
          <Button
            onClick={handleTopup}
            disabled={paymentLoading || !topupAmount || topupAmount < 100}
            className="w-full"
            size="lg"
          >
            {paymentLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Top up ₦{topupAmount?.toLocaleString() || 0}
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="h-3 w-3" />
            Secure payment powered by Paystack
          </div>
        </div>
      </CardContent>
    </Card>
  );
};