# Referral Code Feature - User Experience Guide

## What Users See

### Before Applying Code

```
┌─────────────────────────────────────┐
│     Rent [Movie Title]              │
│     Choose your payment method      │
├─────────────────────────────────────┤
│                                     │
│          ₦2,500.00                  │
│          📺 48 hours rental         │
│                                     │
│ 🏷️ Apply referral code ▼           │
│    (collapsed, doesn't overwhelm)   │
│                                     │
│ 💰 Wallet Balance                   │
│        ₦10,000.00                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💰 Pay ₦2,500.00 with Wallet    │ │
│ │ 💳 Pay ₦2,500.00 with Card      │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### After Expanding Code Section

```
┌─────────────────────────────────────┐
│ 🏷️ Apply referral code ▲            │
├─────────────────────────────────────┤
│                                     │
│ ┌──────────────────────────────────┐│
│ │ SAVE20         [Apply]           ││
│ │ Enter code     (Loader spinning) ││
│ └──────────────────────────────────┘│
│                                     │
│ ❌ Minimum purchase not met         │
│    Try a code for ₦1,000+          │
│                                     │
└─────────────────────────────────────┘
```

### After Valid Code Applied

```
┌─────────────────────────────────────┐
│     Rent [Movie Title]              │
│     Choose your payment method      │
├─────────────────────────────────────┤
│                                     │
│        ₦2,500.00 (strikethrough)   │
│        ₦2,000.00 (final price)     │
│        ✅ 20% off applied          │
│        📺 48 hours rental          │
│                                     │
│ 🏷️ Apply referral code ▼           │
│                                     │
│    ✅ SAVE20  -20%  [✕]            │
│    (green background, easy remove)  │
│                                     │
│ 💰 Wallet Balance                   │
│        ₦10,000.00                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💰 Pay ₦2,000.00 with Wallet    │ │
│ │ 💳 Pay ₦2,000.00 with Card      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ✨ Add ₦2,000 for wallet deposit   │
│    (if needed)                      │
└─────────────────────────────────────┘
```

## User Journey Example

### Scenario 1: Wallet Payment with Code

1. **User sees rental page**
   - "Rent Movie - ₦2,500"
   - Clicks "Rent" button

2. **Bottom sheet opens**
   - Shows price: ₦2,500
   - Collapsible "Apply referral code" section

3. **User taps to expand referral section**
   - Clean input field appears
   - "Enter referral code" placeholder

4. **User types: "SAVE20"**
   - Auto-converts to uppercase
   - Field shows: "SAVE20"

5. **User taps "Apply" or presses Enter**
   - Loading spinner shows
   - 1-2 seconds validation

6. **Code validated ✓**
   - Price updates: ₦2,500 → ₦2,000
   - Green badge shows: "SAVE20 -20%"
   - Display: "Saving ₦500"

7. **User taps "Pay ₦2,000 with Wallet"**
   - Toast notification: "🎉 Payment Successful! You saved ₦500. Start watching now!"
   - Redirects to watch page

### Scenario 2: Card Payment with Code

1-6. **Same as above** (up to code validated)

7. **User taps "Pay ₦2,000 with Card"**
   - Toast: "✨ Discount Applied! Saving ₦500. Complete payment in popup"
   - Paystack opens with ₦2,000 (discounted amount)

8. **User completes payment**
   - Webhook processes payment

9. **Payment succeeds**
   - Toast: "🎬 Payment Successful! Ready to watch [Movie]. You saved ₦500!"
   - Redirects to watch page

### Scenario 3: Code Not Found

1-4. **User enters invalid code**

5. **Taps "Apply"**
   - Loading spinner

6. **Red error appears:**
   - ❌ "This referral code is not valid"
   - Input stays for user to try again

### Scenario 4: Already Used Code

1-4. **User has already used this code (max 1x per user)**

5. **Taps "Apply"**

6. **Red error appears:**
   - ❌ "You've already used this code 1 time"

### Scenario 5: Easy Code Change

1. **Original code applied (SAVE20, 20% off)**

2. **User wants to try different code**

3. **Clicks X button on green badge**
   - Code removed instantly
   - Input field appears again

4. **User enters new code: "SUMMER50"**
   - Repeats validation

## Visual Design Details

### Color Scheme:
- **Collapsed**: Gray text (non-intrusive)
- **Applied code**: Green background with darker green text
- **Error**: Red background with red text
- **Price highlight**: Gradient accent color

### Icons Used:
- 🏷️ Tag icon - Referral section
- ✅ Check mark - Code applied
- 📺 TV icon - Duration info
- 💰 Wallet icon - Balance
- ❌ X button - Remove code
- ❌ Alert circle - Errors
- 🔽 Chevron - Toggle section
- 🔄 Spinner - Loading

### Animations:
- **Section expand/collapse**: Smooth 200ms transition
- **Price update**: Fade out old, fade in new
- **Error message**: Slide down with fade-in
- **Code applied**: Scale up with spring effect
- **Button states**: Hover, active, disabled states

## Accessibility Features

- ✅ Keyboard support (Enter to apply code)
- ✅ Color-blind friendly (icons + colors)
- ✅ Touch-friendly button sizes (44x44px minimum)
- ✅ Clear error messages
- ✅ Loading states prevent double-clicks
- ✅ Mobile-optimized layout
- ✅ No horizontal scrolling needed

## Success Indicators

Users know code is working when:
1. ✅ Price updates immediately
2. ✅ Green badge appears with checkmark
3. ✅ Savings amount displays
4. ✅ Payment buttons update to new amount
5. ✅ Toast confirms "Discount Applied"
6. ✅ Success message shows savings in final confirmation

## Error Prevention

System prevents:
- ❌ Entering code twice (removed from input after apply)
- ❌ Using expired codes (blocked server-side)
- ❌ Using code beyond limits (blocked server-side)
- ❌ Modifying discount on client (all calculated server-side)
- ❌ Paying wrong amount (final amount sent to payment provider)

## Mobile Experience

- ✅ Bottom sheet format fits mobile screens
- ✅ Collapsible section doesn't take space initially
- ✅ Large touch targets (buttons, inputs)
- ✅ Font sizes readable without zoom
- ✅ Works on iOS, Android, browser
- ✅ Keyboard doesn't cover input field
- ✅ Single-column layout

## Performance

- ⚡ Code validation: 1-2 seconds (server network call)
- ⚡ Price update: Instant (client-side when code applied)
- ⚡ Payment processing: Standard (depends on payment provider)
- ⚡ No unnecessary re-renders
- ⚡ Minimal database queries

## Toast Notifications (Real-time Feedback)

**Input Phase:**
- Saving... (spinner)

**Success Phase:**
- "✨ Discount Applied! Saving ₦500"
- "🎉 Payment Successful! You saved ₦500"
- "🎬 Ready to watch [Title]. Saved ₦500!"

**Error Phase:**
- "This referral code is not valid"
- "This code has expired"
- "You've already used this code"
- "Minimum purchase required: ₦1,000"

## Why This UX Works

1. **Non-intrusive by default** - Code section collapsed
2. **Immediate feedback** - Real-time validation
3. **Clear communication** - Saves amount prominent
4. **Easy to change** - One-click removal
5. **Prevents errors** - Server-side validation
6. **Mobile-first** - Touch-friendly design
7. **Fast** - Quick validation (1-2 sec)
8. **Celebratory** - Emoji and colors for success

---

**Result:** Users get a smooth, appealing experience that makes them feel like they're getting a great deal! 🎉
