import { Home, Search, Film, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
// import { motion } from "framer-motion";
// import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatform } from "@/hooks/usePlatform";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/movies" },
  { icon: Film, label: "Contents", path: "/watchlist" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isIOS } = usePlatform();

  // Hide bottom nav on iOS onboarding and login screens for unauthenticated users
  if (isIOS && !user && !authLoading && (location.pathname === "/" || location.pathname === "/auth")) {
    return null;
  }

  if (!isMobile) return null;

  const handleTabPress = async () => {
    // if (Capacitor.isNativePlatform()) {
    //   try {
    //     await Haptics.impact({ style: ImpactStyle.Light });
    //   } catch (error) {
    //     console.error('Haptics error:', error);
    //   }
    // }
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border bottom-nav-safe"
    >
      <div className="flex items-center justify-around h-16 px-2 pb-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleTabPress}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[60px] relative"
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon
                    className={`w-7 h-7 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
