

# Animate iOS Onboarding Background

## Change

Add a slow, continuous Ken Burns-style animation to the `ios_bg.png` background on the iOS onboarding screen -- a gentle zoom and pan that creates cinematic depth.

## File: `src/index.css`

Add a new `@keyframes ios-bg-drift` animation in the components layer:
- Slowly pans and zooms the background over ~25s
- Alternates between slight position shifts (e.g. translate + scale changes)
- Uses `infinite alternate` for a seamless back-and-forth loop

```css
@keyframes ios-bg-drift {
  0%   { transform: rotate(-10deg) scale(1.3) translate(0, 0); }
  50%  { transform: rotate(-8deg) scale(1.35) translate(-2%, 3%); }
  100% { transform: rotate(-12deg) scale(1.4) translate(2%, -2%); }
}
```

## File: `src/pages/Index.tsx` (line 82-88)

Replace the static `transform` style on the background div with the CSS animation class, removing the inline `transform` and applying the keyframe animation via a style property:

```tsx
<div
  className="absolute inset-[-20%] bg-cover bg-center"
  style={{
    backgroundImage: 'url(/ios_bg.png)',
    animation: 'ios-bg-drift 25s ease-in-out infinite alternate',
  }}
/>
```

Two files modified, no new files created. The result is a smooth, slow-moving background that adds cinematic life to the onboarding screen.

