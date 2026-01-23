import { Home, Search, Film, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/movies" },
  { icon: Film, label: "Contents", path: "/watchlist" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const isMobile = useIsMobile();

  const handleTabPress = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.log("Haptics not available");
      }
    }
  };

  if (!isMobile) return null;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border bottom-nav-safe will-change-transform"
      style={{ transform: 'translateZ(0)' }}
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
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 0.95,
                    opacity: isActive ? 1 : 0.6,
                  }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <item.icon
                    className={`w-7 h-7 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -inset-2 bg-primary/10 rounded-lg -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.div>
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
