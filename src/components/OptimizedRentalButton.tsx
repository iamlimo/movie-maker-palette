import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Lock, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';
import { formatNaira } from '@/lib/priceUtils';
import { useState } from 'react';
import { OptimizedRentalCheckout } from './OptimizedRentalCheckout';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '@/hooks/usePlatform';
import { toast } from '@/hooks/use-toast';

interface OptimizedRentalButtonProps {
  contentId: string;
  contentType: 'episode' | 'season';
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
  const { checkAccess } = useOptimizedRentals();
  const { isIOS, isAndroid, isWeb } = usePlatform();
  const [showCheckout, setShowCheckout] = useState(false);

  const access = checkAccess(contentId, contentType);

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

  // iOS users cannot rent from mobile app - show information instead
  if (isIOS) {
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

  // User has access
  if (access.hasAccess) {
    return (
      <div className="space-y-2">
        <Button
          onClick={() =>
            navigate(`/watch/${contentType === 'season' ? 'season' : 'episode'}/${contentId}`)
          }
          variant="default"
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Watch Now
        </Button>
        {access.timeRemaining && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {access.timeRemaining.formatted}
          </div>
        )}
      </div>
    );
  }

  // Android and Web users can rent
  return (
    <>
      <Button
        onClick={() => setShowCheckout(true)}
        className="w-full"
      >
        <Lock className="h-4 w-4 mr-2" />
        Rent {contentType === 'season' ? 'Season' : 'Episode'} - {formatNaira(price)}
      </Button>

      <OptimizedRentalCheckout
        open={showCheckout}
        onOpenChange={setShowCheckout}
        contentId={contentId}
        contentType={contentType}
        price={price}
        title={title}
        onSuccess={() => {
          onRentalSuccess?.();
        }}
      />
    </>
  );
};
