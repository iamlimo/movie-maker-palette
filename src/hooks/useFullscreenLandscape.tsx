import { useEffect, type RefObject } from "react";
import { Capacitor } from "@capacitor/core";

interface Options {
  /** Element to request browser fullscreen on (web only). */
  containerRef?: RefObject<HTMLElement | null>;
  /** When false, the hook is a no-op. */
  enabled?: boolean;
}

/**
 * Locks the screen to landscape and (on web) requests fullscreen on the
 * provided element while mounted. Restores on unmount.
 *
 * Native (iOS/Android via Capacitor): uses @capacitor/screen-orientation.
 * Web: uses Fullscreen API + Screen Orientation API. Falls back silently
 * on platforms that don't support it (e.g. iOS Safari).
 */
export function useFullscreenLandscape({ containerRef, enabled = true }: Options) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let lockedNative = false;
    let lockedWebOrientation = false;
    let enteredFullscreen = false;

    const enter = async () => {
      // Native: lock orientation via Capacitor plugin
      if (Capacitor.isNativePlatform()) {
        try {
          const { ScreenOrientation } = await import("@capacitor/screen-orientation");
          await ScreenOrientation.lock({ orientation: "landscape" });
          if (!cancelled) lockedNative = true;
        } catch (err) {
          console.warn("[useFullscreenLandscape] native lock failed", err);
        }
        return;
      }

      // Web: request fullscreen on container
      const el = containerRef?.current;
      if (el && typeof el.requestFullscreen === "function") {
        try {
          await el.requestFullscreen();
          if (!cancelled) enteredFullscreen = true;
        } catch {
          /* user-gesture or permissions issue – ignore */
        }
      }

      // Web: best-effort orientation lock (works on Android Chrome, no-op on iOS Safari)
      try {
        const orientation = (screen as any)?.orientation;
        if (orientation && typeof orientation.lock === "function") {
          await orientation.lock("landscape");
          if (!cancelled) lockedWebOrientation = true;
        }
      } catch {
        /* unsupported – ignore */
      }
    };

    enter();

    return () => {
      cancelled = true;

      if (lockedNative) {
        import("@capacitor/screen-orientation")
          .then(({ ScreenOrientation }) => ScreenOrientation.unlock())
          .catch(() => {});
      }

      if (enteredFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (lockedWebOrientation) {
        try {
          (screen as any)?.orientation?.unlock?.();
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, containerRef]);
}

export default useFullscreenLandscape;