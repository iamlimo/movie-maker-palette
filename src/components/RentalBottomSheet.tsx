import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, Clock } from "lucide-react";
import { formatNaira } from "@/lib/priceUtils";

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
  onRentWithWallet: () => void;
  onRentWithCard: () => void;
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
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
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
            <div className="text-3xl font-bold gradient-accent bg-clip-text text-transparent">
              {formatNaira(price)}
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {rentalDuration}
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Wallet Balance</span>
            <span className="font-semibold">{formatNaira(walletBalance)}</span>
          </div>

          {/* Payment Options */}
          <div className="space-y-3">
            {canAfford && (
              <Button
                onClick={onRentWithWallet}
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
                Pay with Wallet
              </Button>
            )}

            <Button
              onClick={onRentWithCard}
              disabled={isLoading}
              variant={canAfford ? "outline" : "default"}
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
              Pay with Card
            </Button>
          </div>

          {/* Insufficient Balance Warning */}
          {!canAfford && (
            <motion.div
              className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              Add {formatNaira(price - walletBalance)} to your wallet for instant checkout
            </motion.div>
          )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
};
