// Phase 2: Unified Payment Dialog Implementation
import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, Wallet, Clock, Play, Download, CheckCircle, 
  AlertTriangle, RefreshCw, Shield, Zap, Info
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePaymentService } from '@/hooks/usePaymentService';
import { useAuth } from '@/contexts/AuthContext';

interface UnifiedPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: {
    id: string;
    title: string;
    type: 'movie' | 'episode';
    price: number;
    rental_price?: number;
    rental_duration?: number;
    thumbnail_url?: string;
  };
  type: 'wallet_topup' | 'rental' | 'purchase';
  presetAmount?: number;
  onSuccess?: () => void;
}

export const UnifiedPaymentDialog = ({ 
  open, 
  onOpenChange, 
  content, 
  type, 
  presetAmount,
  onSuccess 
}: UnifiedPaymentDialogProps) => {
  const [selectedOption, setSelectedOption] = useState<'rent' | 'buy'>('rent');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');
  const [amount, setAmount] = useState(presetAmount || 0);
  const [customAmount, setCustomAmount] = useState<string>('');
  
  const { user } = useAuth();
  const { wallet, canAfford, formatBalance } = useWallet();
  const { 
    state, 
    isLoading, 
    isSuccess, 
    isError, 
    error, 
    walletTopup, 
    rentContent, 
    purchaseContent,
    walletPayment,
    reset 
  } = usePaymentService();

  // Calculate current price based on type and option
  const getCurrentPrice = () => {
    if (type === 'wallet_topup') {
      return amount;
    }
    if (!content) return 0;
    
    return selectedOption === 'rent' 
      ? (content.rental_price || content.price * 0.3) 
      : content.price;
  };

  const currentPrice = getCurrentPrice();
  const canAffordWallet = canAfford(currentPrice);

  // Auto-select card for wallet topup
  useEffect(() => {
    if (type === 'wallet_topup') {
      setPaymentMethod('card');
    }
  }, [type]);

  // Handle successful payments
  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
      onOpenChange(false);
      reset();
    }
  }, [isSuccess, onSuccess, onOpenChange, reset]);

  const handlePayment = async () => {
    if (!user) return;

    try {
      switch (type) {
        case 'wallet_topup':
          await walletTopup(currentPrice);
          break;
        case 'rental':
          if (!content) return;
          if (paymentMethod === 'wallet') {
            await walletPayment(currentPrice, 'rental', {
              content_id: content.id,
              content_type: content.type,
              rental_duration: content.rental_duration || 48
            });
          } else {
            await rentContent(
              content.id, 
              content.type, 
              currentPrice, 
              content.rental_duration || 48,
              paymentMethod
            );
          }
          break;
        case 'purchase':
          if (!content) return;
          if (paymentMethod === 'wallet') {
            await walletPayment(currentPrice, 'purchase', {
              content_id: content.id,
              content_type: content.type
            });
          } else {
  await purchaseContent(
    content.id, 
    content.type, 
    currentPrice,
    paymentMethod
  );
          }
          break;
      }
    } catch (error: any) {
      console.error('Payment error:', error);
    }
  };

  const getDialogTitle = () => {
    switch (type) {
      case 'wallet_topup':
        return 'Top Up Wallet';
      case 'rental':
        return `Rent "${content?.title}"`;
      case 'purchase':
        return `Purchase "${content?.title}"`;
      default:
        return 'Payment';
    }
  };

  const renderPaymentProgress = () => {
    if (!isLoading) return null;

    const steps = ['Validating', 'Processing', 'Confirming'];
    const currentStep = 1; // Could be dynamic based on actual progress

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Processing Payment...</span>
        </div>
        <Progress value={(currentStep / steps.length) * 100} className="w-full" />
        <div className="grid grid-cols-3 gap-2 text-xs">
          {steps.map((step, index) => (
            <div key={step} className={`text-center ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWalletTopup = () => {
    const presetAmounts = [500, 1000, 2000, 5000, 10000];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {presetAmounts.map((preset) => (
            <Button
              key={preset}
              variant={amount === preset ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(preset)}
              className="text-xs"
            >
              ₦{preset.toLocaleString()}
            </Button>
          ))}
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Custom Amount (₦)</label>
          <input
            type="number"
            min="100"
            step="100"
            placeholder="Enter amount"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setAmount(Number(e.target.value) || 0);
            }}
            className="w-full px-3 py-2 border rounded-md text-center"
          />
        </div>
      </div>
    );
  };

  const renderContentOptions = () => {
    if (type === 'wallet_topup' || !content) return null;

    return (
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
    );
  };

  const renderPaymentMethods = () => {
    if (type === 'wallet_topup') {
      return (
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Pay securely with Paystack
          </p>
        </div>
      );
    }

    return (
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
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient wallet balance. Please top up your wallet first.
              </AlertDescription>
            </Alert>
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
    );
  };

  const renderFeatures = () => {
    if (type === 'wallet_topup') {
      return (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Secure Payment Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>Instant Wallet Credit</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>HD & 4K Quality</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span>Instant Streaming</span>
        </div>
        {selectedOption === 'rent' && content && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{content.rental_duration || 48}-hour Access</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'wallet_topup' ? (
              <Wallet className="h-5 w-5 text-primary" />
            ) : (
              <Play className="h-5 w-5 text-primary" />
            )}
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {type === 'wallet_topup' 
              ? 'Add funds to your wallet for faster payments'
              : `Choose how you'd like to access this ${content?.type}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Display */}
          {isError && error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {isSuccess && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Payment completed successfully!</AlertDescription>
            </Alert>
          )}

          {/* Payment Progress */}
          {renderPaymentProgress()}

          {/* Content/Amount Selection */}
          {type === 'wallet_topup' ? renderWalletTopup() : renderContentOptions()}

          <Separator />

          {/* Payment Methods */}
          <div className="space-y-3">
            <p className="font-semibold">Payment Method</p>
            {renderPaymentMethods()}
          </div>

          {/* Features */}
          {renderFeatures()}

          <Separator />

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-semibold">
                ₦{currentPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payment method:</span>
              <span className="capitalize">{paymentMethod}</span>
            </div>
            {type !== 'wallet_topup' && content && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Access type:</span>
                <span className="capitalize">{selectedOption}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={
                isLoading || 
                !currentPrice ||
                (type === 'wallet_topup' && currentPrice < 100) ||
                (paymentMethod === 'wallet' && !canAffordWallet)
              }
              className="flex-1"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isLoading 
                ? 'Processing...' 
                : type === 'wallet_topup'
                  ? `Top up ₦${currentPrice.toLocaleString()}`
                  : `${selectedOption === 'rent' ? 'Rent' : 'Buy'} Now`
              }
            </Button>
          </div>

          {/* Terms */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>
              By proceeding, you agree to our payment terms and conditions.
            </p>
            {paymentMethod === 'card' && (
              <p className="flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" />
                Secure payment powered by Paystack
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};