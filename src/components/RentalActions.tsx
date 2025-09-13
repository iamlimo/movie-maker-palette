import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, CreditCard, Wallet, Clock, Shield, Zap, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentService } from "@/hooks/usePaymentService";
import { useWallet } from "@/hooks/useWallet";
import { useRentals } from "@/hooks/useRentals";
import { toast } from "@/hooks/use-toast";

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
  const { rentContent, isLoading } = usePaymentService();
  const { balance, formatBalance } = useWallet();
  const { checkContentAccess, formatTimeRemaining } = useRentals();
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('card');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [accessInfo, setAccessInfo] = useState<any>(null);

  const canAffordWithWallet = balance >= price;

  // Check if user already has access
  useEffect(() => {
    if (user) {
      checkContentAccess(contentId, contentType).then(setAccessInfo);
    }
  }, [user, contentId, contentType, checkContentAccess]);

  const handleRent = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to rent content.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === 'wallet' && !canAffordWithWallet) {
      toast({
        title: "Insufficient funds",
        description: "Your wallet balance is insufficient for this rental.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await rentContent(
        contentId, 
        contentType, 
        price, 
        rentalDuration,
        paymentMethod
      );
      
      if (result.success) {
        setIsDialogOpen(false);
        // Refresh access info
        const updatedAccess = await checkContentAccess(contentId, contentType);
        setAccessInfo(updatedAccess);
      }
    } catch (error: any) {
      console.error('Rental error:', error);
      toast({
        title: "Rental failed",
        description: error.message || "Unable to process rental. Please try again.",
        variant: "destructive",
      });
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
    <div className="p-6 rounded-xl border border-border bg-card">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold mb-2">₦{price}</h3>
        <p className="text-muted-foreground">
          {rentalDuration}-hour rental period
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="premium" size="lg" className="w-full shadow-glow mb-4">
            <Play className="h-5 w-5 mr-2" />
            Rent Now
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rent "{title}"</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Rental Summary */}
            <div className="p-4 rounded-lg border border-border bg-secondary/50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{title}</span>
                <Badge variant="secondary">₦{price}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{rentalDuration} hours</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  <span>HD Quality</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>Instant Access</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <h4 className="font-semibold">Choose Payment Method</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="p-4 h-auto flex-col gap-2"
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-sm">Card Payment</span>
                  <span className="text-xs text-muted-foreground">Via Paystack</span>
                </Button>
                
                <Button
                  variant={paymentMethod === 'wallet' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('wallet')}
                  className="p-4 h-auto flex-col gap-2"
                  disabled={!canAffordWithWallet}
                >
                  <Wallet className="h-5 w-5" />
                  <span className="text-sm">Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBalance()}
                  </span>
                </Button>
              </div>

              {paymentMethod === 'wallet' && !canAffordWithWallet && (
                <p className="text-sm text-destructive">
                  Insufficient wallet balance. Top up your wallet or use card payment.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRent}
                disabled={isLoading || (paymentMethod === 'wallet' && !canAffordWithWallet)}
                className="flex-1"
              >
                {isLoading ? 'Processing...' : `Rent for ₦${price}`}
              </Button>
            </div>

            {/* Terms */}
            <p className="text-xs text-muted-foreground text-center">
              By renting, you agree to our rental terms. Content will be available for {rentalDuration} hours.
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
  );
};

export default RentalActions;