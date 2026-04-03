

# Faster Animation + Parallax Effect for iOS Onboarding

## Changes

### 1. `src/index.css` — Speed up animation & add parallax layer keyframes

- Change `ios-bg-drift` duration reference from 25s to **12s** for faster movement
- Add more dramatic transform values for snappier motion
- Add a second `@keyframes ios-bg-parallax` for a foreground gradient layer that moves at a different speed, creating depth

```css
@keyframes ios-bg-drift {
  0%   { transform: rotate(-10deg) scale(1.3) translate(0, 0); }
  33%  { transform: rotate(-6deg) scale(1.4) translate(-4%, 3%); }
  66%  { transform: rotate(-12deg) scale(1.35) translate(3%, -2%); }
  100% { transform: rotate(-8deg) scale(1.45) translate(-2%, 4%); }
}

@keyframes ios-parallax-overlay {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(2%, -1.5%) scale(1.02); }
  100% { transform: translate(-1%, 2%) scale(1.01); }
}
```

### 2. `src/pages/Index.tsx` — Apply faster timing + parallax overlay

- Change animation duration from `25s` to `12s`
- Add a second semi-transparent overlay div between the background image and the gradient, animated with `ios-parallax-overlay` at a different speed (18s) to create parallax depth

```tsx
{/* Background */}
<div className="absolute inset-[-20%] bg-cover bg-center"
  style={{
    backgroundImage: 'url(/ios_bg.png)',
    animation: 'ios-bg-drift 12s ease-in-out infinite alternate',
  }}
/>
{/* Parallax overlay */}
<div className="absolute inset-0"
  style={{
    background: 'radial-gradient(ellipse at 30% 20%, rgba(237,137,54,0.08) 0%, transparent 60%)',
    animation: 'ios-parallax-overlay 18s ease-in-out infinite alternate',
  }}
/>
{/* Dark gradient */}
<div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
```

Two files modified. The background moves ~2x faster with more varied keyframes, and a subtle warm-toned radial gradient layer drifts at a different rate to produce a parallax depth effect.

