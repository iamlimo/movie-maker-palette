# TODO

## Player Controls Implementation Roadmap

### Step 1 — Wire core keyboard shortcuts + tap-to-toggle
- [ ] Add Spacebar play/pause keyboard handling (web) in `src/components/VideoPlayer.tsx`
- [ ] Ensure keyboard controls don’t trigger while focus is on inputs/menus
- [ ] Ensure tap/click on player surface toggles controls + play/pause where appropriate

### Step 2 — Buffered-region seek bar + hover tooltip
- [ ] Add buffered range visualization to seek bar UI (`src/components/VideoPlayerControls.tsx`)
- [ ] Add hover tooltip that shows target time (thumbnail fallback if no thumbnails exist)
- [ ] Implement buffered-aware seek constraints if desired (clamp to buffered end for mobile if we choose)

### Step 3 — Skip back/forward and replay-window logic
- [ ] Add `onSkipBack10s` and `onSkipForward30s` callbacks to controls
- [ ] Implement replay-window enable/disable logic in `src/components/VideoPlayer.tsx` (simple configurable window)

### Step 4 — Playback speed selector
- [ ] Add playback rate selector UI (0.5x–2x) in `src/components/VideoPlayerControls.tsx`
- [ ] Implement `videoRef.current.playbackRate = ...` in `src/components/VideoPlayer.tsx`

### Step 5 — Real subtitles switching
- [ ] Implement switching text tracks using `videoRef.current.textTracks` in `src/components/VideoPlayer.tsx`
- [ ] Wire subtitle availability from current content metadata where possible (or fall back to single `subtitleUrl`)

### Step 6 — Picture-in-Picture (PiP)
- [ ] Add PiP button to controls
- [ ] Implement PiP enter/exit + events in `src/components/VideoPlayer.tsx`

### Milestone 2 (separate) — Chromecast/AirPlay/DLNA
- [ ] Real Chromecast/AirPlay/DLNA integration (current cast is stub-only)
