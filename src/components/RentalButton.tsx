import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '@/hooks/useEntitlements';
import { usePlatform } from '@/hooks/usePlatform';
import { isRentableContentType, normalizeContentType, type ContentType } from '@/lib/contentTypes';
import { OptimizedRentalButton } from './OptimizedRentalButton';

interface RentalButtonProps {
  contentId: string;
  contentType: 'movie' | 'tv' | 'season' | 'episode' | 'tv_show';
  price: number;
  title: string;
}

const RentalButton = ({ contentId, contentType, price, title }: RentalButtonProps) => {
  const navigate = useNavigate();
  const { getEntitlement } = useEntitlements();
  const { isIOS } = usePlatform();

  const normalizedContentType = normalizeContentType(contentType);
  const isRentable = isRentableContentType(normalizedContentType);

  if (!isRentable) {
    return (
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          This content is not available for direct rental.
        </p>
      </div>
    );
  }

  const entitlement = getEntitlement(contentId, normalizedContentType as Exclude<ContentType, 'tv'>);

  if (entitlement.state === 'ACTIVE') {
    return (
      <Button
        variant="default"
        size="lg"
        className="w-full touch-target"
        onClick={() => navigate(`/watch/${contentType}/${contentId}`)}
      >
        <Lock className="h-5 w-5 mr-2" />
        Watch Now
      </Button>
    );
  }

  if (isIOS) {
    return (
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          Rental checkout is available on web and supported devices.
        </p>
      </div>
    );
  }

  // Canonical rental flow uses backend entitlements (via useEntitlements + v_user_entitlements)
  // and canonical rental checkout (OptimizedRentalCheckout). No legacy verify-payment polling.
  return <OptimizedRentalButton contentId={contentId} contentType={normalizedContentType} price={price} title={title} />;
};

export default RentalButton;
