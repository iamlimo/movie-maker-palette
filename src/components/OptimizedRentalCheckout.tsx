import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Clock,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { usePaystackRentalVerification } from '@/hooks/usePaystackRentalVerification';
import { usePlatform } from '@/hooks/usePlatform';
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
  const navigate = useNavigate();
  const { balance, canAfford, formatBalance, refreshWallet } = useWallet();
  const { processRental, fetchRentals } = useOptimizedRentals();
  const { pollPaymentStatus } = usePaystackRentalVerification();
  const { isIOS, isAndroid, isWeb } = usePlatform();

  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [discount, setDiscount] = useState<{
    code: string;
    percentage: number;
    amount: number;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<{
    show: boolean;
    status: 'processing' | 'verifying' | 'success' | 'failed' | 'pending';
    message: string;
    rentalId?: string;
    channel?: string;
    details?: any;
  }>({ show: false, status: 'processing', message: '' });

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser =
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;

  const finalPrice = discount ? Math.max(0, price - discount.amount) : price;
  const canPayWithWallet = canAfford(finalPrice);
  const canProceed = canPayWithWallet || true;

  const triggerHaptic = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.log('Haptic feedback not available');
      }
    }
  };

  // Auto-select first available payment method when dialog opens
  useEffect(() => {
    if (open) {
      // Prefer wallet if available, otherwise use paystack
      if (canPayWithWallet) {
        setPaymentMethod('wallet');
      } else {
        setPaymentMethod('paystack');
      }
    } else {
      // Reset payment method when dialog closes
      setPaymentMethod(null);
      setPaymentStatus({ show: false, status: 'processing', message: '' });
    }
  }, [open, canPayWithWallet]);

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

  const handlePaystackPaymentReturn = async (rentalId: string) => {
    // User has completed payment flow, now verify status
    setPaymentStatus({
      show: true,
      status: 'verifying',
      message: 'Verifying your payment...',
      rentalId,
    });

    try {
      const result = await pollPaymentStatus(rentalId, undefined, (status) => {
        if (status.payment?.channel) {
          setPaymentStatus(prev => ({
            ...prev,
            channel: status.payment.channel,
            details: status.payment,
          }));
        }

        if (status.status === 'pending') {
          setPaymentStatus(prev => ({
            ...prev,
            status: 'pending',
            message: `Payment pending (${status.payment?.channel || 'processing'}). For bank transfers, this may take a few minutes.`,
          }));
        }
      });

      if (result.success) {
        setPaymentStatus({
          show: true,
          status: 'success',
          message: `✅ Payment successful! Rental activated via ${result.payment?.channel || 'Paystack'}.`,
          rentalId,
          channel: result.payment?.channel,
          details: result.payment,
        });

        try {
          await refreshWallet();
          await fetchRentals();
        } catch (e) {
          console.warn('Could not refresh wallet/rentals:', e);
        }
        
        await triggerHaptic();
        toast({
          title: '🎉 Payment Successful!',
          description: `You can now watch ${title}`,
        });

        // Refresh rentals state before redirecting
        try {
          await fetchRentals();
          // Allow time for state updates to propagate
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          console.warn('Could not refresh rentals:', e);
        }

        setIsRedirecting(true);

        // Close dialog and redirect to watch page
        setTimeout(() => {
          onOpenChange(false);
          setPaymentStatus({ show: false, status: 'processing', message: '' });
          onSuccess?.();
          
          // Redirect to watch page
          if (contentType === 'season') {
            navigate(`/watch/season/${contentId}`);
          } else {
            navigate(`/watch/episode/${contentId}`);
          }
        }, 1000);
      } else if (result.status === 'pending') {
        setPaymentStatus({
          show: true,
          status: 'pending',
          message: `Payment is being processed. For bank transfers, this may take up to 5 minutes. You can close this dialog and check back later.`,
          rentalId,
          channel: result.payment?.channel,
          details: result.payment,
        });
      } else {
        setPaymentStatus({
          show: true,
          status: 'failed',
          message: result.message || 'Payment verification failed. Please try again.',
          rentalId,
          details: result.payment,
        });

        toast({
          title: 'Payment Failed',
          description: result.message || 'Could not verify payment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setPaymentStatus({
        show: true,
        status: 'failed',
        message: 'An error occurred while verifying payment',
        rentalId,
      });
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
        // Better error messages based on error type
        let errorTitle = 'Payment Failed';
        let errorDescription = result.error || 'Could not process payment';

        if (result.error?.includes('Insufficient')) {
          errorTitle = '💰 Insufficient Balance';
          errorDescription = `You need ${formatNaira(finalPrice - balance)} more. Top up your wallet or use a card.`;
        } else if (result.error?.includes('CORS') || result.error?.includes('fetch')) {
          errorTitle = '🌐 Connection Error';
          errorDescription = 'Please check your internet connection and try again.';
        } else if (result.error?.includes('Wallet not found')) {
          errorTitle = '⚠️ Wallet Error';
          errorDescription = 'Your wallet could not be found. Please refresh and try again.';
        } else if (result.error?.includes('already has active rental')) {
          errorTitle = '📺 Already Rented';
          errorDescription = 'You already have an active rental for this content.';
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      if (paymentMethod === 'wallet') {
        toast({
          title: '🎉 Payment Successful!',
          description: `You can now watch ${title}. Enjoy!`,
        });
        
        // Refresh wallet balance and rentals with optimized timing
        try {
          await refreshWallet();
          await fetchRentals();
          
          // Allow time for state updates to propagate
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          console.warn('Could not refresh wallet/rentals:', e);
        }
        
        setIsRedirecting(true);
        
        // Brief delay to show success message and allow UI to update
        setTimeout(() => {
          onOpenChange(false);
          onSuccess?.();
          
          // Redirect to watch page
          if (contentType === 'season') {
            navigate(`/watch/season/${contentId}`);
          } else {
            navigate(`/watch/episode/${contentId}`);
          }
        }, 800);
      } else if (paymentMethod === 'paystack' && result.authorizationUrl && result.rentalId) {
        // Show payment processing status
        setPaymentStatus({
          show: true,
          status: 'processing',
          message: 'Opening payment page...',
          rentalId: result.rentalId,
        });

        // Open Paystack checkout
        const paystackWindow = isNative || isMobileBrowser
          ? null
          : window.open(result.authorizationUrl, 'paystack_checkout', 'width=500,height=700');

        if (isNative || isMobileBrowser) {
          window.location.href = result.authorizationUrl;
        }

        // Set a timer to check payment status after user returns
        // For web, check after 3 seconds (user might close window)
        // For mobile, user will return to app
        if (!isNative && !isMobileBrowser && paystackWindow) {
          const checkWindow = setInterval(() => {
            if (paystackWindow.closed) {
              clearInterval(checkWindow);
              handlePaystackPaymentReturn(result.rentalId!);
            }
          }, 1000);

          // Timeout after 10 minutes
          setTimeout(() => clearInterval(checkWindow), 600000);
        } else {
          // For mobile, check after delay
          setTimeout(() => {
            handlePaystackPaymentReturn(result.rentalId!);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      let errorTitle = '❌ Payment Error';
      let errorDescription = 'An unexpected error occurred. Please try again.';

      // Handle specific error types
      if (error?.message?.includes('CORS') || error?.message?.includes('fetch')) {
        errorTitle = '🌐 Network Error';
        errorDescription = 'Unable to reach payment server. Check your internet and try again.';
      } else if (error?.message?.includes('timeout')) {
        errorTitle = '⏱️ Request Timeout';
        errorDescription = 'The request took too long. Please try again.';
      } else if (error?.response?.status === 402) {
        errorTitle = '💰 Insufficient Balance';
        errorDescription = 'Your wallet balance is not enough for this payment.';
      } else if (error?.response?.status === 404) {
        errorTitle = '⚠️ Wallet Not Found';
        errorDescription = 'Your wallet could not be found. Please refresh and try again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
      
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
          {/* Discount Banner */}
          {discount && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-700 dark:text-green-300">Discount Applied!</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Save {discount.percentage > 0 ? `${discount.percentage}%` : formatNaira(discount.amount)} on all payment methods
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  {discount.percentage > 0 ? `-${discount.percentage}%` : `Save ${formatNaira(discount.amount)}`}
                </Badge>
              </div>
            </div>
          )}

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
                  <span className="text-green-600 font-medium">Discount</span>
                  <span className="text-green-600 font-medium">
                    -{formatNaira(discount.amount)}
                  </span>
                </div>
              </>
            )}
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total {discount ? '(after discount)' : ''}</span>
              <span className={discount ? 'text-green-600' : 'text-primary'}>{formatNaira(finalPrice)}</span>
            </div>
          </div>

          {/* Referral Code Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Referral Code (Optional)</label>
              {discount && (
                <span className="text-xs text-green-600 font-medium">✓ Discount Active</span>
              )}
            </div>
            {discount ? (
              <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <code className="font-mono text-sm font-semibold text-green-700 dark:text-green-300">
                      {discount.code}
                    </code>
                    <p className="text-xs text-green-600 mt-0.5">
                      Applies to wallet & card payments
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDiscount(null);
                    setReferralCode('');
                  }}
                  className="h-6 w-6 p-0 flex-shrink-0"
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
            {!discount && (
              <p className="text-xs text-muted-foreground">
                Have a discount code? Apply it to save on both wallet and card payments.
              </p>
            )}
          </div>

          {/* Payment Method Selection */}
          <Tabs value={paymentMethod || ''} onValueChange={(v) => setPaymentMethod(v as any)}>
            <TabsList className="w-full">
              {canPayWithWallet && <TabsTrigger value="wallet">💳 Wallet</TabsTrigger>}
              {!isIOS && <TabsTrigger value="paystack">🏦 Card Payment</TabsTrigger>}
            </TabsList>

            {canPayWithWallet && (
              <TabsContent value="wallet" className="space-y-4">
                {/* Status Indicators */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20 p-2">
                    <div className="text-xs font-semibold text-blue-600">Step 1</div>
                    <div className="text-xs text-muted-foreground">Review</div>
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mx-auto mt-1" />
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20 p-2">
                    <div className="text-xs font-semibold text-blue-600">Step 2</div>
                    <div className="text-xs text-muted-foreground">Confirm</div>
                    <Wallet className="h-4 w-4 text-blue-600 mx-auto mt-1" />
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20 p-2">
                    <div className="text-xs font-semibold text-green-600">Step 3</div>
                    <div className="text-xs text-muted-foreground">Complete</div>
                    <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mt-1" />
                  </div>
                </div>

                {/* Balance Section */}
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-600/10 p-2.5">
                        <Wallet className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground">Current Wallet Balance</p>
                        <p className="text-2xl font-bold text-blue-600">{formatBalance()}</p>
                      </div>
                      {canPayWithWallet && (
                        <div className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1">
                          <Check className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-semibold text-green-600">Ready</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction Breakdown */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Content Price:</span>
                        <span className="font-medium">{formatNaira(price)}</span>
                      </div>
                      {discount && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Gift className="h-3 w-3" />
                            Discount Saving:
                          </span>
                          <span className="font-semibold text-green-600">-{formatNaira(discount.amount)}</span>
                        </div>
                      )}
                      <div className="h-px bg-border" />
                      <div className="flex items-center justify-between text-base font-bold">
                        <span>Amount to Pay:</span>
                        <span className={discount ? 'text-green-600' : 'text-primary'}>{formatNaira(finalPrice)}</span>
                      </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Balance After Payment */}
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">After This Payment:</span>
                        <span className="font-bold text-primary">{formatNaira(Math.max(0, balance - finalPrice))}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        <span>Your remaining balance for future rentals</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Checklist */}
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium">Instant access to content</p>
                        <p className="text-muted-foreground">Watch immediately after payment</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium">Secure wallet payment</p>
                        <p className="text-muted-foreground">No additional fees or charges</p>
                      </div>
                    </div>
                    {discount && (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-medium">Discount already applied</p>
                          <p className="text-muted-foreground">Save {formatNaira(discount.amount)} on this payment</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warnings & Info */}
                  {canPayWithWallet && balance < finalPrice && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20 p-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-600">
                        <p className="font-semibold mb-0.5">Insufficient Balance</p>
                        <p className="text-xs">
                          You need {formatNaira(finalPrice - balance)} more to complete this payment. Switch to card payment or top up your wallet.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Security Badge */}
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                    <Lock className="h-3 w-3 text-green-600" />
                    <span>Secure & Encrypted Transaction</span>
                  </div>
                </div>
              </TabsContent>
            )}

            {!isIOS && (
              <TabsContent value="paystack" className="space-y-4">
              <div className="space-y-3">
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="font-medium">Multiple Payment Options</p>
                      <p className="text-xs text-orange-600">Powered by Paystack</p>
                    </div>
                  </div>
                </div>

                {discount && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-300">
                          Discount Applied to Card Payment
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Your discount is applied. Pay only {formatNaira(finalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Available Payment Methods:</p>
                  <ul className="space-y-1.5 ml-2">
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-3 w-3 text-blue-600" />
                      <span>Debit/Credit Card (instant)</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-3 w-3 text-amber-600" />
                      <span>Bank Transfer (1-5 minutes)</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-3 w-3 text-green-600" />
                      <span>USSD (instant)</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2.5">
                  <div className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                    <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Bank Transfer Info:</strong> If you choose bank transfer, your payment may take 1-5 minutes to confirm. Your rental will activate automatically once payment is verified.
                    </p>
                  </div>
                </div>
              </div>
            )}
            </TabsContent>

            {isIOS && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-semibold mb-1">⚠️ Card Payment Not Available on iOS</p>
                    <p className="text-xs mb-2">
                      Due to App Store policies, direct card payments are not available on iOS. Please use the web version to complete your payment.
                    </p>
                    <p className="text-xs">
                      You can still use your wallet balance if you have funds. Visit our website from Safari to pay with a card.
                    </p>
                  </div>
                </div>
              </div>
            )}
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

      {/* Payment Status Modal */}
      <Dialog open={paymentStatus.show} onOpenChange={(show) => {
        if (!show && paymentStatus.status === 'pending') {
          // Allow user to close pending payment dialog
          setPaymentStatus({ ...paymentStatus, show: false });
        }
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
          if (paymentStatus.status === 'pending') {
            e.preventDefault();
          }
        }}>
          <DialogHeader>
            {paymentStatus.status === 'success' && (
              <div className="flex justify-center mb-2">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            )}
            {paymentStatus.status === 'failed' && (
              <div className="flex justify-center mb-2">
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            )}
            {(paymentStatus.status === 'verifying' || paymentStatus.status === 'pending') && (
              <div className="flex justify-center mb-2">
                <div className="rounded-full bg-blue-100 p-3">
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                </div>
              </div>
            )}
            <DialogTitle className={
              paymentStatus.status === 'success'
                ? 'text-green-600'
                : paymentStatus.status === 'failed'
                ? 'text-red-600'
                : ''
            }>
              {paymentStatus.status === 'success' && '✅ Payment Successful'}
              {paymentStatus.status === 'failed' && '❌ Payment Failed'}
              {(paymentStatus.status === 'verifying' || paymentStatus.status === 'processing') && 'Processing Payment'}
              {paymentStatus.status === 'pending' && '⏳ Payment Pending'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              {isRedirecting && paymentStatus.status === 'success'
                ? 'Preparing your content... Redirecting to watch page'
                : paymentStatus.message}
            </p>

            {isRedirecting && paymentStatus.status === 'success' && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {paymentStatus.channel && (
              <div className="rounded-lg border bg-secondary/50 p-2">
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="text-sm font-medium capitalize">{paymentStatus.channel}</p>
              </div>
            )}

            {paymentStatus.status === 'pending' && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="flex gap-2">
                  <Clock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Payment Processing</p>
                    <p className="mt-1">
                      Bank transfers may take 1-5 minutes to complete. Your rental will activate automatically once the payment is confirmed in our system.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentStatus.status === 'failed' && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  Please try again or use a different payment method.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {paymentStatus.status === 'success' ? (
              <Button
                onClick={() => {
                  setPaymentStatus({ show: false, status: 'processing', message: '' });
                  onOpenChange(false);
                  onSuccess?.();
                }}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Watching
              </Button>
            ) : paymentStatus.status === 'failed' ? (
              <Button
                onClick={() => setPaymentStatus({ show: false, status: 'processing', message: '' })}
                className="w-full"
              >
                Back to Checkout
              </Button>
            ) : paymentStatus.status === 'pending' ? (
              <Button
                onClick={() => {
                  setPaymentStatus({ show: false, status: 'processing', message: '' });
                  onOpenChange(false);
                  toast({
                    title: 'Payment Pending',
                    description: 'Your rental will activate once payment is confirmed',
                  });
                }}
                className="w-full"
              >
                Close (Check Back Later)
              </Button>
            ) : (
              <div className="w-full flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Verifying payment...</span>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
