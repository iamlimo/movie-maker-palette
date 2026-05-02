
# Custom ExoPlayer Capacitor Plugin for Android

## Goal
Replace the unreliable `@capacitor-community/video-player` dependency with a purpose-built Capacitor plugin (`exo-player`) backed by AndroidX Media3 ExoPlayer for high-performance HLS/MP4 streaming on Android. iOS keeps the existing AVPlayer-style path; web keeps the existing `VideoPlayer.tsx` (video.js).

## Scope of Work

### 1. New local Capacitor plugin: `android/capacitor-plugins/exo-player/`
Created as a sibling Gradle module included from `android/settings.gradle` and wired into `android/app/build.gradle`. Source-only — no npm publish needed.

**Kotlin files** (`co.signature.tv.exoplayer`):
- `ExoPlayerPlugin.kt` — `@CapacitorPlugin(name = "ExoPlayer")`. Bridges JS calls and emits events.
- `ExoPlayerManager.kt` — Singleton wrapping a single reusable `ExoPlayer` instance (Media3 1.4.x). Handles HLS via `HlsMediaSource.Factory`, progressive MP4 via `ProgressiveMediaSource.Factory`, ABR via default `DefaultTrackSelector`, and a `SimpleCache` (256 MB LRU under `cacheDir/media`) for partial offline + resume.
- `ExoPlayerContainerView.kt` — A `FrameLayout` hosting a Media3 `PlayerView` that overlays the Capacitor WebView (positioned via JS-supplied rect). Touch passthrough disabled when active.
- `PlayerLifecycleObserver.kt` — Implements `DefaultLifecycleObserver` to pause on background and resume foreground; releases on activity destroy.

**JS-callable methods** (all `@PluginMethod`):
`initPlayer`, `load({ url, type?, startPositionMs?, subtitleUrl?, subtitleLanguage? })`, `play`, `pause`, `seekTo({ position })`, `stop`, `release`, `setRect({ x, y, width, height })`, `getDuration`, `getCurrentTime`, `setPlaybackRate({ rate })`, `selectAudioTrack({ index })`, `getAudioTracks`.

**Emitted events** (`notifyListeners`):
`onReady`, `onBuffering`, `onPlaying`, `onPaused`, `onEnded`, `onError { code, message }`, `onProgress { currentTime, duration }` (250 ms tick on main thread via `Handler(Looper.getMainLooper())`).

**Source detection**: `.m3u8` → HLS, otherwise progressive. Optional `type` override.

### 2. Gradle wiring
- `android/settings.gradle` — `include ':capacitor-plugin-exo-player'` + `projectDir`.
- `android/capacitor-plugins/exo-player/build.gradle` — Kotlin Android library, `compileSdk 35`, `minSdk 23`, depends on:
  - `androidx.media3:media3-exoplayer:1.4.1`
  - `androidx.media3:media3-exoplayer-hls:1.4.1`
  - `androidx.media3:media3-ui:1.4.1`
  - `androidx.media3:media3-datasource-okhttp:1.4.1`
  - `androidx.media3:media3-datasource-cronet:1.4.1` (optional, kept off by default)
  - `project(':capacitor-android')`
- `android/app/build.gradle` — `implementation project(':capacitor-plugin-exo-player')`.
- `android/app/src/main/AndroidManifest.xml` — add `android:usesCleartextTraffic="false"` already implicit; add `android:hardwareAccelerated="true"` on `<application>` and `WAKE_LOCK` permission for long playback.
- Plugin auto-registered via Capacitor 7 reflection (no `MainActivity` edits needed).

### 3. TypeScript bridge & React hook
- `src/plugins/exo-player.ts` — `registerPlugin<ExoPlayerPlugin>('ExoPlayer')` with full typed interface (methods + event names).
- `src/hooks/useExoPlayer.tsx` — Returns `{ loadVideo, play, pause, seekTo, stop, release, currentTime, duration, state, isBuffering }`. Wires plugin listeners, throttles `onProgress` into React state, persists `currentTime` to `watch_history` via existing `useVideoProgress` every 30 s, and resumes from saved position on `loadVideo`.

