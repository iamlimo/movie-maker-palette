import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import NairaInput from '@/components/admin/NairaInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, CreditCard } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { Capacitor } from '@capacitor/core';

interface FundWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

export default function FundWalletModal({ isOpen, onClose }: FundWalletModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refreshWallet } = useWallet();

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;
  const shouldUseRedirect = isNative || isMobileBrowser;

  const handleFund = async () => {
    if (amount < 100) {
      toast({
        title: 'Invalid Amount',
        description: 'Minimum funding amount is ₦1.00',
        variant: 'destructive'
      });
      return;
    }

    if (amount > 500000) {
      toast({
        title: 'Amount Too High',
        description: 'Maximum funding amount is ₦500,000.00',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-wallet-funding', {
        body: { amount }
      });

      if (error) throw error;

      if (data.success) {
        const authUrl = data.authorization_url;
        
        if (shouldUseRedirect) {
          window.location.href = authUrl;
        } else {
          window.open(authUrl, '_blank', 'width=500,height=700');
        }
        
        toast({
          title: 'Payment Initiated',
          description: shouldUseRedirect ? "Redirecting to payment..." : "Complete your payment in the popup window",
        });

        // Poll for payment completion
        const pollPayment = setInterval(async () => {
          try {
            const { data: paymentData } = await supabase.functions.invoke('verify-payment', {
              body: { payment_id: data.payment_id }
            });
            
            if (paymentData?.payment?.status === 'completed') {
              clearInterval(pollPayment);
              refreshWallet();
              toast({
                title: 'Wallet Funded!',
                description: `₦${(amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })} added to your wallet`,
              });
              onClose();
              setAmount(0);
            }
          } catch (pollError) {
            console.error('Payment polling error:', pollError);
          }
        }, 3000);

        setTimeout(() => clearInterval(pollPayment), 300000);
      }
    } catch (error: any) {
      console.error('Wallet funding error:', error);
      toast({
        title: 'Funding Failed',
        description: error.message || 'Failed to initiate wallet funding',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6 text-primary" />
            Fund Wallet
          </DialogTitle>
          <DialogDescription>
            Add money to your wallet for faster checkouts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Amount Buttons */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  className={amount === quickAmount * 100 ? 'border-primary bg-primary/10' : ''}
                  onClick={() => setAmount(quickAmount * 100)}
                >
                  ₦{quickAmount.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <NairaInput
            label="Or Enter Custom Amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
          />

          {/* Amount Limits */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Minimum: ₦1.00</p>
            <p>• Maximum: ₦500,000.00</p>
          </div>

          {/* Payment Method */}
          <div className="p-4 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Paystack</p>
                <p className="text-sm text-muted-foreground">Pay with card or bank transfer</p>
              </div>
            </div>
          </div>

          {/* Fund Button */}
          <Button 
            onClick={handleFund}
            disabled={isLoading || amount < 100}
            className="w-full gradient-accent text-primary-foreground shadow-glow"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5 mr-2" />
                Fund ₦{(amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
