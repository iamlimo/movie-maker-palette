

# iOS Onboarding & Login-Gate Implementation

## Overview
Create a login-required flow for iOS where users must authenticate before accessing the catalog. This involves:
1. Removing the website reference text from the login screen
2. Creating an iOS-specific onboarding screen
3. Gating the home page (catalog) behind authentication on iOS

---

## Scope

| Platform | Changes |
|----------|---------|
| iOS (Capacitor) | Login-gated catalog + onboarding |
| Web | No changes |
| Android | No changes |

---

## Files to Modify (3 files total)

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Remove website reference text on iOS |
| `src/pages/Index.tsx` | Show onboarding screen instead of catalog for unauthenticated iOS users |
| `src/App.tsx` | No changes needed (routing already handles Auth page) |

---

## Detailed Changes

### 1. Auth Page - Remove Website Reference

**File:** `src/pages/Auth.tsx`

**Current iOS footer (lines 475-483):**
```tsx
{isIOS ? (
  <div className="text-center mt-6 space-y-2">
    <p className="text-sm font-medium text-foreground">
      Don't have an account?
    </p>
    <p className="text-sm text-muted-foreground">
      Accounts are created on the Signature TV website.
    </p>
  </div>
) : (
```

**Change to:** Remove the entire iOS footer block - no text about accounts or website.

```tsx
{!isIOS && (
  <p className="text-center text-sm text-muted-foreground mt-6">
    By signing up, you agree to our Terms of Service and Privacy Policy
  </p>
)}
```

Also update the description text (line 257-258) to be simpler:
- Current: "Log in with your existing Signature TV account to access videos you have already rented."
- New: "Log in to access your content."

---

### 2. Index Page - iOS Onboarding Screen

**File:** `src/pages/Index.tsx`

**Current behavior:** Shows catalog (Header, HeroSlider, MovieSections) to all users

**iOS Changes:** 
- Import `usePlatform` hook
- Check if user is not logged in AND is on iOS
- Show an appealing onboarding screen instead of the catalog
- After successful login, show the normal catalog

**Onboarding Screen Design:**

```text
┌────────────────────────────────────────┐
│                                        │
│           [Signature TV Logo]          │
│                                        │
│      Watch Premium Movies & Shows      │
│                                        │
│   Stream exclusive content from your   │
│   favorite creators. Access your       │
│   rented videos anytime, anywhere.     │
│                                        │
│         [  Log In to Continue  ]       │
│                                        │
│                                        │
│   ┌─────────────────────────────────┐  │
│   │  Background gradient/image     │  │
│   │  with cinematic feel           │  │
│   └─────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

**Implementation in Index.tsx:**

```tsx
import { usePlatform } from "@/hooks/usePlatform";

const Index = () => {
  const { isIOS } = usePlatform();
  const { user, loading: authLoading } = useAuth();
  
  // iOS Onboarding: Show login-gate for unauthenticated users
  if (isIOS && !user && !authLoading) {
    return (
      <div className="min-h-screen gradient-hero flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8">
          <img 
            src="/signature-tv-logo.png" 
            alt="Signature TV" 
            className="h-16 w-auto"
          />
        </div>
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground text-center mb-4">
          Watch Premium Movies & Shows
        </h1>
        
        {/* Description */}
        <p className="text-muted-foreground text-center max-w-sm mb-8">
          Stream exclusive content from your favorite creators. 
          Access your rented videos anytime, anywhere.
        </p>
        
        {/* Login CTA */}
        <Button 
          onClick={() => navigate('/auth')}
          className="gradient-accent text-primary-foreground font-semibold px-8 py-3 text-lg shadow-glow"
        >
          Log In to Continue
        </Button>
      </div>
    );
  }
  
  // Rest of the normal catalog view...
};
```

---

## Implementation Summary

| Change | Description |
|--------|-------------|
| Remove website text | Delete "Accounts are created on the Signature TV website" from Auth.tsx iOS footer |
| Simplify iOS login description | Change to "Log in to access your content" |
| Add iOS onboarding gate | Show login screen before catalog on iOS for unauthenticated users |
| Appealing design | Gradient background, logo, clear messaging, single CTA button |

---

## What Will NOT Change

- Web app behavior (unchanged)
- Android app behavior (unchanged)
- Authenticated iOS users see normal catalog
- Backend/database (unchanged)
- Existing iOS pricing/payment hiding (already done)

---

## Success Criteria

1. iOS login screen has no website references or external links
2. Unauthenticated iOS users see onboarding screen, not catalog
3. "Log In to Continue" button navigates to login page
4. After successful login, users see the full catalog
5. Web and Android remain completely unchanged

