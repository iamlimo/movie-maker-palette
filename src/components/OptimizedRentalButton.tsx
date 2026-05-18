import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Lock, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { formatNaira } from '@/lib/priceUtils';
import { usePlatform } from '@/hooks/usePlatform';
import { OptimizedRentalCheckout } from './OptimizedRentalCheckout';
import { canRent } from '@/lib/rentalStates';

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

  // Ensure episode rentals always route to the episode Watch page.
  // Other rental types (movie/season) keep their existing paths.
  const resolvedWatchPath = (() => {
    if (contentType === 'episode') return `/watch/episode/${contentId}`;
    return `/watch/${contentType}/${contentId}`;
  })();

  if (!user) {
    return (
      <Button onClick={() => navigate('/auth')} variant="default" className="w-full">
        <Lock className="h-4 w-4 mr-2" />
        Sign In to Rent
      </Button>
    );
  }

  if (isIOS && entitlement.state !== 'ACTIVE') {
    return (
      <div className="space-y-2">
        <Button disabled variant="secondary" className="w-full opacity-50 cursor-not-allowed">
          <AlertCircle className="h-4 w-4 mr-2" />
          Unavailable on iOS App
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          To rent content on iOS, please visit our website on Safari
        </p>
      </div>
    );
  }

  if (entitlement.state === 'ACTIVE') {
    return (
      <Button
        onClick={() => navigate(resolvedWatchPath)}

        variant="default"
        className="w-full bg-green-600 hover:bg-green-700"
      >
        <Play className="h-4 w-4 mr-2" />
        Watch Now
      </Button>
    );
  }

  if (!canRent(entitlement)) {
    return (
      <Button disabled variant="secondary" className="w-full">
        <AlertCircle className="h-4 w-4 mr-2" />
        {entitlement.state === 'REVOKED' ? 'Access Revoked' : 'Rental Unavailable'}
      </Button>
    );
  }

  const isReRent = entitlement.state === 'EXPIRED' || entitlement.state === 'REFUNDED' || entitlement.state === 'REVOKED';
  const isRetry = entitlement.state === 'FAILED';

  return (
    <>
      <Button
        onClick={async () => {
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

export default OptimizedRentalButton;
