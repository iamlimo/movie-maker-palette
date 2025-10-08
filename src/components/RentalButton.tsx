import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRentals } from "@/hooks/useRentals";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";

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

    setIsLoading(true);
    setPaymentMethod(useWallet ? 'wallet' : 'card');

    try {
      const { data, error } = await supabase.functions.invoke('wallet-payment', {
        body: {
          contentId,
          contentType,
          price,
          useWallet
        }
      });

      if (error) throw error;

      if (data.payment_method === 'wallet') {
        // Wallet payment successful
        await fetchRentals();
        refreshWallet();
        toast({
          title: "Payment Successful!",
          description: `You can now watch ${title}`,
        });
      } else if (data.payment_method === 'paystack') {
        // Open Paystack checkout
        window.open(data.authorization_url, '_blank', 'width=500,height=700');
        
        toast({
          title: "Payment Initiated",
          description: "Complete your payment in the popup window",
        });

        // Poll for payment completion
        const pollPayment = setInterval(async () => {
          try {
            const { data: paymentData } = await supabase.functions.invoke('verify-payment', {
              body: { payment_id: data.payment_id }
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
      
      if (error.message?.includes('Insufficient wallet balance')) {
        toast({
          title: "Insufficient Balance",
          description: `You need ₦${(price / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })} but have ${formatBalance()}`,
          variant: "destructive"
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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-2xl font-bold">₦{(price / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
        <div className="text-sm text-muted-foreground">{rentalDuration}</div>
      </div>

      {/* Wallet Balance Display */}
      {user && (
        <div className="text-center text-sm text-muted-foreground">
          Wallet Balance: <span className="font-medium">{formatBalance()}</span>
        </div>
      )}

      {/* Payment Buttons */}
      {user && canAfford(price) ? (
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
          Rent for ₦{(price / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </Button>
      )}
    </div>
  );
};

export default RentalButton;