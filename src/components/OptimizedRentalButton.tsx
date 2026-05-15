import { Button } from '@/components/ui/button';
import { Play, Lock, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { formatNaira } from '@/lib/priceUtils';
import { useState } from 'react';
import { OptimizedRentalCheckout } from './OptimizedRentalCheckout';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '@/hooks/usePlatform';
import { RentalCountdown } from './RentalCountdown';
import { STATE_LABEL } from '@/lib/rentalStates';

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

  const entitlement = getEntitlement(contentId, contentType);

  if (!user) {
    return (
      <Button
        onClick={() => navigate('/auth')}
        variant="default"
        className="w-full"
      >
        <Lock className="h-4 w-4 mr-2" />
        Sign In to Rent
      </Button>
    );
  }

  // iOS native app cannot rent — Reader app compliance.
  if (isIOS && entitlement.state !== 'ACTIVE') {
    return (
      <div className="space-y-2">
        <Button
          disabled
          variant="secondary"
          className="w-full opacity-50 cursor-not-allowed"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Unavailable on iOS App
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          To rent content on iOS, please visit our website on Safari
        </p>
      </div>
    );
  }

  const watchPath = `/watch/${contentType === 'season' ? 'season' : contentType === 'episode' ? 'episode' : 'movie'}/${contentId}`;

  // ACTIVE — Watch Now + countdown.
  if (entitlement.state === 'ACTIVE') {
    return (
      <div className="space-y-2">
        <Button
          onClick={() => navigate(watchPath)}
          variant="default"
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Watch Now
        </Button>
        <div className="flex justify-center">
          <RentalCountdown
            expiresAt={entitlement.expiresAt}
            onExpire={refresh}
            className="text-muted-foreground"
          />
        </div>
      </div>
    );
  }

  // PAYMENT_PENDING / PAYMENT_VERIFICATION — show non-interactive status.
  // NOTE: This state should only be short-lived. If verification ends up cancelled/failed,
  // the entitlement state will become FAILED/REVOKED/etc.
  if (entitlement.state === 'PAYMENT_PENDING' || entitlement.state === 'PAYMENT_VERIFICATION') {
    return (
      <Button disabled variant="secondary" className="w-full">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        {STATE_LABEL[entitlement.state]}
      </Button>
    );
  }


  // REVOKED — informational, no rent CTA.
  if (entitlement.state === 'REVOKED') {
    return (
      <Button disabled variant="secondary" className="w-full">
        <AlertCircle className="h-4 w-4 mr-2" />
        Access Revoked
      </Button>
    );
  }

  // NOT_RENTED / EXPIRED / FAILED / REFUNDED → can rent.
  const isReRent = entitlement.state === 'EXPIRED' || entitlement.state === 'REFUNDED';
  const isRetry = entitlement.state === 'FAILED';

  return (
    <>
      <Button
        onClick={async () => {
          // If we got stuck in a pending/verification state, force entitlement refresh.
          // This ensures cancelled/failed payments revert to rent/try-again CTA.
          if (entitlement.state === 'PAYMENT_PENDING' || entitlement.state === 'PAYMENT_VERIFICATION') {
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
            ? `Retry Payment - ${formatNaira(price)}`
            : `Rent ${contentType === 'season' ? 'Season' : contentType === 'episode' ? 'Episode' : 'Movie'} - ${formatNaira(price)}`}
      </Button>

      <OptimizedRentalCheckout
        open={showCheckout}
        onOpenChange={setShowCheckout}
        contentId={contentId}
        contentType={contentType}
        price={price}
        title={title}
        onSuccess={() => {
          refresh();
          onRentalSuccess?.();
        }}
      />
    </>
  );
};
