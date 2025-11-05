import { ReactNode, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getNavigationDirection } from "@/lib/navigationUtils";

interface MobileRouteAnimatorProps {
  children: ReactNode;
}

export function MobileRouteAnimator({ children }: MobileRouteAnimatorProps) {
  const location = useLocation();
  const prevLocation = useRef(location.pathname);
  
  const direction = getNavigationDirection(prevLocation.current, location.pathname);
  prevLocation.current = location.pathname;

  const variants = {
    forward: {
      initial: { x: "100%", opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: "-30%", opacity: 0 },
    },
    backward: {
      initial: { x: "-100%", opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: "30%", opacity: 0 },
    },
    tab: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    },
  };

  const selectedVariant = variants[direction] || variants.tab;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={selectedVariant.initial}
        animate={selectedVariant.animate}
        exit={selectedVariant.exit}
        transition={{
          type: "tween",
          ease: "easeInOut",
          duration: 0.3,
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
