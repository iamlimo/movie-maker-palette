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
  return <div className="w-full">{children}</div>;
}
