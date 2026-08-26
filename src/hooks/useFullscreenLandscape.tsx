import { useEffect, type RefObject } from "react";

interface Options {
  /** Element to request browser fullscreen on (web only). */
  containerRef?: RefObject<HTMLElement | null>;
  /** When false, the hook is a no-op. */
  enabled?: boolean;
}

/**
 * We intentionally do not auto-rotate or force landscape for rented video playback.
 *
 * Netflix-style mobile playback keeps the player in its natural portrait layout and
 * lets users manually choose fullscreen if they want a larger viewing surface.
 * This creates a less intrusive experience on iOS/Android Capacitor apps.
 */
export function useFullscreenLandscape({ enabled = false }: Options) {
  useEffect(() => {
    if (!enabled) return;

    // Intentionally no-op: do not lock the device or browser to landscape.
    // Manual fullscreen remains opt-in and should be triggered by a user gesture.
  }, [enabled]);
}

export default useFullscreenLandscape;