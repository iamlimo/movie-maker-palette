import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";

const NativePlayerSetup = () => {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [platform, setPlatform] = useState<string>("");

  useEffect(() => {
    const checkSetup = async () => {
      // Check if on native platform
      if (!Capacitor.isNativePlatform()) {
        setPlatform("web");
        return;
      }

      const currentPlatform = Capacitor.getPlatform();
      setPlatform(currentPlatform);

      // Check network status
      try {
        // @ts-expect-error optional native plugin
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        // Listen to network changes
        Network.addListener(
          "networkStatusChange",
          (status: { connected: boolean }) => {
            setIsOnline(status.connected);
            if (!status.connected) {
              toast({
                title: "No Connection",
                description: "You are offline. Playback may be interrupted.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Connected",
                description: "Connection restored.",
              });
            }
          },
        );
      } catch (err) {
        console.warn("Network plugin not available");
      }

      // Video player plugin removed: no checks performed here.
    };

    checkSetup();
  }, [toast]);

  // This is a utility function - not meant to render UI
  // Usage: Check plugin availability in parent components
  return {
    isOnline,
    platform,
    isNative: Capacitor.isNativePlatform(),
  };
};

export default NativePlayerSetup;