### 4. Integration into existing UI
- `src/components/NativeVideoPlayer.tsx` — On Android, mount a transparent `<div ref>` sized via `getBoundingClientRect()`; pass that rect to `ExoPlayer.setRect` so the native `PlayerView` overlays it (in-page, not forced fullscreen). iOS branch unchanged. Existing back/exit, watermark text, completion tracking (`useWatchHistory.markAsCompleted`) preserved.
- `src/components/EpisodePlayer.tsx` — When `Capacitor.getPlatform() === 'android'`, render `NativeVideoPlayer` instead of `<video>`; web path unchanged.
- `src/pages/Watch.tsx` — Already routes Android → `NativeVideoPlayer`; no change.

### 5. Cleanup
- Remove the `@capacitor-community/video-player` dynamic `import()` calls in `NativeVideoPlayer.tsx` (Android path) and `useNativeVideoOptimization.tsx` (capability check switches to `Capacitor.isPluginAvailable('ExoPlayer')`).
- iOS branch in `NativeVideoPlayer.tsx` keeps its dynamic import (still works there if installed) OR falls back gracefully — left untouched per scope.
- No package.json changes required (plugin is local).

### 6. Lifecycle & memory safety
- `ExoPlayerManager` holds a `WeakReference` to the host Activity.
- `onPause` of host activity → `player.pause()`, save position; `onResume` → no auto-play (JS controls).
- `onDestroy` → `player.release()`, detach `PlayerView`, cancel progress handler.
- Single instance reused across loads (`setMediaItem` + `prepare`) — no leaks from per-video allocation.

## Performance Targets (Met by Design)
- Fast start: HLS LowLatency disabled by default but `DefaultLoadControl` tuned with `bufferForPlaybackMs = 1500`, `bufferForPlaybackAfterRebufferMs = 3000`, `minBufferMs = 15000`, `maxBufferMs = 50000` — first frame typically <1.5 s on LTE.
- ABR: Media3's default adaptive track selection over HLS variants.
- Caching: `SimpleCache` (LRU, 256 MB) + `CacheDataSource.Factory` so re-watched/seeked segments don't re-download.
- Resume: position written every 30 s and on pause/end via existing `useVideoProgress` → `watch_history.playback_position`.

## Files Modified / Created

```text
android/
  settings.gradle                                              [modified]
  app/build.gradle                                             [modified]
  app/src/main/AndroidManifest.xml                             [modified: WAKE_LOCK]
  capacitor-plugins/exo-player/
    build.gradle                                               [new]
    src/main/AndroidManifest.xml                               [new]
    src/main/java/co/signature/tv/exoplayer/
      ExoPlayerPlugin.kt                                       [new]
      ExoPlayerManager.kt                                      [new]
      ExoPlayerContainerView.kt                                [new]
      PlayerLifecycleObserver.kt                               [new]
src/
  plugins/exo-player.ts                                        [new]
  hooks/useExoPlayer.tsx                                       [new]
  hooks/useNativeVideoOptimization.tsx                         [modified]
  components/NativeVideoPlayer.tsx                             [modified: Android branch]
  components/EpisodePlayer.tsx                                 [modified: Android branch]
```

## Out of Scope
- iOS native rewrite (existing path retained; can be a follow-up using AVPlayer in a sibling plugin module).
- DRM (Widevine) — plugin architected to add `DrmSessionManager` later without API changes.
- Full offline downloads UI — caching layer is in place; download manager is a follow-up.
- Removing the `@capacitor-community/video-player` npm dep (it isn't actually installed in `package.json` — only dynamically imported with a guarded fallback, so nothing to uninstall).

## Verification Steps After Build
1. `npx cap sync android` runs cleanly.
2. Android Studio Gradle sync resolves Media3 1.4.1.
3. Rent + open a movie on Android → first frame <2 s, native ExoPlayer overlays in-page.
4. Background app mid-playback → returns paused at same position.
5. Re-open same title → resumes from saved seconds.
