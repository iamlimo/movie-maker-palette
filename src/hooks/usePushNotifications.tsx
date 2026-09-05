import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import {
  PushNotifications,
  type PushNotificationSchema,
  type ActionPerformed,
  type Token,
} from "@capacitor/push-notifications";
import { FCM as FCMBase } from "@capacitor-community/fcm";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FCM = FCMBase as any;
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mapPushDataToRoute } from "@/lib/pushNavigation";

function deviceType(): "ios" | "android" | "unknown" {
  if (!Capacitor.isNativePlatform()) return "unknown";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("push_device_tokens") as any).upsert(
    {
      user_id: userId,
      token,
      platform: deviceType,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );


  if (error) {
    // Never crash the app for token registration errors.
    console.error("Failed to upsert push token:", error);
    return;
  }

  // A device can only belong to one account at a time: retire the same token
  // registered under any other user.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("push_device_tokens") as any)
    .update({ is_active: false })
    .eq("token", token)
    .neq("user_id", userId);
}

/**
 * Resolve the FCM registration token.
 * - Android: the token returned by @capacitor/push-notifications IS the FCM token.
 * - iOS: the plugin returns the raw APNs token, so we ask @capacitor-community/fcm
 *   for the Firebase token instead (falls back to APNs token if unavailable).
 */
async function resolveFcmToken(nativeToken: string): Promise<string> {
  if (deviceType() !== "ios") return nativeToken;
  try {
    const result = await FCM.getToken();
    const fcmToken = typeof result === "string" ? result : result?.token;
    if (typeof fcmToken === "string" && fcmToken) return fcmToken;
  } catch (err) {
    console.error("FCM.getToken failed, falling back to APNs token:", err);
  }
  return nativeToken;
}

export function usePushNotifications() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const initializedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const pendingRouteRef = useRef<string | null>(null);

  // Keep the latest user id available to listeners registered once per launch.
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (loading) return;
    if (!user?.id) return;

    // Once permissions are granted and listeners are attached, a session change
    // just needs the current token re-saved against the new user.
    if (initializedRef.current) {
      void (async () => {
        try {
          const result = await FCM.getToken();
          const token = typeof result === "string" ? result : result?.token;
          if (typeof token === "string" && token) {
            await upsertDeviceToken({
              token,
              deviceType: deviceType(),
              userId: user.id,
            });
          }
        } catch (err) {
          console.error("Re-registering push token failed:", err);
        }
      })();
      return;
    }

    initializedRef.current = true;
    const listeners: Array<{ remove: () => void }> = [];

    void (async () => {
      try {
        // registration -> token available (APNs on iOS, FCM on Android)
        listeners.push(
          await PushNotifications.addListener(
            "registration",
            async (token: Token) => {
              const userId = userIdRef.current;
              if (!userId || !token?.value) return;
              const fcmToken = await resolveFcmToken(token.value);
              await upsertDeviceToken({
                token: fcmToken,
                deviceType: deviceType(),
                userId,
              });
            },
          ),
        );

        listeners.push(
          await PushNotifications.addListener(
            "registrationError",
            (err: unknown) => {
              console.error("Push registration error:", err);
            },
          ),
        );

        // Foreground delivery: system tray handles background/killed states.
        listeners.push(
          await PushNotifications.addListener(
            "pushNotificationReceived",
            (notification: PushNotificationSchema) => {
              const data = (notification?.data ?? {}) as Record<string, unknown>;
              if (String(data.silent ?? "") === "true") return;
              // Foreground notifications are not auto-displayed; nothing to do
              // beyond letting the app know one arrived.
              console.info("Push received in foreground:", notification.title);
            },
          ),
        );

        // Background / cold-start tap -> deep link into the app.
        listeners.push(
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action: ActionPerformed) => {
              const data = (action?.notification?.data ?? {}) as Record<
                string,
                unknown
              >;
              const route = mapPushDataToRoute({
                target_screen:
                  typeof data.target_screen === "string"
                    ? data.target_screen
                    : undefined,
                entity_id:
                  typeof data.entity_id === "string" ? data.entity_id : undefined,
              });
              if (!route) return;
              pendingRouteRef.current = route;
              navigate(route);
            },
          ),
        );

        // Ask for permission, then register with APNs/FCM.
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          console.info("Push permission not granted:", permission.receive);
          return;
        }

        await PushNotifications.register();
        await PushNotifications.removeAllDeliveredNotifications().catch(
          () => undefined,
        );

        // Android channel so background notifications show reliably.
        if (deviceType() === "android") {
          await PushNotifications.createChannel({
            id: "signature_tv_default",
            name: "Signature TV",
            description: "New releases, rentals and account updates",
            importance: 5,
            visibility: 1,
          }).catch((err) => console.error("createChannel failed:", err));
        }
      } catch (err) {
        console.error("Push notification setup failed:", err);
      }
    })();

    return () => {
      listeners.forEach((l) => l.remove());
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);
}
