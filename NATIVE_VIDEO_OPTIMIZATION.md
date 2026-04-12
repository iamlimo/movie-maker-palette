# iOS & Android Native Video Playback Optimization

## Architecture Overview

### 1. **Platform Detection & Routing** (`usePlatform` hook)
- Detects native platform (iOS/Android) vs web
- Used by Watch page to route to native vs web player

### 2. **Native Video Player** (`NativeVideoPlayer.tsx`)
Built for iOS and Android using Capacitor:

#### iOS Implementation:
- Uses `@capacitor-community/video-player` plugin
- Leverages AVPlayer (Apple's native video framework)
- Full hardware acceleration support
- AirPlay mirroring enabled
- Playback rates: 0.75x, 1x, 1.25x, 1.5x
- Native controls (play, pause, seek, volume)
- Picture-in-Picture disabled (content protection)

#### Android Implementation:
- Uses Capacitor Video Player plugin
- Hardware-accelerated MediaPlayer
- Optimal buffer sizes for mobile networks
- Playback rates: 1x, 1.25x, 1.5x, 2x (no slowdown)
- Native Android fullscreen
- Back button support

### 3. **Video Optimization Hook** (`useNativeVideoOptimization.tsx`)
Provides platform-specific optimizations:

```typescript
- optimizeVideoUrl(): Ensure range request support
- getBufferConfig(): Platform-specific buffer sizes
- requestFullscreen(): Platform-specific fullscreen API
- loadSubtitles(): Subtitle handling per platform
- canPlayCodec(): Video codec compatibility check
```

#### Buffer Configurations:
| Platform | Min Buffer | Max Buffer | Playback Rates |
|----------|-----------|-----------|---|
| iOS | 1MB | 5MB | 0.75x, 1x, 1.25x, 1.5x |
| Android | 512KB | 3MB | 1x, 1.25x, 1.5x, 2x |
| Web | 2MB | 10MB | Full range |

### 4. **Player Setup Utility** (`useNativePlayerSetup.tsx`)
Pre-initialization checks:
- Network status monitoring
- Plugin availability detection
- Platform identification
- Real-time online/offline detection

## Rental Flow Optimization for Native

### Pre-Rental:
1. User on MoviePreview/TVShowPreview page
2. RentalButton detects platform (web/native)
3. If native, shows platform-specific UX

### Payment (Same for Both):
1. Wallet or Card payment via Paystack
2. No platform differentiation

### Post-Payment Flow:

#### Web Players:
```
Payment ✓ → Navigate to /watch/{type}/{id} → VideoPlayer (HTML5)
```

#### Native Platforms (iOS/Android):
```
Payment ✓ → Navigate to /watch/{type}/{id} → Detect Platform → 
  NativeVideoPlayer initializes → 
  Plugin launches fullscreen player → 
  Returns control to app on exit
```

## Key Features

### 1. **Seamless Resume Playback**
- Saves last position before player exit
- Auto-resumes within 5-second threshold
- Tracks using `useVideoProgress` hook

### 2. **Platform-Specific Polish**
| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| Fullscreen | Native iOS | Native Android | Standard API |
| AirPlay | ✅ | ❌ | ❌ |
| PiP | 🔒 Disabled | 🔒 Disabled | 🔒 Disabled |
| Codec Support | H264, HEVC | H264, VP9 | H264 |
| Buffer Strategy | Large (for WiFi) | Small (for LTE) | Medium |

### 3. **Security & Protection**
- Download disabled (`controlsList="nodownload"`)
- Picture-in-Picture disabled
- Playback rate controls restricted per platform
- Time-limited signed URLs (24-hour expiry)
- No right-click context menu

### 4. **Network Resilience**
- Real-time network status monitoring
- User notifications on connection loss/restore
- Automatic retry on reconnection
- Graceful fallback to web player if plugin unavailable

### 5. **Completion Tracking**
- Marks content complete at 90%+ progress
- Updates watch history
- Suggests next episode (for TV shows)
- Premium analytics (view duration, device, platform)

## Integration Points

### Watch Page (`Watch.tsx`):
```typescript
const { isNative, isIOS, isAndroid } = usePlatform();

return (
  <>
    {isNative && (isIOS || isAndroid) ? (
      <NativeVideoPlayer {...props} />
    ) : (
      <VideoPlayer {...props} />
    )}
  </>
);
```

### RentalButton Flow:
Unchanged - Both player types handle the same rental data

## Setup Requirements

### Package Dependencies:
```json
{
  "@capacitor/core": "^6.x",
  "@capacitor-community/video-player": "^x.x",
  "@capacitor/network": "^6.x"
}
```

### Capacitor Config (`capacitor.config.ts`):
```typescript
const config: CapacitorConfig = {
  appId: 'com.signaturetv.app',
  appName: 'Signature TV',
  androidMinVersion: 21,
  iosPlatform: 'ios',
  plugins: {
    VideoPlayer: {
      showControls: true,
      showBackButton: true,
    }
  }
};
```

## Testing Checklist

- [ ] iOS: Rent movie → Play → Resume from saved position
- [ ] iOS: AirPlay mirroring works
- [ ] iOS: Exit app mid-playback → Reopen → Resumes
- [ ] Android: Rent episode → Play → Watch multiple episodes
- [ ] Android: Test on poor network → Shows errors gracefully
- [ ] Android: Back button exits player properly
- [ ] Web: Fallback player works on desktop
- [ ] Web: Fullscreen functions

## Performance Targets

- **iOS**: <1s from /watch tap to player initialization
- **Android**: <1.5s from /watch tap to player initialization
- **Web**: <500ms from /watch tap to HTML5 player ready
- **First frame**: <500ms on 5G, <2s on LTE
- **Seek accuracy**: ±200ms

## Error Handling

### Plugin Not Available:
Auto-fallback to web player with user notification:
```
"Native player unavailable, using web player"
```

### Network Errors:
- Disconnection: Toast notification + retry button
- No resume data: Start from beginning
- Expired rental: Access denied with purchase prompt

### Codec Compatibility:
- iOS: H264, HEVC
- Android: H264, VP9
- Fallback: Provide transcoded version if unsupported

## Future Enhancements

1. **Offline Playback**: Download for offline with expiry enforcement
2. **Adaptive Bitrate**: Switch quality based on network
3. **Spatial Audio**: Dolby Atmos support
4. **Advanced Subtitles**: SRT/ASS, font customization
5. **Chromecast**: Android casting support
6. **Picture-in-Picture**: Optional (with watermark)
