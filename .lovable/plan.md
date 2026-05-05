# Fix: Bottom Nav Overlap + Auto-Fullscreen Landscape Playback

Two related fixes targeting the Watch experience across mobile web, Android (ExoPlayer), and iOS (AVPlayer).

## Problem 1 — Bottom nav blocks player controls

`BottomNav` is a `fixed bottom-0` 64px+safe-area bar rendered globally in `src/App.tsx`. On `/watch/:type/:id` it overlays the video controls (web `VideoPlayer`, native overlay in `NativeVideoPlayer`). `isBottomNavRoute()` in `src/lib/navigationUtils.ts` currently allows it everywhere except `/admin` and `/auth`.

**Fix:** Exclude `/watch` from `isBottomNavRoute()` so the bar is hidden on the watch page for every platform.

```ts
// src/lib/navigationUtils.ts
if (pathname.startsWith("/watch")) return false;
```

Then update `BottomNav` to consult `isBottomNavRoute(location.pathname)` and return `null` when false (currently it only checks the onboarding case). This guarantees both Header and BottomNav stay consistent.

## Problem 2 — Auto-launch fullscreen landscape on native + mobile web

Desired behavior the moment `Watch.tsx` mounts with a valid video:

- **Android (Capacitor + ExoPlayer):** lock orientation to landscape, hide system bars (immersive), expand the native `ExoPlayerContainerView` to cover the full screen. Restore portrait + bars on unmount / back.
- **iOS (Capacitor + AVPlayer / video-player plugin):** request landscape via `@capacitor/screen-orientation`; the AVPlayer plugin already presents fullscreen — ensure it's invoked immediately on load (not behind a tap) and orientation locks before presentation.
- **Mobile web:** on `Watch.tsx` mount, if `useIsMobile()` is true, call `containerRef.current.requestFullscreen()` on the `VideoPlayer` and `screen.orientation.lock('landscape')` (best-effort, wrapped in try/catch — Safari iOS will silently no-op, which is acceptable). Release on unmount.

### Implementation steps

1. **Add dependency:** `@capacitor/screen-orientation` (Capacitor 7 compatible). Run `npx cap sync` after install (user step).

2. **New hook `src/hooks/useFullscreenLandscape.tsx`:**
   - Detect platform via existing `usePlatform()` + `useIsMobile()`.
   - On mount: lock landscape (native via plugin, web via `screen.orientation.lock`), and on web request fullscreen on a passed-in element ref.
   - On Android: also call a new `setImmersive(true)` method on the ExoPlayer plugin (see step 4) and resize the native PlayerView to full screen (pass `{x:0,y:0,width:screen.width,height:screen.height}` to existing `setRect`).
   - On unmount: unlock orientation, exit fullscreen, restore immersive=false, restore previous rect.

3. **Wire hook into `Watch.tsx`:** call `useFullscreenLandscape({ containerRef, enabled: !!videoUrl })`. For web fallback, pass the `VideoPlayer`'s container ref (lift ref via a forwardRef wrapper or wrap `<VideoPlayer>` in a div ref we control). Simpler: wrap both branches in a `<div ref={watchRef} className="w-screen h-screen">` and target that for web fullscreen.

4. **Android ExoPlayer plugin additions** (`android/capacitor-plugins/exo-player/`):
   - `ExoPlayerPlugin.kt`: add `@PluginMethod fun setImmersive(call)` that on the UI thread sets `WindowInsetsControllerCompat(window, decorView).hide(systemBars())` and locks `activity.requestedOrientation = SCREEN_ORIENTATION_SENSOR_LANDSCAPE`. A matching `exitImmersive` restores `SCREEN_ORIENTATION_UNSPECIFIED` and shows bars.
   - Update `src/plugins/exo-player.ts` interface with `setImmersive({enabled})` and `setOrientation({mode})`.
   - In `NativeVideoPlayer.tsx`, on mount call `ExoPlayer.setImmersive({enabled:true})` then `setRect` with full window size (use `window.innerWidth/innerHeight * devicePixelRatio`). On back/unmount call the inverse.

5. **iOS:** add a small wrapper around the existing `@capacitor-community/video-player` (still used on iOS per current routing) that calls `ScreenOrientation.lock({orientation:'landscape'})` immediately before `play()`, and `unlock()` on dismissal/unmount. AVPlayer's built-in fullscreen UI then takes over. No native Swift changes needed.

6. **Mobile web `VideoPlayer.tsx`:** when `immersive` prop is true AND `useIsMobile()`, after the video element is ready trigger `containerRef.current.requestFullscreen()` and `screen.orientation.lock('landscape')` inside a user-gesture-safe path. Since `Watch.tsx` is reached via tap from the rent/play button, the gesture is preserved if we do it inside the same React event chain. For the autoplay case we'll attempt it in `onLoadedMetadata`; failures are swallowed (Safari).

7. **Cleanup + safety:**
   - Always wrap orientation/fullscreen calls in try/catch.
   - Restore portrait orientation on `Watch.tsx` unmount and on browser back.
   - Hide `BottomNav` (already covered by step 1) and Header on `/watch` to avoid layout reflow under the player on web.

## Files changed

```text
src/lib/navigationUtils.ts          # exclude /watch from bottom nav
src/components/mobile/BottomNav.tsx # respect isBottomNavRoute
src/components/Header.tsx           # hide on /watch
src/hooks/useFullscreenLandscape.tsx (new)
src/pages/Watch.tsx                 # use new hook, wrap in fullscreen container
src/components/VideoPlayer.tsx      # mobile-web auto fullscreen on mount
src/components/NativeVideoPlayer.tsx# call setImmersive + full-screen rect
src/plugins/exo-player.ts           # add setImmersive / setOrientation types
android/.../ExoPlayerPlugin.kt      # implement setImmersive / orientation
package.json                        # add @capacitor/screen-orientation
```

## Notes / caveats

- iOS Safari mobile web cannot programmatically lock orientation; the user will see fullscreen but rotation remains device-controlled. This is a platform limitation, not a bug.
- Capacitor sync (`npx cap sync android ios`) is required after the plugin and dependency changes — user must run this before the next native build.
