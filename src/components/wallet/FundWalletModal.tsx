import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import NairaInput from '@/components/admin/NairaInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, CreditCard, ShieldCheck } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { formatNaira } from '@/lib/priceUtils';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { usePlatform } from '@/hooks/usePlatform';

interface FundWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FundingState = 'idle' | 'processing' | 'pending' | 'success' | 'failed';

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];
const MIN_AMOUNT_KOBO = 100;
const MAX_AMOUNT_KOBO = 500_000 * 100;

export default function FundWalletModal({ isOpen, onClose }: FundWalletModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<FundingState>('idle');
  const [statusMessage, setStatusMessage] = useState('Choose a top-up amount and continue securely.');
  const pollIntervalRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { refreshWallet, formatBalance } = useWallet();
  const { isIOS } = usePlatform();

  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;
  const shouldUseRedirect = isNative || isMobileBrowser;

  const normalizedAmount = useMemo(() => {
    const n = Number(amount) || 0;
    return Math.max(0, Math.round(n));
  }, [amount]);

  const clearFundingPollers = () => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearFundingPollers();
    };
  }, []);

  if (isIOS) {
    return null;
  }

  const resetFlow = () => {
    clearFundingPollers();
    setStatus('idle');
    setStatusMessage('Choose a top-up amount and continue securely.');
    setAmount(0);
  };

  const handleFund = async () => {
    if (isIOS) {
      toast({
        title: 'Wallet top-up unavailable',
        description: 'Wallet funding is disabled on iOS in the app.',
        variant: 'destructive',
      });
      return;
    }

    clearFundingPollers();

    const safeAmount = Math.round(Number(normalizedAmount) || 0);

    if (!Number.isFinite(safeAmount) || safeAmount < MIN_AMOUNT_KOBO) {
      setStatus('failed');
      setStatusMessage('Minimum funding amount is ₦1.00');
      toast({
        title: 'Invalid amount',
        description: 'Minimum funding amount is ₦1.00',
        variant: 'destructive',
      });
      return;
    }

    if (safeAmount > MAX_AMOUNT_KOBO) {
      setStatus('failed');
      setStatusMessage('Maximum wallet top-up is ₦500,000.00');
      toast({
        title: 'Maximum reached',
        description: 'Maximum wallet top-up is ₦500,000.00',
        variant: 'destructive',
      });
      return;
    }

    setStatus('processing');
    setStatusMessage('Preparing your secure payment...');

    try {
      const { data, error } = await supabase.functions.invoke('initiate-wallet-funding', {
        body: {
          amount: safeAmount,
          platform: Capacitor.getPlatform(),
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.authorization_url) {
        throw new Error(data?.error || 'Could not start wallet funding');
      }

      const authUrl = data.authorization_url;

      if (isNative) {
        await Browser.open({ url: authUrl });
      } else if (isMobileBrowser) {
        window.location.href = authUrl;
      } else {
        window.open(authUrl, '_blank', 'width=520,height=760');
      }

      setStatus('pending');
      setStatusMessage('Paystack is open. Complete the payment and we will confirm your wallet instantly.');

      toast({
        title: 'Payment started',
        description: shouldUseRedirect ? 'You are being redirected to Paystack.' : 'Complete your payment in the pop-up window.',
      });

      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke('verify-payment', {
            body: { payment_id: data.payment_id },
          });

          if (paymentError) {
            console.warn('Wallet funding verification returned an error before confirmation:', paymentError);
            return;
          }

          const paymentStatus = String(paymentData?.payment?.status || '').toLowerCase();

          if (paymentStatus === 'completed') {
            clearFundingPollers();
            refreshWallet();
            setStatus('success');
            setStatusMessage(`${formatNaira(safeAmount)} has been added to your wallet.`);
            toast({
              title: 'Wallet funded successfully',
              description: `${formatNaira(safeAmount)} added to your wallet`,
            });
            window.setTimeout(() => {
              onClose();
              resetFlow();
            }, 900);
            return;
          }

          if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'canceled') {
            clearFundingPollers();
            setStatus('failed');
            setStatusMessage('The payment was not completed. Please try again or contact support.');
            toast({
              title: 'Payment failed',
              description: 'The payment was not completed. Please try again or contact support.',
              variant: 'destructive',
            });
            return;
          }
        } catch (pollError) {
          console.error('Payment polling error:', pollError);
        }
      }, 2000);

      pollTimeoutRef.current = window.setTimeout(() => {
        clearFundingPollers();
        setStatus('failed');
        setStatusMessage('Payment verification timed out. Please check your wallet or try again.');
        toast({
          title: 'Payment verification timed out',
          description: 'Check your wallet or try again in a moment.',
          variant: 'destructive',
        });
      }, 300000);
    } catch (error: unknown) {
      console.error('Wallet funding error:', error);
      const message = error instanceof Error ? error.message : 'Failed to initiate wallet funding.';
      setStatus('failed');
      setStatusMessage(message);
      toast({
        title: 'Funding failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        clearFundingPollers();
        onClose();
        if (status !== 'pending' && status !== 'processing') {
          resetFlow();
        }
      }
    }}>
      <DialogContent className="sm:max-w-md border-border bg-card p-0 shadow-2xl">
        <DialogHeader className="px-5 pb-3 pt-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">Top up wallet</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  Add money securely
                </DialogDescription>
              </div>
            </div>

            <div className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
              Secure
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-5 pt-2">
          <div className="rounded-2xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Available balance</span>
              <span className="font-medium text-foreground">{formatBalance()}</span>
            </div>
          </div>

          {status === 'processing' || status === 'pending' || status === 'success' || status === 'failed' ? (
            <div
              className={[
                'rounded-2xl border p-3 text-sm',
                status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : '',
                status === 'failed' ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300' : '',
                status === 'processing' || status === 'pending' ? 'border-primary/30 bg-primary/5 text-foreground' : '',
              ].join(' ')}
            >
              {status === 'processing' && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
              {statusMessage}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-background/80 p-3 shadow-sm transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
              <NairaInput
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                className="border-0 bg-transparent text-3xl shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">You can use your wallet to pay for rentals and purchases.</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
              <Button
                key={quickAmount}
                type="button"
                variant={amount === quickAmount * 100 ? 'default' : 'outline'}
                size="sm"
                className={`rounded-xl ${amount === quickAmount * 100 ? 'bg-primary text-primary-foreground' : 'border-border bg-background/50'}`}
                onClick={() => setAmount(quickAmount * 100)}
              >
                ₦{quickAmount.toLocaleString()}
              </Button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Paystack</p>
                <p className="text-xs text-muted-foreground">Card or bank transfer or OPAY</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <span>Min ₦1.00</span>
            <span>Max ₦500,000.00</span>
          </div>

          <Button
            onClick={handleFund}
            disabled={status === 'processing' || status === 'pending' || normalizedAmount < MIN_AMOUNT_KOBO}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
            size="lg"
          >
            {status === 'processing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : status === 'pending' ? (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Payment in progress
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                {normalizedAmount > 0 ? `Fund ${formatNaira(normalizedAmount)}` : 'Continue'}
              </>
            )}
          </Button>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span>Secured by Paystack</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
