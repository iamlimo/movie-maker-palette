import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Lock, AlertCircle, RotateCcw, RotateCcw as RetryIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { formatNaira } from '@/lib/priceUtils';
import { usePlatform } from '@/hooks/usePlatform';
import { OptimizedRentalCheckout } from './OptimizedRentalCheckout';
import { canRent } from '@/lib/rentalStates';
import { buildWebUnlockUrl } from '@/lib/webUnlockPaths';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OptimizedRentalButtonProps {
  contentId: string;
  contentType: 'movie' | 'episode' | 'season';
  price: number;
  title: string;
  onRentalSuccess?: () => void;
}

export const OptimizedRentalButton = ({
  contentId,
  contentType,
  price,
  title,
  onRentalSuccess,
}: OptimizedRentalButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getEntitlement, refresh } = useEntitlements();
  const { isIOS } = usePlatform();
  const [showCheckout, setShowCheckout] = useState(false);
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const entitlement = getEntitlement(contentId, contentType);

  const handleRetryVerification = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          rentalId: entitlement.intentId,
          rental_intent_id: entitlement.intentId,
        },
      });
      if (error) throw error;
      await refresh();
      const hasActive =
        Array.isArray((data as any)?.related_records?.rental_access) &&
        (data as any).related_records.rental_access.length > 0;
      toast({
        title: hasActive ? 'Payment confirmed' : 'Still verifying',
        description: hasActive
          ? 'Access has been granted.'
          : 'Paystack has not confirmed the payment yet. Try again in a few seconds.',
      });
    } catch (err) {
      console.error('[OptimizedRentalButton] verify-payment failed', err);
      toast({
        title: 'Verification failed',
        description: (err as Error)?.message || 'Could not reach verification service.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // 2500ms grace period toggled by OptimizedRentalCheckout onDismiss
  const graceTimerRef = useRef<number | null>(null);
  const [isGraceActive, setIsGraceActive] = useState(false);

  useEffect(() => {
    return () => {
      if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
    };
  }, []);

  const triggerGrace = () => {
    if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
    setIsGraceActive(true);
    graceTimerRef.current = window.setTimeout(() => {
      setIsGraceActive(false);
      graceTimerRef.current = null;
    }, 2500);
  };

  const resolvedWatchPath = useMemo(() => {
    if (contentType === 'episode') return `/watch/episode/${contentId}`;
    return `/watch/${contentType}/${contentId}`;
  }, [contentId, contentType]);

  const isExpiredHardStop = useMemo(() => {
    if (!entitlement?.expiresAt) return false;
    const expiresMs = new Date(entitlement.expiresAt).getTime();
    if (Number.isNaN(expiresMs)) return false;
    return expiresMs <= Date.now();
  }, [entitlement?.expiresAt]);

  if (!user) {
    return (
      <Button onClick={() => navigate('/auth')} variant="default" className="w-full">
        <Lock className="h-4 w-4 mr-2" />
        Sign In to Rent
      </Button>
    );
  }

  if (isIOS && entitlement.state !== 'ACTIVE') {
    const iosLabel =
      contentType === 'season' ? 'Season' : contentType === 'episode' ? 'Episode' : 'Movie';
    return (
      <div className="space-y-2">
        <Button
          disabled
          variant="secondary"
          className="w-full min-h-[44px] whitespace-normal text-center leading-tight opacity-100 disabled:opacity-70"
        >
          <Lock className="h-4 w-4 mr-2 shrink-0" />
          Rent {iosLabel} — Unavailable in App
        </Button>

        <p className="text-[11px] sm:text-xs text-muted-foreground text-center leading-snug">
          Renting isn’t available in the iOS app. Visit our website in Safari to unlock this {iosLabel.toLowerCase()}.
        </p>
      </div>
    );
  }


  const effectiveEntitlement =
    entitlement.state === 'ACTIVE' && isExpiredHardStop
      ? { ...entitlement, state: 'EXPIRED' as const }
      : entitlement;

  // 2) Grace Period (for NOT_RENTED / PAYMENT_PENDING / PAYMENT_VERIFICATION)
  const isGraceEligibleState =
    effectiveEntitlement.state === 'NOT_RENTED' ||
    effectiveEntitlement.state === 'PAYMENT_PENDING' ||
    effectiveEntitlement.state === 'PAYMENT_VERIFICATION';

  if (isGraceActive && isGraceEligibleState) {
    return (
      <Button
        onClick={async () => {
          if (
            effectiveEntitlement.state === 'PAYMENT_PENDING' ||
            effectiveEntitlement.state === 'PAYMENT_VERIFICATION'
          ) {
            await refresh();
          }
          setShowCheckout(true);
        }}
        className="w-full"
        variant="default"
      >
        <RetryIcon className="h-4 w-4 mr-2" />
        Retry Payment - {formatNaira(price)}
      </Button>
    );
  }

  // Pending payment verification: allow user to manually re-run verify-payment
  if (
    (effectiveEntitlement.state === 'PAYMENT_PENDING' ||
      effectiveEntitlement.state === 'PAYMENT_VERIFICATION') &&
    entitlement.intentId
  ) {
    return (
      <div className="space-y-2">
        <Button disabled variant="secondary" className="w-full">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Verifying Payment...
        </Button>
        <Button
          onClick={handleRetryVerification}
          disabled={isVerifying}
          variant="outline"
          className="w-full"
        >
          {isVerifying ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RetryIcon className="h-4 w-4 mr-2" />
          )}
          {isVerifying ? 'Checking...' : 'Retry Verification'}
        </Button>
      </div>
    );
  }

  // 3) Terminal/Default states (standard entitlement logic)
  if (effectiveEntitlement.state === 'ACTIVE') {
    return (
      <Button onClick={() => navigate(resolvedWatchPath)} variant="default" className="w-full bg-green-600 hover:bg-green-700">
        <Play className="h-4 w-4 mr-2" />
        Watch Now
      </Button>
    );
  }

  if (!canRent(effectiveEntitlement)) {
    return (
      <Button disabled variant="secondary" className="w-full">
        <AlertCircle className="h-4 w-4 mr-2" />
        {effectiveEntitlement.state === 'REVOKED' ? 'Access Revoked' : 'Rental Unavailable'}
      </Button>
    );
  }

  const isReRent = effectiveEntitlement.state === 'EXPIRED' || effectiveEntitlement.state === 'REFUNDED' || effectiveEntitlement.state === 'REVOKED';
  const isRetry = effectiveEntitlement.state === 'FAILED';

  return (
    <>
      <Button
        onClick={async () => {
          if (
            effectiveEntitlement.state === 'PAYMENT_PENDING' ||
            effectiveEntitlement.state === 'PAYMENT_VERIFICATION'
          ) {
            await refresh();
          }
          setShowCheckout(true);
        }}
        className="w-full"
        variant={isRetry ? 'destructive' : 'default'}
      >
        {isReRent ? (
          <RotateCcw className="h-4 w-4 mr-2" />
        ) : isRetry ? (
          <AlertCircle className="h-4 w-4 mr-2" />
        ) : (
          <Lock className="h-4 w-4 mr-2" />
        )}
        {isReRent
          ? `Rent Again - ${formatNaira(price)}`
          : isRetry
            ? `Payment Failed — Try Again`
            : `Rent ${contentType === 'season' ? 'Season' : contentType === 'episode' ? 'Episode' : 'Movie'} - ${formatNaira(price)}`}
      </Button>

      <OptimizedRentalCheckout
        open={showCheckout}
        onOpenChange={setShowCheckout}
        contentId={contentId}
        contentType={contentType}
        price={price}
        title={title}
        onDismiss={triggerGrace}
        onSuccess={() => {
          refresh();
          onRentalSuccess?.();
        }}
      />
    </>
  );
};

export default OptimizedRentalButton;

