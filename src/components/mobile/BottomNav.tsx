import { Home, Search, Film, User, Wallet } from "lucide-react";
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
  { icon: Wallet, label: "Wallet", path: "/wallet" },
];

export function BottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isNative } = usePlatform();

  // Hide bottom nav during onboarding screen on native platforms (iOS and Android)
  if (isNative && !user && !authLoading && location.pathname === "/") {
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
      <div className="grid grid-cols-5 h-16 px-4 pb-[env(safe-area-inset-bottom)] gap-2">
        {navItems.map((item) => {
          const isProfileTab = item.path === "/profile" || item.path === "/wallet";
          const targetPath =
            isProfileTab && !user && !authLoading ? "/auth" : item.path;

          return (
            <NavLink
              key={item.path}
              to={targetPath}
              onClick={handleTabPress}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[60px] relative w-full"
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
          );
        })}
      </div>
    </nav>
  );
}
