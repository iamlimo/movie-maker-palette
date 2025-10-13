import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRentals } from "@/hooks/useRentals";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";

interface RentalButtonProps {
  contentId: string;
  contentType: 'movie' | 'tv' | 'season' | 'episode';
  price: number;
  title: string;
}

const RentalButton = ({ contentId, contentType, price, title }: RentalButtonProps) => {
  const { user } = useAuth();
  const { checkAccess, fetchRentals } = useRentals();
  const { balance, canAfford, formatBalance, refreshWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | null>(null);

  const hasAccess = checkAccess(contentId, contentType);

  const handleRent = async (useWallet: boolean = false) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to rent content",
        variant: "destructive"
      });
      return;
    }

    // Prevent wallet payment if wallet hasn't loaded yet
    if (useWallet && isLoading) {
      toast({
        title: "Wallet Loading",
        description: "Please wait for your wallet to load",
        variant: "default"
      });
      return;
    }

    // Check for existing rental before payment
    if (hasAccess) {
      toast({
        title: "Already Rented",
        description: "You already have access to this content",
      });
      return;
    }

    setIsLoading(true);
    setPaymentMethod(useWallet ? 'wallet' : 'card');

    try {
      let data, error;

      // Try primary payment method
      try {
        const response = await supabase.functions.invoke('wallet-payment', {
          body: {
            contentId,
            contentType,
            price, // price already in kobo from database
            useWallet
          }
        });
        data = response.data;
        error = response.error;
      } catch (primaryError: any) {
        console.error('wallet-payment failed, trying fallback:', primaryError);
        
        // Fallback to create-payment for card payments only
        if (!useWallet) {
          const fallbackResponse = await supabase.functions.invoke('create-payment', {
            body: {
              userId: user.id,
              contentId,
              contentType,
              price
            }
          });
          data = fallbackResponse.data;
          error = fallbackResponse.error;
        } else {
          throw new Error('Wallet payment service unavailable. Please try card payment.');
        }
      }

      if (error) throw error;

      if (data.payment_method === 'wallet') {
        // Wallet payment successful
        await fetchRentals();
        refreshWallet();
        toast({
          title: "Payment Successful!",
          description: `You can now watch ${title}`,
        });
      } else if (data.payment_method === 'paystack' || data.authorization_url) {
        // Open Paystack checkout
        const authUrl = data.authorization_url;
        const paymentId = data.payment_id || data.id;
        
        window.open(authUrl, '_blank', 'width=500,height=700');
        
        toast({
          title: "Payment Initiated",
          description: "Complete your payment in the popup window",
        });

        // Poll for payment completion
        const pollPayment = setInterval(async () => {
          try {
            const { data: paymentData } = await supabase.functions.invoke('verify-payment', {
              body: { payment_id: paymentId }
            });
            
            if (paymentData?.payment?.status === 'completed') {
              clearInterval(pollPayment);
              await fetchRentals();
              toast({
                title: "Payment Successful!",
                description: `You can now watch ${title}`,
              });
            }
          } catch (pollError) {
            console.error('Payment polling error:', pollError);
          }
        }, 3000);

        setTimeout(() => clearInterval(pollPayment), 300000);
      }
    } catch (error: any) {
      console.error('Rental error:', error);
      
      if (error.message?.includes('Insufficient') || error.message?.includes('balance')) {
        const priceInNaira = price / 100;
        toast({
          title: "Insufficient Balance",
          description: `You need ₦${priceInNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })} but have ${formatBalance()}`,
          variant: "destructive"
        });
      } else if (error.message?.includes('Active rental exists')) {
        toast({
          title: "Already Rented",
          description: "You already have an active rental for this content",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to initiate payment",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      setPaymentMethod(null);
    }
  };

  if (hasAccess) {
    return (
      <Button variant="default" size="lg" className="w-full">
        <Play className="h-5 w-5 mr-2" />
        Watch Now
      </Button>
    );
  }

  const rentalDuration = contentType === 'season' 
    ? 'Full season access' 
    : contentType === 'episode' 
    ? '48-hour rental'
    : '48-hour rental';

  const priceInNaira = price / 100;
  const canAffordRental = canAfford(price);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-2xl font-bold">{formatNaira(price)}</div>
        <div className="text-sm text-muted-foreground">{rentalDuration}</div>
      </div>

      {/* Wallet Balance Display */}
      {user && (
        <div className="text-center text-sm text-muted-foreground">
          Wallet Balance: <span className="font-medium">{formatBalance()}</span>
        </div>
      )}

      {/* Payment Buttons */}
      {user && canAffordRental ? (
        <div className="space-y-2">
          <Button 
            onClick={() => handleRent(true)} 
            disabled={isLoading}
            variant="default" 
            size="lg" 
            className="w-full gradient-accent text-primary-foreground"
          >
            {isLoading && paymentMethod === 'wallet' ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-5 w-5 mr-2" />
            )}
            Pay with Wallet
          </Button>
          <Button 
            onClick={() => handleRent(false)} 
            disabled={isLoading}
            variant="outline" 
            size="lg" 
            className="w-full"
          >
            {isLoading && paymentMethod === 'card' ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Pay with Card
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {user && !canAffordRental && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
              Add {formatNaira(price - balance)} to your wallet for instant checkout
            </div>
          )}
          <Button 
            onClick={() => handleRent(false)} 
            disabled={isLoading}
            variant="default" 
            size="lg" 
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Rent for {formatNaira(price)}
          </Button>
        </div>
      )}
    </div>
  );
};

export default RentalButton;