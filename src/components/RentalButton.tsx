import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Loader2, Wallet, Clock, Zap, Gift, Check, AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRentals } from "@/hooks/useRentals";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { formatNaira } from "@/lib/priceUtils";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { RentalBottomSheet } from "./RentalBottomSheet";
import { usePlatform } from "@/hooks/usePlatform";
import { normalizeContentType, isRentableContentType, type ContentType } from "@/lib/contentTypes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RentalButtonProps {
  contentId: string;
  contentType: "movie" | "tv" | "season" | "episode" | "tv_show";
  price: number;
  title: string;
}

const RentalButton = ({
  contentId,
  contentType,
  price,
  title,
}: RentalButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkAccess, fetchRentals, activeRentals } = useRentals();
  const { balance, canAfford, formatBalance, refreshWallet } = useWallet();
  const { isIOS } = usePlatform();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card" | null>(
    null,
  );
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  
  // Referral code state for desktop
  const [referralInput, setReferralInput] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<{ code: string; codeId: string; discountType: 'percentage' | 'fixed'; discountValue: number; discountAmount: number } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Normalize content type for database queries
  const normalizedContentType: ContentType = normalizeContentType(contentType);

  // Prevent renting TV shows directly (users must rent seasons or episodes)
  const isRentable = isRentableContentType(normalizedContentType);

  const hasAccess = checkAccess(contentId, normalizedContentType);
  const isNative = Capacitor.isNativePlatform();
  const isMobileBrowser =
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !isNative;
  const shouldUseRedirect = isNative || isMobileBrowser;

  // Find active rental for countdown
  const activeRental = activeRentals.find(
    (r) =>
      r.content_id === contentId &&
      r.content_type === normalizedContentType &&
      r.status === "active",
  );

  // Countdown timer effect
  useEffect(() => {
    if (!activeRental?.expires_at) {
      setTimeRemaining("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(activeRental.expires_at).getTime();
      const remaining = expiresAt - now;

      if (remaining <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [activeRental]);

  const triggerHaptic = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.log("Haptic feedback not available");
      }
    }
  };

  const validateCode = async () => {
    if (!referralInput.trim()) return;
    if (!user) {
      setCodeError('Please sign in to use referral codes');
      return;
    }

    setValidatingCode(true);
    setCodeError(null);
    try {
      const code = referralInput.trim().toUpperCase();
      const { data, error } = await supabase
        .from('referral_codes')
        .select('id, code, discount_type, discount_value, max_uses, times_used, max_uses_per_user, min_purchase_amount, valid_until, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setCodeError('This referral code is not valid');
        return;
      }

      // Check expiry
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        setCodeError('This code has expired');
        return;
      }

      // Check max uses
      if (data.max_uses && data.times_used >= data.max_uses) {
        setCodeError('This code is no longer available');
        return;
      }

      // Check min purchase
      if (data.min_purchase_amount > 0 && price < data.min_purchase_amount) {
        setCodeError(`Minimum purchase required: ${formatNaira(data.min_purchase_amount)}`);
        return;
      }

      // Check per-user usage limit
      const { count: userUsageCount } = await supabase
        .from('referral_code_uses')
        .select('id', { count: 'exact', head: true })
        .eq('code_id', data.id)
        .eq('user_id', user.id);

      if (userUsageCount !== null && userUsageCount >= data.max_uses_per_user) {
        setCodeError(`You've already used this code ${data.max_uses_per_user} time${data.max_uses_per_user > 1 ? 's' : ''}`);
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
      setCodeError('Error validating code. Please try again.');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleRent = async (useWallet: boolean = false, referralCode?: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to rent content",
        variant: "destructive",
      });
      return;
    }

    // Prevent wallet payment if wallet hasn't loaded yet
    if (useWallet && isLoading) {
      toast({
        title: "Wallet Loading",
        description: "Please wait for your wallet to load",
        variant: "default",
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
    setPaymentMethod(useWallet ? "wallet" : "card");

    try {
      let data, error;

      // Try primary payment method
      try {
        const response = await supabase.functions.invoke("wallet-payment", {
          body: {
            contentId,
            contentType: normalizedContentType,
            price, // price already in kobo from database
            useWallet,
            ...(referralCode ? { referralCode } : {}),
          },
        });
        data = response.data;
        error = response.error;
      } catch (primaryError: any) {
        console.error("wallet-payment failed, trying fallback:", primaryError);

        // Fallback to create-payment for card payments only
        if (!useWallet) {
          const fallbackResponse = await supabase.functions.invoke(
            "create-payment",
            {
              body: {
                userId: user.id,
                contentId,
                contentType: normalizedContentType,
                price,
                ...(referralCode ? { referralCode } : {}),
              },
            },
          );
          data = fallbackResponse.data;
          error = fallbackResponse.error;
        } else {
          throw new Error(
            "Wallet payment service unavailable. Please try card payment.",
          );
        }
      }

      if (error) throw error;

      if (data.payment_method === "wallet") {
        // Wallet payment successful
        await fetchRentals();
        refreshWallet();
        await triggerHaptic();
        setShowBottomSheet(false);
        
        if (referralCode && data.discount_applied > 0) {
          toast({
            title: "🎉 Payment Successful!",
            description: `You saved ${formatNaira(data.discount_applied)}. Start watching now!`,
          });
        } else {
          toast({
            title: "Payment Successful!",
            description: `You can now watch ${title}`,
          });
        }
        
        // Redirect immediately to watch page for immersive fullscreen playback
        navigate(`/watch/${contentType}/${contentId}`);
      } else if (data.payment_method === "paystack" || data.authorization_url) {
        // Open Paystack checkout
        const authUrl = data.authorization_url;
        const paymentId = data.payment_id || data.id;
        const discountApplied = data.discount_applied || 0;

        // On mobile, redirect instead of popup
        if (shouldUseRedirect) {
          window.location.href = authUrl;
        } else {
          window.open(authUrl, "_blank", "width=500,height=700");
        }

        setShowBottomSheet(false);
        
        let toastTitle = "Payment Initiated";
        let toastDescription = shouldUseRedirect
          ? "Redirecting to payment..."
          : "Complete your payment in the popup window";
        
        if (referralCode && discountApplied > 0) {
          toastTitle = "✨ Discount Applied!";
          toastDescription = `Saving ${formatNaira(discountApplied)}. ${shouldUseRedirect ? "Complete payment to start watching" : "Proceed in popup"}`;
        }
        
        toast({
          title: toastTitle,
          description: toastDescription,
        });

        // Poll for payment completion
        const pollPayment = setInterval(async () => {
          try {
            const { data: paymentData } = await supabase.functions.invoke(
              "verify-payment",
              {
                body: { payment_id: paymentId },
              },
            );

            if (paymentData?.payment?.status === "completed") {
              clearInterval(pollPayment);
              await fetchRentals();
              await triggerHaptic();
              
              // Show success with discount info
              const discountInfo = paymentData.payment?.metadata?.discount_amount
                ? ` You saved ${formatNaira(paymentData.payment.metadata.discount_amount)}!`
                : '';
              
              toast({
                title: "🎬 Payment Successful!",
                description: `Ready to watch ${title}${discountInfo}`,
              });
              
              // Redirect immediately to watch page for immersive fullscreen playback
              navigate(`/watch/${contentType}/${contentId}`);
            }
          } catch (pollError) {
            console.error("Payment polling error:", pollError);
          }
        }, 3000);

        setTimeout(() => clearInterval(pollPayment), 300000);
      }
    } catch (error: any) {
      console.error("Rental error:", error);

      if (
        error.message?.includes("Insufficient") ||
        error.message?.includes("balance")
      ) {
        const priceInNaira = price / 100;
        toast({
          title: "Insufficient Balance",
          description: `You need ₦${priceInNaira.toLocaleString("en-NG", {
            minimumFractionDigits: 2,
          })} but have ${formatBalance()}`,
          variant: "destructive",
        });
      } else if (error.message?.includes("Active rental exists")) {
        toast({
          title: "Already Rented",
          description: "You already have an active rental for this content",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to initiate payment",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setPaymentMethod(null);
    }
  };

  if (hasAccess) {
    return (
      <div className="space-y-2">
        <Button 
          variant="default" 
          size="lg" 
          className="w-full touch-target"
          onClick={() => navigate(`/watch/${contentType}/${contentId}`)}
        >
          <Play className="h-5 w-5 mr-2" />
          Watch Now
        </Button>
        {/* Hide rental time remaining on iOS */}
        {!isIOS && timeRemaining && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeRemaining}
          </div>
        )}
      </div>
    );
  }

  // iOS without access: Show informational dialog per Apple App Store IAP guidelines (3.1.1)
  if (isIOS) {
    return (
      <>
        <Button
          variant="default"
          size="lg"
          className="w-full touch-target"
          onClick={() => setShowIOSDialog(true)}
        >
          <Play className="h-5 w-5 mr-2" />
          More Information
        </Button>

        {/* iOS Rental Required Dialog - Compliant with App Store 3.1.3(a) */}
        <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
          <DialogContent className="w-[90%] max-w-sm">
            <DialogHeader>
              <DialogTitle>Rental Required</DialogTitle>
              <DialogDescription className="text-base leading-relaxed pt-2">
                This content is available to users who have already rented it.
                {user ? (
                  " Your current account does not have access to this content."
                ) : (
                  " Please log in with your existing Signature TV account."
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex flex-col gap-2">
              {!user && (
                <Button
                  variant="default"
                  onClick={() => {
                    setShowIOSDialog(false);
                    window.location.href = '/auth';
                  }}
                  className="w-full"
                >
                  Log In
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowIOSDialog(false)}
                className="w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const rentalDuration =
    contentType === "season"
      ? "Full season access"
      : contentType === "episode"
      ? "48-hour rental"
      : "48-hour rental";

  const priceInNaira = price / 100;
  const canAffordRental = canAfford(price);
  
  // Calculate final price for desktop view with referral discount
  const finalPrice = referralDiscount ? Math.max(0, price - referralDiscount.discountAmount) : price;
  const canAffordFinal = canAfford(finalPrice);
  const savingsAmount = referralDiscount ? referralDiscount.discountAmount : 0;
  const savingsPercent = referralDiscount && referralDiscount.discountType === 'percentage' 
    ? referralDiscount.discountValue 
    : Math.round((savingsAmount / price) * 100);

  const handleOpenSheet = async () => {
    await triggerHaptic();
    // Refresh wallet balance to ensure latest balance is used for payment options
    await refreshWallet();
    setShowBottomSheet(true);
  };

  return (
    <>
      {/* Prevent renting TV shows directly - users must rent seasons or episodes */}
      {!isRentable ? (
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            This content is not available for direct rental.
            {normalizedContentType === 'tv' && (
              <span className="block mt-1">
                Browse individual seasons or episodes to rent.
              </span>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNaira(finalPrice)}</div>
              {referralDiscount && (
                <div className="text-sm line-through text-muted-foreground">{formatNaira(price)}</div>
              )}
              <div className="text-sm text-muted-foreground">{rentalDuration}</div>
            </div>

            {/* Wallet Balance Display */}
            {user && (
              <div className="text-center text-sm text-muted-foreground">
                Wallet Balance:{" "}
                <span className="font-medium">{formatBalance()}</span>
              </div>
            )}

            {/* Desktop Referral Code Section - Available on desktop browsers, hidden on native iOS apps */}
            {!isNative && !isMobileBrowser && (
              <div className="space-y-2 p-3 bg-secondary rounded-lg">
                {referralDiscount ? (
                  <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/30 rounded text-sm">
                    <div className="flex items-center gap-2 flex-1">
                      <Check className="h-4 w-4 text-green-600" />
                      <code className="font-mono font-semibold text-green-700 dark:text-green-300">{referralDiscount.code}</code>
                      {referralDiscount.discountType === 'percentage' ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">-{referralDiscount.discountValue}%</span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">-{formatNaira(referralDiscount.discountAmount)}</span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setReferralDiscount(null);
                        setReferralInput('');
                        setCodeError(null);
                      }} 
                      className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={referralInput}
                        onChange={(e) => {
                          setReferralInput(e.target.value.toUpperCase());
                          setCodeError(null);
                        }}
                        placeholder="Enter referral code"
                        className="font-mono text-sm uppercase tracking-widest"
                        onKeyDown={(e) => e.key === 'Enter' && !validatingCode && validateCode()}
                        disabled={validatingCode}
                      />
                      <Button 
                        onClick={validateCode} 
                        disabled={validatingCode || !referralInput.trim()} 
                        variant="outline" 
                        size="sm"
                        className="px-3"
                      >
                        {validatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                    {codeError && (
                      <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{codeError}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Main Rent Button - Opens bottom sheet on mobile, inline on desktop */}
            {isNative || isMobileBrowser ? (
              <Button
                onClick={handleOpenSheet}
                disabled={isLoading}
                variant="default"
                size="lg"
                className="w-full touch-target gradient-accent text-primary-foreground font-semibold"
              >
                <Play className="h-5 w-5 mr-2" />
                Rent for {formatNaira(price)}
              </Button>
            ) : /* Desktop - inline payment options */
            user && canAffordFinal ? (
              <div className="space-y-2">
                <Button
                  onClick={() => handleRent(true, referralDiscount?.code)}
                  disabled={isLoading}
                  variant="default"
                  size="lg"
                  className="w-full gradient-accent text-primary-foreground"
                >
                  {isLoading && paymentMethod === "wallet" ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="h-5 w-5 mr-2" />
                  )}
                  Pay with Wallet
                </Button>
                <Button
                  onClick={() => handleRent(false, referralDiscount?.code)}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  {isLoading && paymentMethod === "card" ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  Pay with Card
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {user && !canAffordFinal && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                    Add {formatNaira(finalPrice - balance)} to your wallet for instant
                    checkout
                  </div>
                )}
                <Button
                  onClick={() => handleRent(false, referralDiscount?.code)}
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
                  Rent for {formatNaira(finalPrice)}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Bottom Sheet */}
          <RentalBottomSheet
            isOpen={showBottomSheet}
            onClose={() => setShowBottomSheet(false)}
            contentTitle={title}
            price={price}
            walletBalance={balance}
            rentalDuration={rentalDuration}
            canAfford={canAffordRental}
            isLoading={isLoading}
            paymentMethod={paymentMethod}
            onRentWithWallet={(code) => handleRent(true, code)}
            onRentWithCard={(code) => handleRent(false, code)}
            showReferralCode={!(isNative && isIOS)}
          />
        </>
      )}
    </>
  );
};

export default RentalButton;
