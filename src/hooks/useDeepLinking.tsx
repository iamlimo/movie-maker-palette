import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parseDeepLink } from "@/lib/navigationUtils";

export function useDeepLinking() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any = null;

    const setupListener = async () => {
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
