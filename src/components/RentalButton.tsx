import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRentals } from "@/hooks/useRentals";
import { toast } from "@/hooks/use-toast";

interface RentalButtonProps {
  contentId: string;
  contentType: 'movie' | 'tv';
  price: number;
  title: string;
}

const RentalButton = ({ contentId, contentType, price, title }: RentalButtonProps) => {
  const { user } = useAuth();
  const { checkAccess, fetchRentals } = useRentals();
  const [isLoading, setIsLoading] = useState(false);

  const hasAccess = checkAccess(contentId, contentType);

  const handleRent = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to rent content",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          userId: user.id,
          contentId,
          contentType,
          price
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        // Open Paystack checkout
        window.open(data.authorization_url, '_blank', 'width=500,height=700');
        
        toast({
          title: "Payment Initiated",
          description: "Complete your payment in the popup window",
        });

        // Poll for payment completion
        const pollPayment = setInterval(async () => {
          await fetchRentals();
          if (checkAccess(contentId, contentType)) {
            clearInterval(pollPayment);
            toast({
              title: "Payment Successful!",
              description: `You can now watch ${title}`,
            });
          }
        }, 3000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollPayment), 300000);
      }
    } catch (error: any) {
      console.error('Rental error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-2xl font-bold">₦{price}</div>
        <div className="text-sm text-muted-foreground">48-hour rental</div>
      </div>
      <Button 
        onClick={handleRent} 
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
        Rent for ₦{price}
      </Button>
    </div>
  );
};

export default RentalButton;