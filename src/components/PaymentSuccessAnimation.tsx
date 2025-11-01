import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useEffect } from "react";

interface PaymentSuccessAnimationProps {
  onComplete: () => void;
  title?: string;
}

export const PaymentSuccessAnimation = ({ 
  onComplete, 
  title = "Payment Successful!" 
}: PaymentSuccessAnimationProps) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", duration: 0.8 }}
        >
          <CheckCircle className="w-24 h-24 text-green-500" strokeWidth={2} />
        </motion.div>
        <motion.h2
          className="text-2xl font-bold text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {title}
        </motion.h2>
        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Enjoy your rental!
        </motion.p>
      </motion.div>
    </motion.div>
  );
};
