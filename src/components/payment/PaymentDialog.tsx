import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Wallet, Clock, Play, Download } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePayments } from '@/hooks/usePayments';
import { toast } from '@/hooks/use-toast';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: {
    id: string;
    title: string;
    type: 'movie' | 'episode';
    price: number;
    rental_price?: number;
    rental_duration?: number;
    thumbnail_url?: string;
  };
}

export const PaymentDialog = ({ open, onOpenChange, content }: PaymentDialogProps) => {
  const [selectedOption, setSelectedOption] = useState<'rent' | 'buy'>('rent');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { wallet, canAfford, formatBalance } = useWallet();
  const { processRental, processPurchase, openPaystackCheckout } = usePayments();

  const currentPrice = selectedOption === 'rent' 
    ? (content.rental_price || content.price * 0.3) 
    : content.price;

  const canAffordWallet = canAfford(currentPrice);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      let result;
      
      if (selectedOption === 'rent') {
        result = await processRental(
          content.id, 
          content.type, 
          currentPrice,
          content.rental_duration || 48
        );
      } else {
        result = await processPurchase(
          content.id, 
          content.type, 
          currentPrice
        );
      }

      if (result.success && result.checkout_url) {
        openPaystackCheckout(result.checkout_url);
        onOpenChange(false);
        toast({
          title: "Payment Initiated",
          description: `Complete your payment to ${selectedOption} "${content.title}"`,
        });
      } else {
        toast({
          title: "Payment Error",
          description: result.error || "Failed to initiate payment",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            {content.title}
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to access this {content.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Options */}
          <Tabs value={selectedOption} onValueChange={(value) => setSelectedOption(value as 'rent' | 'buy')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rent" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Rent
              </TabsTrigger>
              <TabsTrigger value="buy" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Buy
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rent" className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">₦{(content.rental_price || content.price * 0.3).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">
                  Watch for {content.rental_duration || 48} hours
                </p>
              </div>
            </TabsContent>

            <TabsContent value="buy" className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">₦{content.price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">
                  Own forever - watch unlimited times
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="font-semibold">Payment Method</p>
            
            <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'wallet' | 'card')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="wallet" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Wallet
                </TabsTrigger>
                <TabsTrigger value="card" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Card
                </TabsTrigger>
              </TabsList>

              <TabsContent value="wallet" className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Current Balance:</span>
                  <Badge variant={canAffordWallet ? "secondary" : "destructive"}>
                    {formatBalance()}
                  </Badge>
                </div>
                {!canAffordWallet && (
                  <p className="text-sm text-destructive">
                    Insufficient wallet balance. Please top up your wallet first.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="card" className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Pay securely with Paystack
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-semibold">₦{currentPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payment method:</span>
              <span className="capitalize">{paymentMethod}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={
                isProcessing || 
                (paymentMethod === 'wallet' && !canAffordWallet)
              }
              className="flex-1"
            >
              {isProcessing ? (
                'Processing...'
              ) : (
                `${selectedOption === 'rent' ? 'Rent' : 'Buy'} Now`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};