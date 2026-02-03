
# Apple-Safe Reader App Implementation for iOS

## Overview
Transform the iOS Capacitor app into a **login-only reader/player** that complies with Apple App Store Guideline 3.1.3(a). This means:
- No signup/account creation within the iOS app
- No pricing, rent, buy, or payment flows
- Users must have existing accounts (created on web)
- Users must have existing rentals (purchased on web)
- Visible Apple-required disclosure about external purchases

---

## Scope

| Platform | Changes |
|----------|---------|
| iOS (Capacitor) | Full compliance modifications |
| Web | No changes |
| Android | No changes |

---

## Files to Modify (8 files total)

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Remove signup tab, update messaging for iOS |
| `src/components/Header.tsx` | Hide "Create Account" button on iOS |
| `src/components/RentalButton.tsx` | Update iOS dialog with "Log in" button when no access |
| `src/pages/Profile.tsx` | Add Apple disclosure in Account tab for iOS |
| `src/pages/Wallet.tsx` | Hide "Fund Wallet" button on iOS |
| `src/components/wallet/WalletWidget.tsx` | Hide wallet balance link on iOS |
| `src/components/ContentHero.tsx` | Update iOS message text |
| `src/components/mobile/BottomNav.tsx` | Already updated (no changes needed) |

---

## Detailed Changes

### 1. Auth Page - Remove Signup on iOS

**File:** `src/pages/Auth.tsx`

**Current State:** Has two tabs - "Sign In" and "Sign Up" with full registration flow

**iOS Changes:**
- Remove the entire Tabs component on iOS, show only login form
- Update title from "Welcome" to "Welcome to Signature TV"
- Update description from "Sign in to your account or create a new one" to specific iOS messaging
- Add helper text: "Log in with your existing Signature TV account to access videos you have already rented."
- Add non-clickable web signup hint at bottom: "Don't have an account? Accounts are created on the Signature TV website."
- Remove "By signing up, you agree to..." text on iOS

```text
iOS Auth Screen Layout:
┌────────────────────────────────────────┐
│ [Logo]                                 │
│ Welcome to Signature TV                │
│                                        │
│ Log in with your existing Signature    │
│ TV account to access videos you have   │
│ already rented.                        │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Email                              │ │
│ │ [________________]                 │ │
│ │ Password                           │ │
│ │ [________________]                 │ │
│ │                                    │ │
│ │ [       Log In       ]             │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Don't have an account?                 │
│ Accounts are created on the            │
│ Signature TV website.                  │
└────────────────────────────────────────┘
```

---

### 2. Header - Hide "Create Account" on iOS

**File:** `src/components/Header.tsx`

**Current State:** When not logged in, shows "Log In" and "Create Account" buttons

**iOS Changes:**
- Wrap "Create Account" buttons (desktop and mobile) with `!isIOS` condition
- Keep "Log In" button visible
- Already imports `usePlatform` hook

**Lines to modify:**
- Lines 219-226: Desktop "Create Account" button - wrap with `{!isIOS && ...}`
- Lines 322-329: Mobile menu "Create Account" button - wrap with `{!isIOS && ...}`

---

### 3. RentalButton - Update iOS No-Access Dialog

**File:** `src/components/RentalButton.tsx`

**Current State:** Shows dialog with "Access Information" and "OK" button when iOS user doesn't have access

**iOS Changes:**
- Change dialog title from "Access Information" to "Rental Required"
- Update message to: "This content is available to users who have already rented it. Please log in with your existing Signature TV account."
- Change button from "OK" to "Log In" that navigates to `/auth`
- Add second button "Close" to dismiss dialog

**Lines to modify:** Lines 293-331 (iOS dialog section)

```tsx
// Updated iOS dialog content
<DialogTitle>Rental Required</DialogTitle>
<DialogDescription>
  This content is available to users who have already rented it.
  {user ? (
    " Your current account does not have access to this content."
  ) : (
    " Please log in with your existing Signature TV account."
  )}
</DialogDescription>
<DialogFooter className="flex flex-col gap-2">
  {!user && (
    <Button onClick={() => navigate('/auth')} className="w-full">
      Log In
    </Button>
  )}
  <Button variant="outline" onClick={() => setShowIOSDialog(false)} className="w-full">
    Close
  </Button>
</DialogFooter>
```

