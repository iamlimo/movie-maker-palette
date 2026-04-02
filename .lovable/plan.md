

# iOS Netflix-Style Onboarding Screen

## Overview
Replace the current plain iOS onboarding screen in `Index.tsx` with a Netflix-inspired design using `ios_bg.png` as a tilted poster grid background, overlaid with gradient, logo, swipeable slides with copy, dot indicators, and prominent "Log In" + "Visit signaturetv.co" CTAs.

## Files to Modify

### 1. Copy uploaded image to public folder
- Copy `user-uploads://ios_bg.png` to `public/ios_bg.png`

### 2. `src/pages/Index.tsx` (lines 41-73)
Replace the current iOS onboarding block with:

- **Full-screen background**: `ios_bg.png` as a CSS `background-image` with a slight CSS `rotate(-10deg) scale(1.3)` transform to create the Netflix diagonal poster grid effect, covered by a dark gradient overlay (`bg-gradient-to-b from-black/80 via-black/60 to-black/90`)
- **Logo**: Signature TV logo at top-left (matching Netflix placement)
- **Auto-advancing slides** (3 slides, 4s interval) with content:
  1. "Premium Movies & Shows in just a few taps"
  2. "Watch exclusive content from top creators"  
  3. "New here? Visit signaturetv.co to create your account"
- **Dot indicators** below slides
- **"Log In" button**: Large, prominent, gradient-accent styled CTA navigating to `/auth`
- **Footer text**: "New to Signature TV? Create an account at signaturetv.co" -- plain text, no clickable link (Apple compliance)
- Use `useState` for slide index, `useEffect` for auto-advance timer
- Swipe gesture support via touch events (`onTouchStart`/`onTouchEnd`)

### 3. No new files
All logic stays in `Index.tsx` using existing React state/effects.

## Design Details

```text
┌──────────────────────────┐
│ [Logo]          [Log In] │  <- top bar
│                          │
│   ╔══════════════════╗   │
│   ║  ios_bg.png      ║   │  <- rotated poster grid
│   ║  (tilted ~10deg) ║   │     with dark overlay
│   ║                  ║   │
│   ╚══════════════════╝   │
│                          │
│   "Premium Movies &      │  <- slide text (fades)
│    Shows in just a       │
│    few taps"             │
│                          │
│        ● ○ ○             │  <- dot indicators
│                          │
│   [═══ Log In ═══════]   │  <- primary CTA button
│                          │
│   New to Signature TV?   │  <- plain text disclosure
│   Visit signaturetv.co   │
└──────────────────────────┘
```

- Responsive: works on iPhone and iPad
- No external links (Apple IAP compliance) -- signaturetv.co mentioned as plain text only
- Smooth CSS transitions between slides (opacity/transform)
- Safe area insets respected

