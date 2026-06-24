import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { FCM } from "@capacitor-community/fcm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mapPushDataToRoute } from "@/lib/pushNavigation";

function deviceType(): "ios" | "android" | "unknown" {
  if (!Capacitor.isNativePlatform()) return "unknown";
  // Prefer platform ID from Capacitor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platform = (Capacitor as any)?.getPlatform?.();
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "unknown";
}

async function upsertDeviceToken(params: {
  token: string;
  deviceType: "ios" | "android" | "unknown";
  userId: string;
}) {
  const { token, deviceType, userId } = params;

  // RLS on push_device_tokens requires auth.uid() = user_id (or staff).
  // Supabase client auth session is what provides auth.uid().
  const { error } = await supabase.from("push_device_tokens").upsert({
    user_id: userId,
    token,
    device_type: deviceType,
    is_active: true,
    last_used_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    // Don't crash the app for token registration errors.
    console.error("Failed to upsert push token:", error);
  }
}

export function usePushNotifications() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (loading) return;

    const currentUserId = user?.id;
    if (!currentUserId) return;

    // Initialize listeners once per app launch.
    if (!registeredRef.current) {
      registeredRef.current = true;

      void (async () => {
        try {
          // Permission prompt (iOS; Android may be no-op depending on OS version)
          // @capacitor-community/fcm handles this internally where supported.
          await FCM.requestPermissionsAsync();

          const tokenResult = await FCM.getToken();
          const token = tokenResult?.token ?? tokenResult;

          if (typeof token === "string" && token) {
            const dt = deviceType();
            await upsertDeviceToken({
              token,
              deviceType: dt,
              userId: currentUserId,
            });
          }
        } catch (err) {
          console.error("FCM init failed:", err);
        }
      })();
    }

    // Listener for foreground messages
    const foregroundHandler = FCM.addListener("notification", (msg: any) => {
      const data = (msg?.data ?? msg?.notification ?? {}) as Record<
        string,
        unknown
      >;

      const targetScreen = typeof data.target_screen === "string" ? data.target_screen : undefined;
      const entityId = typeof data.entity_id === "string" ? data.entity_id : undefined;

      const route = mapPushDataToRoute({
        target_screen: targetScreen,
        entity_id: entityId,
      });

      if (route) navigate(route);
    });

    // Listener for token refresh
    const tokenRefresh = FCM.addListener("registration", async (res: any) => {
      const newToken = res?.token ?? res?.registrationToken ?? res;
      if (typeof newToken !== "string" || !newToken) return;

      const dt = deviceType();
      await upsertDeviceToken({
        token: newToken,
        deviceType: dt,
        userId: currentUserId,
      });
    });

    return () => {
      foregroundHandler.remove();
      tokenRefresh.remove();
    };
  }, [user?.id, loading, navigate]);
}
