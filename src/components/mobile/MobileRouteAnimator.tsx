import { ReactNode, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { getNavigationDirection } from "@/lib/navigationUtils";
import { usePlatform } from "@/hooks/usePlatform";

interface MobileRouteAnimatorProps {
  children: ReactNode;
}

export function MobileRouteAnimator({ children }: MobileRouteAnimatorProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isIOS, isNative } = usePlatform();
  const prevLocation = useRef(location.pathname);
  
  const direction = getNavigationDirection(prevLocation.current, location.pathname);
  prevLocation.current = location.pathname;

  // Check if we can go back (not on root routes)
  const canGoBack = location.pathname !== "/" && 
                    location.pathname !== "/movies" && 
                    location.pathname !== "/watchlist" && 
                    location.pathname !== "/profile";

  const handleDragEnd = async (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x > 100 && info.velocity.x > 200 && canGoBack) {
      if (isNative) {
        try {
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) {
          // Haptics not available
        }
      }
      navigate(-1);
    }
  };

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
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    },
  };

  const selectedVariant = variants[direction] || variants.tab;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        drag={canGoBack && isIOS ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0 }}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        initial={selectedVariant.initial}
        animate={selectedVariant.animate}
        exit={selectedVariant.exit}
        transition={{
          type: "tween",
          ease: "easeInOut",
          duration: 0.25,
        }}
        className="w-full"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
