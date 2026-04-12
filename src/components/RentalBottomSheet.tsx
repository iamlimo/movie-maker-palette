import { useState } from "react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, Clock, Tag, Check, Loader2, ChevronDown } from "lucide-react";
import { formatNaira } from "@/lib/priceUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ReferralDiscount {
  code: string;
  codeId: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number; // actual discount in kobo
}

interface RentalBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  contentTitle: string;
  price: number;
  walletBalance: number;
  rentalDuration: string;
  canAfford: boolean;
  isLoading: boolean;
  paymentMethod: 'wallet' | 'card' | null;
  onRentWithWallet: (referralCode?: string) => void;
  onRentWithCard: (referralCode?: string) => void;
}

export const RentalBottomSheet = ({
  isOpen,
  onClose,
  contentTitle,
  price,
  walletBalance,
  rentalDuration,
  canAfford,
  isLoading,
  paymentMethod,
  onRentWithWallet,
  onRentWithCard,
}: RentalBottomSheetProps) => {
  const [referralInput, setReferralInput] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<ReferralDiscount | null>(null);
  const [validating, setValidating] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  const finalPrice = referralDiscount ? Math.max(0, price - referralDiscount.discountAmount) : price;
  const canAffordFinal = walletBalance >= finalPrice;

  const validateCode = async () => {
    if (!referralInput.trim()) return;
    setValidating(true);
    try {
      const code = referralInput.trim().toUpperCase();
      const { data, error } = await supabase
        .from('referral_codes')
        .select('id, code, discount_type, discount_value, max_uses, times_used, max_uses_per_user, min_purchase_amount, valid_until, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Invalid code', description: 'This referral code is not valid', variant: 'destructive' });
        return;
      }

      // Check expiry
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        toast({ title: 'Code expired', variant: 'destructive' });
        return;
      }

      // Check max uses
      if (data.max_uses && data.times_used >= data.max_uses) {
        toast({ title: 'Code fully redeemed', variant: 'destructive' });
        return;
      }

      // Check min purchase
      if (data.min_purchase_amount > 0 && price < data.min_purchase_amount) {
        toast({ title: 'Minimum not met', description: `Minimum purchase: ${formatNaira(data.min_purchase_amount)}`, variant: 'destructive' });
        return;
      }

      const discountAmount = data.discount_type === 'percentage'
        ? Math.floor(price * data.discount_value / 100)
        : Math.min(data.discount_value, price);

      setReferralDiscount({
        code: data.code,
        codeId: data.id,
        discountType: data.discount_type as 'percentage' | 'fixed',
        discountValue: data.discount_value,
        discountAmount,
      });

      toast({ title: 'Code applied!', description: `You save ${formatNaira(discountAmount)}` });
    } catch {
      toast({ title: 'Error validating code', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const removeCode = () => {
    setReferralDiscount(null);
    setReferralInput('');
  };

  const handleClose = () => {
    removeCode();
    setPromoOpen(false);
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
      <DrawerContent className="mobile-safe-padding mobile-safe-padding-bottom">
        <DrawerHeader>
          <DrawerTitle className="text-xl">Rent {contentTitle}</DrawerTitle>
          <DrawerDescription>Choose your payment method</DrawerDescription>
        </DrawerHeader>

        <motion.div
          className="p-6 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Price Section */}
          <div className="bg-gradient-card rounded-lg p-4 text-center space-y-2">
            {referralDiscount ? (
              <>
                <div className="text-lg line-through text-muted-foreground">{formatNaira(price)}</div>
                <div className="text-3xl font-bold gradient-accent bg-clip-text text-transparent">{formatNaira(finalPrice)}</div>
                <div className="flex items-center justify-center gap-1 text-sm text-green-500">
                  <Check className="h-3 w-3" />
                  {referralDiscount.discountType === 'percentage' ? `${referralDiscount.discountValue}%` : formatNaira(referralDiscount.discountAmount)} off applied
                </div>
              </>
            ) : (
              <div className="text-3xl font-bold gradient-accent bg-clip-text text-transparent">
                {formatNaira(price)}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {rentalDuration}
            </div>
          </div>

          {/* Referral Code Section */}
          <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <Tag className="h-4 w-4" />
              <span>Have a referral code?</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${promoOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {referralDiscount ? (
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <code className="font-mono text-sm">{referralDiscount.code}</code>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeCode} className="text-xs">Remove</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={referralInput}
                    onChange={e => setReferralInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="font-mono"
                    onKeyDown={e => e.key === 'Enter' && validateCode()}
                  />
                  <Button onClick={validateCode} disabled={validating || !referralInput.trim()} variant="outline" size="default">
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Wallet Balance */}
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Wallet Balance</span>
            <span className="font-semibold">{formatNaira(walletBalance)}</span>
          </div>

          {/* Payment Options */}
          <div className="space-y-3">
            {canAffordFinal && (
              <Button
                onClick={() => onRentWithWallet(referralDiscount?.code)}
                disabled={isLoading}
                variant="default"
                size="lg"
                className="w-full touch-target gradient-accent text-primary-foreground font-semibold"
              >
                {isLoading && paymentMethod === 'wallet' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Wallet className="h-5 w-5 mr-2" />
                  </motion.div>
                ) : (
                  <Wallet className="h-5 w-5 mr-2" />
                )}
                Pay {formatNaira(finalPrice)} with Wallet
              </Button>
            )}

            <Button
              onClick={() => onRentWithCard(referralDiscount?.code)}
              disabled={isLoading}
              variant={canAffordFinal ? "outline" : "default"}
              size="lg"
              className="w-full touch-target font-semibold"
            >
              {isLoading && paymentMethod === 'card' ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                </motion.div>
              ) : (
                <CreditCard className="h-5 w-5 mr-2" />
              )}
              Pay {formatNaira(finalPrice)} with Card
            </Button>
          </div>

          {/* Insufficient Balance Warning */}
          {!canAffordFinal && (
            <motion.div
              className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              Add {formatNaira(finalPrice - walletBalance)} to your wallet for instant checkout
            </motion.div>
          )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
};
