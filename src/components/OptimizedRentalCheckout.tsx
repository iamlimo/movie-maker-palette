import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Wallet,
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Zap,
  Gift,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { toast } from '@/hooks/use-toast';
import { formatNaira } from '@/lib/priceUtils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface OptimizedRentalCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  title: string;
  onSuccess?: () => void;
}

export const OptimizedRentalCheckout = ({
  open,
  onOpenChange,
  contentId,
  contentType,
  price,
  title,
  onSuccess,
}: OptimizedRentalCheckoutProps) => {
  const { user } = useAuth();
  const { balance, canAfford, formatBalance, refreshWallet } = useWallet();
  const { processRental } = useOptimizedRentals();

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [discount, setDiscount] = useState<{
    code: string;
    percentage: number;
    amount: number;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser =
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;

  const finalPrice = discount ? Math.max(0, price - discount.amount) : price;
  const canPayWithWallet = canAfford(finalPrice);
  const canProceed = canPayWithWallet || true; // Can always use Paystack

  const triggerHaptic = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.log('Haptic feedback not available');
      }
    }
  };

  const validateReferralCode = async () => {
    if (!referralCode.trim()) return;

    setValidatingCode(true);
    setCodeError(null);

    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('id, code, discount_type, discount_value, is_active, valid_until')
        .eq('code', referralCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setCodeError('Invalid referral code');
        return;
      }

      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        setCodeError('This code has expired');
        return;
      }

      const discountAmount =
        data.discount_type === 'percentage'
          ? Math.floor(price * data.discount_value / 100)
          : Math.min(data.discount_value, price);

      setDiscount({
        code: data.code,
        percentage: data.discount_type === 'percentage' ? data.discount_value : 0,
        amount: discountAmount,
      });

      toast({
        title: '✨ Discount Applied!',
        description: `Save ${formatNaira(discountAmount)}`,
      });
    } catch (error) {
      console.error('Error validating code:', error);
      setCodeError('Error validating code');
    } finally {
      setValidatingCode(false);
    }
  };

  const handlePayment = async () => {
    if (!user || !paymentMethod) return;

    setIsProcessing(true);
    await triggerHaptic();

    try {
      const result = await processRental(
        contentId,
        contentType,
        finalPrice,
        paymentMethod,
        discount?.code
      );

      if (!result.success) {
        toast({
          title: 'Payment Failed',
          description: result.error || 'Could not process payment',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      if (paymentMethod === 'wallet') {
        toast({
          title: '🎉 Payment Successful!',
          description: `You can now watch ${title}`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else if (paymentMethod === 'paystack' && result.authorizationUrl) {
        // Open Paystack checkout
        if (isNative || isMobileBrowser) {
          window.location.href = result.authorizationUrl;
        } else {
          window.open(result.authorizationUrl, '_blank', 'width=500,height=700');
        }

        toast({
          title: 'Completing Payment',
          description: 'Please complete payment in the new window',
        });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign In Required</DialogTitle>
            <DialogDescription>
              Please sign in to rent this content
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => (window.location.href = '/auth')}>
              Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rent {contentType === 'season' ? 'Season' : 'Episode'}</DialogTitle>
          <DialogDescription>
            <div className="mt-4 space-y-2 text-left">
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm">
                {contentType === 'season'
                  ? 'Full season access • Unlocks all episodes'
                  : '48-hour rental • Single episode'}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pricing Summary */}
          <div className="space-y-3 rounded-lg bg-secondary p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span>{formatNaira(price)}</span>
            </div>
            {discount && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="text-green-600">
                    -{formatNaira(discount.amount)}
                  </span>
                </div>
              </>
            )}
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="text-primary">{formatNaira(finalPrice)}</span>
            </div>
          </div>

          {/* Referral Code Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Referral Code (Optional)</label>
            {discount ? (
              <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <code className="font-mono text-sm font-semibold text-green-700 dark:text-green-300">
                    {discount.code}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDiscount(null);
                    setReferralCode('');
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={referralCode}
                  onChange={(e) => {
                    setReferralCode(e.target.value.toUpperCase());
                    setCodeError(null);
                  }}
                  className="uppercase tracking-widest"
                  disabled={validatingCode}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateReferralCode}
                  disabled={validatingCode || !referralCode.trim()}
                >
                  {validatingCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
            )}
            {codeError && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                {codeError}
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <Tabs value={paymentMethod || ''} onValueChange={(v) => setPaymentMethod(v as any)}>
            <TabsList className="w-full">
              {canPayWithWallet && <TabsTrigger value="wallet">Wallet</TabsTrigger>}
              <TabsTrigger value="paystack">Card</TabsTrigger>
            </TabsList>

            {canPayWithWallet && (
              <TabsContent value="wallet" className="space-y-4">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Wallet Balance</p>
                      <p className="text-xs text-blue-600">{formatBalance()}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">After Payment:</span>
                    <span className="font-medium">
                      {formatNaira(Math.max(0, balance - finalPrice))}
                    </span>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="paystack" className="space-y-4">
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="font-medium">Debit or Credit Card</p>
                    <p className="text-xs text-orange-600">Powered by Paystack</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Warnings */}
          {paymentMethod === 'wallet' && !canPayWithWallet && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-600">
                Insufficient wallet balance. Use card payment or top up your wallet.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={!paymentMethod || isProcessing || !canProceed}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Pay {formatNaira(finalPrice)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
