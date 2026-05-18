import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type CallbackStatus = 'verifying' | 'completed' | 'pending' | 'failed';

const CLOSE_DELAY_MS = 900;

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [message, setMessage] = useState('Confirming your payment...');

  const callbackData = useMemo(() => {
    const contentType = searchParams.get('contentType');
    const contentId = searchParams.get('contentId');
    const paymentId = searchParams.get('paymentId');
    const rentalId = searchParams.get('rentalId');
    const reference =
      searchParams.get('reference') ||
      searchParams.get('trxref') ||
      rentalId ||
      paymentId ||
      undefined;

    const fallbackReturnTo =
      contentType && contentId
        ? `/watch/${contentType}/${contentId}`
        : '/wallet';

    return {
      kind: searchParams.get('kind') || 'payment',
      contentType,
      contentId,
      paymentId,
      rentalId,
      reference,
      returnTo: searchParams.get('returnTo') || fallbackReturnTo,
    };
  }, [searchParams]);

  useEffect(() => {
    let closeTimer: number | undefined;
    let cancelled = false;

    const finish = (nextStatus: CallbackStatus, nextMessage: string) => {
      if (cancelled) return;

      setStatus(nextStatus);
      setMessage(nextMessage);

      window.opener?.postMessage(
        {
          type: 'paystack:callback',
          status: nextStatus,
          ...callbackData,
        },
        window.location.origin,
      );

      if (window.opener && !window.opener.closed) {
        closeTimer = window.setTimeout(() => window.close(), CLOSE_DELAY_MS);
      }
    };

    const verifyPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            rentalId: callbackData.rentalId,
            rental_intent_id: callbackData.rentalId,
            payment_id: callbackData.paymentId || callbackData.reference,
            reference: callbackData.reference,
          },
        });

        if (error) {
          finish('pending', 'Payment received. Final confirmation may take a moment.');
          return;
        }

        const paymentStatus = String(
          data?.payment?.status ||
            data?.payment?.enhanced_status ||
            data?.paystack_status?.status ||
            data?.rental?.status ||
            '',
        ).toLowerCase();

        if (['completed', 'success', 'successful', 'paid'].includes(paymentStatus)) {
          finish('completed', 'Payment confirmed. Closing this window...');
          return;
        }

        if (['failed', 'cancelled', 'canceled', 'rejected'].includes(paymentStatus)) {
          finish('failed', 'Payment was not completed.');
          return;
        }

        finish('pending', 'Payment is still being confirmed. You can close this window.');
      } catch (error) {
        console.error('Payment callback verification failed:', error);
        finish('pending', 'Payment received. Final confirmation may take a moment.');
      }
    };

    verifyPayment();

    return () => {
      cancelled = true;
      if (closeTimer) window.clearTimeout(closeTimer);
    };
  }, [callbackData]);

  const icon =
    status === 'completed' ? (
      <CheckCircle2 className="h-8 w-8 text-green-600" />
    ) : status === 'failed' ? (
      <XCircle className="h-8 w-8 text-red-600" />
    ) : (
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {status === 'completed'
                ? 'Payment confirmed'
                : status === 'failed'
                  ? 'Payment failed'
                  : 'Payment processing'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button className="w-full" onClick={() => navigate(callbackData.returnTo, { replace: true })}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
