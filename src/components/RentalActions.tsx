import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CreditCard, Wallet, Clock, Shield, Zap, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRentalsRealtime } from "@/hooks/useRentalsRealtime";
import { UnifiedPaymentDialog } from "@/components/payment/UnifiedPaymentDialog";

interface RentalActionsProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  price: number;
  title: string;
  rentalDuration?: number;
}

const RentalActions = ({ 
  contentId, 
  contentType, 
  price, 
  title,
  rentalDuration = 48 
}: RentalActionsProps) => {
  const { user } = useAuth();
  const { checkContentAccess, formatTimeRemaining } = useRentalsRealtime();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [accessInfo, setAccessInfo] = useState<any>(null);

  // Check if user already has access
  useEffect(() => {
    if (user) {
      checkContentAccess(contentId, contentType).then(setAccessInfo);
    }
  }, [user, contentId, contentType, checkContentAccess]);

  // Refresh access info after successful payment
  const handlePaymentSuccess = async () => {
    if (user) {
      const updatedAccess = await checkContentAccess(contentId, contentType);
      setAccessInfo(updatedAccess);
    }
  };

  // If user already has access, show different UI
  if (accessInfo?.has_access) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card">
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h3 className="text-xl font-bold">Access Granted</h3>
          </div>
          {accessInfo.access_type === 'rental' && accessInfo.expires_at && (
            <p className="text-muted-foreground">
              {formatTimeRemaining(accessInfo.expires_at)}
            </p>
          )}
          {accessInfo.access_type === 'purchase' && (
            <p className="text-muted-foreground">Owned forever</p>
          )}
        </div>
        
        <Button variant="premium" size="lg" className="w-full shadow-glow">
          <Play className="h-5 w-5 mr-2" />
          Watch Now
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 rounded-xl border border-border bg-card">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">₦{price}</h3>
          <p className="text-muted-foreground">
            {rentalDuration}-hour rental period
          </p>
        </div>

        <Button 
          variant="premium" 
          size="lg" 
          className="w-full shadow-glow mb-4"
          onClick={() => setIsDialogOpen(true)}
        >
          <Play className="h-5 w-5 mr-2" />
          Rent Now
        </Button>

        {/* Features */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>HD & 4K Quality</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>Instant Streaming</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{rentalDuration}-hour Access</span>
          </div>
        </div>
      </div>

      <UnifiedPaymentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        type="rental"
        content={{
          id: contentId,
          title,
          type: contentType,
          price,
          rental_price: price,
          rental_duration: rentalDuration
        }}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
};

export default RentalActions;