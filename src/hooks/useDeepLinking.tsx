import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { parseDeepLink } from "@/lib/navigationUtils";

export function useDeepLinking() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any = null;

    const setupListener = async () => {
      // Import @capacitor/app at runtime only on native platforms so Vite/Rollup
      // doesn't attempt to resolve it during web build.
      const { App: CapacitorApp } = await import("@capacitor/app");

      listener = await CapacitorApp.addListener("appUrlOpen", (data) => {
        const route = parseDeepLink(data.url);
        if (route) {
          navigate(route);
        }
      });

      // Check if app was opened with a URL
      const result = await CapacitorApp.getLaunchUrl();
      if (result?.url) {
        const route = parseDeepLink(result.url);
        if (route) {
          navigate(route);
        }
      }
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);
}