---

### 4. Profile Page - Add Apple Disclosure

**File:** `src/pages/Profile.tsx`

**Current State:** Has Account tab with security info and danger zone

**iOS Changes:**
- Add Apple disclosure card in the Account tab (before Danger Zone)
- Non-clickable informational text

**Add after Account Security card (around line 852), before Danger Zone:**

```tsx
{/* Apple Disclosure - iOS Only */}
{isIOS && (
  <Card className="card-hover border-primary/20 bg-primary/5">
    <CardHeader>
      <CardTitle className="flex items-center space-x-2 text-sm">
        <Info size={16} />
        <span>About This App</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Video rentals are purchased outside of the iOS app. 
        This app provides access to content already rented by users.
      </p>
    </CardContent>
  </Card>
)}
```

---

### 5. Wallet Page - Hide Fund Wallet on iOS

**File:** `src/pages/Wallet.tsx`

**Current State:** Shows wallet balance and "Fund Wallet" button

**iOS Changes:**
- Import `usePlatform` hook
- Hide "Fund Wallet" button on iOS
- Optionally show informational message about external funding

**Modify lines 58-64:**
```tsx
{!isIOS && (
  <Button 
    onClick={() => setIsFundModalOpen(true)}
    className="w-full sm:w-auto gradient-accent..."
  >
    <Plus className="h-4 w-4 mr-2" />
    Fund Wallet
  </Button>
)}
{isIOS && (
  <p className="text-sm text-muted-foreground">
    Wallet funding is available on the Signature TV website.
  </p>
)}
```

---

### 6. WalletWidget - Hide on iOS (Header)

**File:** `src/components/wallet/WalletWidget.tsx` (check if exists)

**Current behavior in Header.tsx:** Lines 127-135 show wallet balance button

**iOS Changes in Header.tsx:**
- Wrap the wallet Link/Button with `!isIOS` condition since wallet funding is not available on iOS

---

### 7. ContentHero - Update iOS Message

**File:** `src/components/ContentHero.tsx`

**Current State:** Shows "To rent this content, visit signaturetv.com in your browser"

**iOS Changes:**
- Update message to be more reader-app compliant (no call to action)
- Change to: "Access is managed through your Signature TV account."

**Modify line 179**

---

## Text Changes Summary

| Location | Current Text | iOS Text |
|----------|--------------|----------|
| Auth title | "Welcome" | "Welcome to Signature TV" |
| Auth description | "Sign in to your account or create a new one" | Helper text about logging in |
| Auth footer | "By signing up, you agree to..." | Non-clickable signup hint |
| RentalButton dialog title | "Access Information" | "Rental Required" |
| RentalButton dialog message | "...Access is managed through your account on signaturetv.co" | "This content is available to users who have already rented it." |
| RentalButton dialog button | "OK" | "Log In" (if not logged in) + "Close" |
| ContentHero iOS message | "To rent this content, visit signaturetv.com in your browser" | "Access is managed through your Signature TV account." |
| Profile (new) | N/A | Apple disclosure text |

---

## Technical Implementation

### Platform Detection Pattern
All files will use the existing `usePlatform` hook:
```tsx
import { usePlatform } from '@/hooks/usePlatform';

const { isIOS } = usePlatform();
```

### Navigation for Login Button
```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
// In button: onClick={() => navigate('/auth')}
```

---

## What Will NOT Change

- Android app behavior (unchanged)
- Web app behavior (unchanged)  
- Backend/edge functions (unchanged)
- Database schema (unchanged)
- Existing iOS pricing hiding (already done)
- Existing iOS "More Information" button on cards (already done)

---

## Success Criteria

After implementation:
1. iOS app shows login-only auth screen (no signup)
2. iOS app shows "Rental Required" with "Log In" button when accessing content without entitlement
3. iOS app shows Apple disclosure in Profile/Account
4. iOS app hides all "Fund Wallet" buttons
5. iOS app has no "Create Account" or signup CTAs
6. iOS app has no pricing displayed anywhere (already done)
7. iOS app still allows users with existing rentals to watch content
8. Web and Android remain completely unchanged
