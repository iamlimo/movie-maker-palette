import { useState } from "react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, Clock, Tag, Check, Loader2, ChevronDown, AlertCircle, X } from "lucide-react";
import { formatNaira } from "@/lib/priceUtils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  showReferralCode?: boolean; // Only show on Android, not iOS
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
  showReferralCode = true, // Default to true for backward compatibility
}: RentalBottomSheetProps) => {
  const { user } = useAuth();
  const [referralInput, setReferralInput] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<ReferralDiscount | null>(null);
  const [validating, setValidating] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const finalPrice = referralDiscount ? Math.max(0, price - referralDiscount.discountAmount) : price;
  const canAffordFinal = walletBalance >= finalPrice;
  const savingsAmount = referralDiscount ? referralDiscount.discountAmount : 0;
  const savingsPercent = referralDiscount && referralDiscount.discountType === 'percentage' 
    ? referralDiscount.discountValue 
    : Math.round((savingsAmount / price) * 100);

  const validateCode = async () => {
    if (!referralInput.trim()) return;
    if (!user) {
      setValidationError('Please sign in to use referral codes');
      return;
    }

    setValidating(true);
    setValidationError(null);
    try {
      const code = referralInput.trim().toUpperCase();
      const { data, error } = await supabase
        .from('referral_codes')
        .select('id, code, discount_type, discount_value, max_uses, times_used, max_uses_per_user, min_purchase_amount, valid_until, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setValidationError('This referral code is not valid');
        return;
      }

      // Check expiry
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        setValidationError('This code has expired');
        return;
      }

      // Check max uses
      if (data.max_uses && data.times_used >= data.max_uses) {
        setValidationError('This code is no longer available');
        return;
      }

      // Check min purchase
      if (data.min_purchase_amount > 0 && price < data.min_purchase_amount) {
        setValidationError(`Minimum purchase required: ${formatNaira(data.min_purchase_amount)}`);
        return;
      }

      // Check per-user usage limit
      const { count: userUsageCount } = await supabase
        .from('referral_code_uses')
        .select('id', { count: 'exact', head: true })
        .eq('code_id', data.id)
        .eq('user_id', user.id);

      if (userUsageCount !== null && userUsageCount >= data.max_uses_per_user) {
        setValidationError(`You've already used this code ${data.max_uses_per_user} time${data.max_uses_per_user > 1 ? 's' : ''}`);
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

      toast({ title: '✨ Discount Applied!', description: `Save ${formatNaira(discountAmount)}` });
    } catch (err) {
      console.error('Error validating code:', err);
      setValidationError('Error validating code. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const removeCode = () => {
    setReferralDiscount(null);
    setReferralInput('');
    setValidationError(null);
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
                <div className="text-sm text-muted-foreground">Original price</div>
                <div className="text-lg line-through text-muted-foreground">{formatNaira(price)}</div>
                <div className="text-3xl font-bold gradient-accent bg-clip-text text-transparent mt-2">{formatNaira(finalPrice)}</div>
                <motion.div 
                  className="flex items-center justify-center gap-2 text-sm font-medium text-green-500"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Check className="h-4 w-4" />
                  <span>{savingsPercent > 0 ? savingsPercent + '% off' : formatNaira(savingsAmount) + ' off'}</span>
                </motion.div>
              </>
            ) : (
              <div className="text-3xl font-bold gradient-accent bg-clip-text text-transparent">
                {formatNaira(price)}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Clock className="h-4 w-4" />
              {rentalDuration}
            </div>
          </div>

          {/* Referral Code Section - Only show on Android, not iOS */}
          {showReferralCode && (
            <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm transition-colors w-full py-2 px-3 rounded-lg hover:bg-secondary/50 group">
                <Tag className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                <span className="text-muted-foreground group-hover:text-foreground">Apply referral code</span>
                <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-transform ${promoOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 pb-2">
              {referralDiscount ? (
                <motion.div 
                  className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <code className="font-mono text-sm font-semibold text-green-700 dark:text-green-300">{referralDiscount.code}</code>
                    {referralDiscount.discountType === 'percentage' ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">-{referralDiscount.discountValue}%</span>
                    ) : (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">-{formatNaira(referralDiscount.discountAmount)}</span>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeCode} 
                    className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={referralInput}
                      onChange={(e) => {
                        setReferralInput(e.target.value.toUpperCase());
                        setValidationError(null);
                      }}
                      placeholder="Enter referral code"
                      className="font-mono text-sm uppercase tracking-widest"
                      onKeyDown={(e) => e.key === 'Enter' && !validating && validateCode()}
                      disabled={validating}
                    />
                    <Button 
                      onClick={validateCode} 
                      disabled={validating || !referralInput.trim()} 
                      variant="outline" 
                      size="sm"
                      className="px-4"
                    >
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  {validationError && (
                    <motion.div
                      className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400"
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{validationError}</span>
                    </motion.div>
                  )}
                </div>
              )}
            </CollapsibleContent>
            </Collapsible>
          )}

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
