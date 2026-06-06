import { useCallback, useEffect, useMemo, useState } from 'react';

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
  Gift,
  X,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { usePlatform } from '@/hooks/usePlatform';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSeasonUpgradeQuote } from '@/hooks/useSeasonUpgradeQuote';
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
  contentType: 'movie' | 'episode' | 'season';
  price: number;
  title: string;
  onSuccess?: () => void;
}

type PaymentMethod = 'wallet' | 'paystack';
type PaymentState = 'processing' | 'verifying' | 'success' | 'failed' | 'pending';

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
  const { processRental } = useOptimizedRentals();
  const { isIOS } = usePlatform();
  const { refresh: refreshEntitlements } = useEntitlements();
  const { quote: upgradeQuote } = useSeasonUpgradeQuote(
    contentType === 'season' ? contentId : null,
    open && contentType === 'season',
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
    status: PaymentState;
    message: string;
  }>({ show: false, status: 'processing', message: '' });

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;

  // When the user qualifies for the smart season upgrade, charge the upgrade price instead.
  const effectivePrice = useMemo(() => {
    if (contentType === 'season' && upgradeQuote?.qualifies) {
      return Math.max(0, upgradeQuote.upgradePrice);
    }
    return price;
  }, [contentType, upgradeQuote, price]);

  const subTotal = useMemo(() => {
    return discount ? Math.max(0, effectivePrice - discount.amount) : effectivePrice;
  }, [discount, effectivePrice]);

  const VAT_RATE = 0.075;
  const vatAmount = Math.round(subTotal * VAT_RATE);
  const totalToPay = subTotal + vatAmount;

  const canPayWithWallet = canAfford(totalToPay);
  const canProceed = paymentMethod === 'wallet' ? canPayWithWallet : paymentMethod === 'paystack';

  const watchPath = `/watch/${contentType}/${contentId}`;

  const triggerHaptic = async () => {
    if (!isNative) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      console.log('Haptic feedback not available');
    }
  };

  const redirectToWatch = () => {
    onOpenChange(false);
    navigate(watchPath);
  };

  const verifyPaystackAccess = useCallback(
    async (callbackData: Record<string, unknown>) => {
      setPaymentStatus({
        show: true,
        status: 'verifying',
        message: 'Confirming payment and activating your rental...',
      });

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          rentalId: callbackData.rentalId,
          rental_intent_id: callbackData.rentalId,
          payment_id: callbackData.paymentId,
          reference: callbackData.reference,
        },
      });

      if (error) throw error;

      const hasActiveRental =
        (Array.isArray(data?.related_records?.rental_access) &&
          data.related_records.rental_access.length > 0);

      if (hasActiveRental) {
        await refreshWallet();
        await refreshEntitlements();
        return true;
      }

      return false;
    },
    [refreshEntitlements, refreshWallet],
  );

  useEffect(() => {
    if (!open) {
      setPaymentMethod(null);
      setIsProcessing(false);
      setPaymentStatus({ show: false, status: 'processing', message: '' });
      return;
    }

    setPaymentMethod(canPayWithWallet ? 'wallet' : 'paystack');
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
          ? Math.floor((price * data.discount_value) / 100)
          : Math.min(data.discount_value, price);

      setDiscount({
        code: data.code,
        percentage: data.discount_type === 'percentage' ? data.discount_value : 0,
        amount: discountAmount,
      });

      toast({
        title: '✨ Discount applied',
        description: `You saved ${formatNaira(discountAmount)}`,
      });
    } catch (error) {
      console.error('Error validating code:', error);
      setCodeError('Error validating code');
    } finally {
      setValidatingCode(false);
    }
  };

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as any;
      if (!data || data.type !== 'paystack:callback') return;

      if (data.status === 'completed' || data.status === 'pending') {
        onOpenChange(false);

        try {
          const hasAccess = await verifyPaystackAccess(data);

          if (hasAccess) {
            setPaymentStatus({ show: false, status: 'processing', message: '' });
            onSuccess?.();
            navigate(watchPath);
            return;
          }
        } catch (error) {
          console.warn('PaymentCallback verification failed:', error);
        }

        setPaymentStatus({
          show: true,
          status: 'pending',
          message: 'Payment received. Access is still being confirmed. Please try Watch Now again shortly.',
        });
      }

      if (data.status === 'failed') {
        setPaymentStatus({ show: true, status: 'failed', message: 'Payment failed. Please try again.' });
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, onOpenChange, onSuccess, verifyPaystackAccess, watchPath]);

  const handlePayment = async () => {
    if (!user || !paymentMethod) return;

    setIsProcessing(true);
    await triggerHaptic();

    try {
      const result = await processRental(
        contentId,
        contentType,
        totalToPay,
        paymentMethod,
        discount?.code,
      );

      if (!result.success) {
        let errorTitle = 'Payment failed';
        let errorDescription = result.error || 'Could not process payment';

        if (result.error?.includes('Insufficient')) {
          errorTitle = '💰 Insufficient balance';
          errorDescription = `You need ${formatNaira(totalToPay - balance)} more. Top up your wallet or use a card.`;
        } else if (result.error?.includes('CORS') || result.error?.includes('fetch')) {
          errorTitle = '🌐 Connection error';
          errorDescription = 'Please check your internet connection and try again.';
        } else if (result.error?.includes('Wallet not found')) {
          errorTitle = '⚠️ Wallet error';
          errorDescription = 'Your wallet could not be found. Please refresh and try again.';
        } else if (result.error?.includes('already has active rental')) {
          errorTitle = '📺 Already rented';
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
        setPaymentStatus({
          show: true,
          status: 'success',
          message: 'Wallet payment completed. Your access is now active.',
        });

        try {
          await refreshWallet();
          await refreshEntitlements();
        } catch (error) {
          console.warn('Could not refresh wallet/entitlements:', error);
        }

        toast({
          title: '🎉 Payment successful!',
          description: `You can now watch ${title}. Enjoy!`,
        });

        await triggerHaptic();
        onSuccess?.();
        setIsProcessing(false);
        redirectToWatch();
        return;
      }

      if (paymentMethod === 'paystack' && result.authorizationUrl && result.rentalId) {
        setPaymentStatus({
          show: true,
          status: 'pending',
          message: 'Payment initiated. Access will unlock automatically once Paystack confirms it.',
        });

        toast({
          title: 'Payment initiated',
          description: 'Complete your payment in Paystack. Access will unlock automatically after confirmation.',
        });

        const paystackWindow =
          isNative || isMobileBrowser
            ? null
            : window.open(result.authorizationUrl, 'paystack_checkout', 'width=520,height=720');

        if (isNative || isMobileBrowser) {
          window.location.href = result.authorizationUrl;
        }

        if (!isNative && !isMobileBrowser && paystackWindow) {
          paystackWindow.focus();
        }

        onOpenChange(false);
        setIsProcessing(false);
        return;
      }

      throw new Error('Payment initiation failed');
    } catch (error: unknown) {
      console.error('Payment error:', error);

      const paymentError = error as {
        message?: string;
        response?: {
          status?: number;
        };
      };

      let errorTitle = '❌ Payment error';
      let errorDescription = 'An unexpected error occurred. Please try again.';

      if (paymentError.message?.includes('CORS') || paymentError.message?.includes('fetch')) {
        errorTitle = '🌐 Network error';
        errorDescription = 'Unable to reach payment server. Check your internet and try again.';
      } else if (paymentError.message?.includes('timeout')) {
        errorTitle = '⏱️ Request timeout';
        errorDescription = 'The request took too long. Please try again.';
      } else if (paymentError.response?.status === 402) {
        errorTitle = '💰 Insufficient balance';
        errorDescription = 'Your wallet balance is not enough for this payment.';
      } else if (paymentError.response?.status === 404) {
        errorTitle = '⚠️ Wallet not found';
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
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md max-h-[calc(100vh-1.5rem)] overflow-hidden p-0 flex flex-col rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="text-xl">Sign in required</DialogTitle>
            <DialogDescription>Please sign in to rent this content.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-6 py-5 text-sm text-muted-foreground">
            You need an account before you can unlock this {contentType}.
          </div>

          <DialogFooter className="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={() => (window.location.href = '/auth')}>Sign In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[calc(100vh-1.5rem)] overflow-hidden p-0 flex flex-col rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="text-xl">
              Unlock {contentType === 'season' ? 'Season' : contentType === 'episode' ? 'Episode' : 'Movie'}
            </DialogTitle>
            <DialogDescription className="max-w-xl text-sm">
              {title}
              <span className="mt-1 block text-xs">
                {contentType === 'season'
                  ? 'Full season access • Unlocks all episodes'
                  : '48-hour rental • Single title access'}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {contentType === 'season' && upgradeQuote?.qualifies && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 mt-0.5">
                    <Gift className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Smart Upgrade
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You've spent {formatNaira(upgradeQuote.eligibleSpend)} on episodes in the last 7 days.
                      Upgrade to the full season for{' '}
                      <span className="font-semibold text-foreground">
                        {formatNaira(upgradeQuote.upgradePrice)}
                      </span>
                      {' '}instead of {formatNaira(upgradeQuote.fullPrice)}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-foreground">{formatNaira(subTotal)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">VAT</span>
                <span className="font-medium">{formatNaira(vatAmount)}</span>
              </div>

              {discount && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-green-600">Discount</span>
                  <span className="font-medium text-green-600">-{formatNaira(discount.amount)}</span>
                </div>
              )}

              <div className="mt-3 border-t pt-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-3xl font-bold tracking-tight text-primary">{formatNaira(totalToPay)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{paymentMethod === 'wallet' ? 'Wallet checkout' : 'Card checkout'}</p>
                    <p>Fast, secure access after payment</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2.5">
                    <Gift className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Promo code</p>
                    <p className="text-xs text-muted-foreground">Optional discount code</p>
                  </div>
                </div>
                {discount && (
                  <Badge variant="outline" className="border-green-300 bg-green-100 text-green-700">
                    {discount.percentage > 0 ? `-${discount.percentage}%` : `-${formatNaira(discount.amount)}`}
                  </Badge>
                )}
              </div>

              <div className="mt-4">
                {discount ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="min-w-0">
                        <code className="block truncate font-mono text-sm font-semibold text-green-700 dark:text-green-300">
                          {discount.code}
                        </code>
                        <p className="text-xs text-green-600">Applied to wallet and card payment</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDiscount(null);
                        setReferralCode('');
                      }}
                      className="h-8 w-8 shrink-0 p-0"
                    >
                      <X className="h-3.5 w-3.5" />
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
                      onClick={validateReferralCode}
                      disabled={validatingCode || !referralCode.trim()}
                      className="shrink-0 px-4"
                    >
                      {validatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}

                {codeError && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                {!discount && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Apply a code if you have one before paying.
                  </p>
                )}
              </div>
            </div>

            <Tabs value={paymentMethod || ''} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <TabsList className={`grid w-full ${canPayWithWallet && !isIOS ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {canPayWithWallet && (
                  <TabsTrigger value="wallet" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallet
                  </TabsTrigger>
                )}
                {!isIOS && (
                  <TabsTrigger value="paystack" className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    Card
                  </TabsTrigger>
                )}
              </TabsList>

              {canPayWithWallet && (
                <TabsContent value="wallet" className="space-y-3 pt-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-500/10 p-2.5">
                          <Wallet className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Current wallet balance</p>
                          <p className="text-2xl font-bold text-blue-600">{formatBalance()}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-green-300 bg-green-100 text-green-700">
                        {canPayWithWallet ? 'Ready' : 'Low balance'}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-background p-3">
                        <p className="text-xs text-muted-foreground">Amount to pay</p>
                        <p className="font-semibold">{formatNaira(totalToPay)}</p>
                      </div>
                      <div className="rounded-xl bg-background p-3">
                        <p className="text-xs text-muted-foreground">Remaining after</p>
                        <p className="font-semibold">{formatNaira(Math.max(0, balance - totalToPay))}</p>
                      </div>
                    </div>
                  </div>

                  {balance < totalToPay && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <div className="text-xs text-red-600">
                        Insufficient wallet balance. Switch to card payment or top up your wallet.
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Instant access after payment</span>
                    </div>
                  </div>
                </TabsContent>
              )}

              {!isIOS && (
                <TabsContent value="paystack" className="space-y-3 pt-4">
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-orange-500/10 p-2.5">
                        <CreditCard className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">Pay with card or bank</p>
                        <p className="text-xs text-muted-foreground">Debit card, bank transfer, and USSD supported.</p>
                      </div>
                    </div>
                  </div>

                  {discount && (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-300">Discount already applied</p>
                          <p className="text-xs text-green-600">You will only pay {formatNaira(totalToPay)}.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        Bank transfers may take 1–5 minutes to confirm. Your rental will activate automatically once verified.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              )}

              {isIOS && (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      <p className="font-semibold">Card payment is unavailable on iOS</p>
                      <p className="mt-1 text-xs">
                        Use your wallet balance here, or pay by card from the web version.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Tabs>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={!paymentMethod || isProcessing || !canProceed}
              className="w-full sm:min-w-44"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Pay {formatNaira(totalToPay)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentStatus.show}
        onOpenChange={(show) => {
          if (!show && paymentStatus.status === 'pending') {
            setPaymentStatus({ ...paymentStatus, show: false });
          }
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:max-w-md max-h-[calc(100vh-1.5rem)] overflow-hidden p-0 flex flex-col rounded-2xl"
          onPointerDownOutside={(e) => {
            if (paymentStatus.status === 'pending') {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-b px-6 py-5 text-left">
            <div className="mb-2 flex justify-center">
              {paymentStatus.status === 'success' && (
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              )}
              {paymentStatus.status === 'failed' && (
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              )}
              {(paymentStatus.status === 'verifying' || paymentStatus.status === 'pending') && (
                <div className="rounded-full bg-blue-100 p-3">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
            <DialogTitle
              className={
                paymentStatus.status === 'success'
                  ? 'text-center text-green-600'
                  : paymentStatus.status === 'failed'
                    ? 'text-center text-red-600'
                    : 'text-center'
              }
            >
              {paymentStatus.status === 'success' && 'Payment successful'}
              {paymentStatus.status === 'failed' && 'Payment failed'}
              {(paymentStatus.status === 'verifying' || paymentStatus.status === 'processing') &&
                'Processing payment'}
              {paymentStatus.status === 'pending' && 'Payment pending'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 px-6 py-5">
            <p className="text-center text-sm text-muted-foreground">{paymentStatus.message}</p>

            {paymentStatus.status === 'pending' && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Bank transfer processing</p>
                    <p className="mt-1">
                      Your rental will activate automatically once the payment is confirmed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentStatus.status === 'failed' && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">
                Please try again or choose a different payment method.
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            {paymentStatus.status === 'success' ? (
              <Button
                onClick={() => {
                  setPaymentStatus({ show: false, status: 'processing', message: '' });
                  onOpenChange(false);
                  onSuccess?.();
                }}
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                Start watching
              </Button>
            ) : paymentStatus.status === 'failed' ? (
              <Button
                onClick={() => setPaymentStatus({ show: false, status: 'processing', message: '' })}
                className="w-full"
              >
                Back to checkout
              </Button>
            ) : paymentStatus.status === 'pending' ? (
              <Button
                onClick={() => {
                  setPaymentStatus({ show: false, status: 'processing', message: '' });
                  onOpenChange(false);
                  toast({
                    title: 'Payment pending',
                    description: 'Your rental will activate once payment is confirmed',
                  });
                }}
                className="w-full"
              >
                Close
              </Button>
            ) : (
              <div className="flex w-full items-center justify-center py-1 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying payment...
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OptimizedRentalCheckout;
