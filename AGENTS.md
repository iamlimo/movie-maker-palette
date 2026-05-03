# Signature TV - AI Agent Customization Guide

**Project**: Signature TV (Video Streaming Platform)  
**Status**: Production-Ready  
**Last Updated**: April 25, 2026

> This file helps AI coding agents (Copilot, Claude, etc.) understand the codebase architecture, conventions, and best practices to maximize productivity.

---

## 🎯 Project Overview

**Signature TV** is a production-grade video streaming platform with rental monetization built on:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Shadcn UI
- **Backend**: Supabase (PostgreSQL) + Deno Edge Functions
- **Mobile**: Capacitor (iOS/Android)
- **Payments**: Wallet (internal) + Paystack (external)
- **Video Storage**: Backblaze B2 (custom optimized)
- **Deployment**: Netlify (frontend) + Supabase (backend)

---

## 🏗️ Architecture Overview

### Key Components

#### 1. **Rental System** (Core Monetization)
- **Tables**: `rental_intents` (payment pending) → `rental_access` (access granted)
- **Payment Methods**: Wallet or Paystack
- **Access Tiers**: Movie (48hrs), Season (14 days), Episode (7 days)
- **Key Files**:
  - Database: [supabase/migrations/20260425000000_add_rental_intents_and_access.sql](supabase/migrations/20260425000000_add_rental_intents_and_access.sql)
  - Shared Logic: [supabase/functions/_shared/rental.ts](supabase/functions/_shared/rental.ts)

#### 2. **Payment Processing** (Wallet + Paystack)
- **Wallet Flow**: Direct balance deduction → Instant confirmation
- **Paystack Flow**: Redirect → Async webhook → Access granted
- **Key Functions**:
  - [supabase/functions/process-rental/](supabase/functions/process-rental/) - Main rental handler
  - [supabase/functions/wallet-payment/](supabase/functions/wallet-payment/) - Wallet payments
  - [supabase/functions/paystack-webhook/](supabase/functions/paystack-webhook/) - Webhook handler
  - [supabase/functions/verify-payment/](supabase/functions/verify-payment/) - Verification

#### 3. **Video Access Control** (Security-Critical)
- **Rules**: User must have valid, non-expired `rental_access` record
- **Enforcement**: Edge function validates before issuing presigned URLs
- **Key Functions**:
  - [supabase/functions/rental-access/](supabase/functions/rental-access/) - Access validation
  - [supabase/functions/get-video-url/](supabase/functions/get-video-url/) - URL signing

#### 4. **Frontend Rental UI** (User-Facing)
- **Hooks**: `useRentals()`, `useOptimizedRentals()`, `usePaystackRentalVerification()`
- **Components**: `OptimizedRentalCheckout.tsx`, `RentalButton.tsx`, `PaymentSuccessAnimation.tsx`
- **Pages**: [src/pages/Watch.tsx](src/pages/Watch.tsx) (video playback), [src/pages/Wallet.tsx](src/pages/Wallet.tsx)

#### 5. **Admin Dashboard** (Content & Financial Management)
- **30+ Pages** for content CRUD, user management, finance, rentals
- **Key Pages**: [src/pages/admin/Dashboard.tsx](src/pages/admin/Dashboard.tsx), [src/pages/admin/Finance.tsx](src/pages/admin/Finance.tsx), [src/pages/admin/Rentals.tsx](src/pages/admin/Rentals.tsx)

---

## 📊 Database Schema (Critical)

### Core Tables for Rentals

| Table | Purpose | Key Columns |
|-------|---------|-----------|
| `rental_intents` | Payment intent | user_id, movie_id/season_id/episode_id, rental_type, status, paystack_reference |
| `rental_access` | Access token | user_id, content_id, rental_type, status, expires_at |
| `wallets` | User balances | user_id, balance (in kobo) |
| `transactions_ledger` | Financial audit | wallet_id, amount, transaction_type, status |
| `profiles` | User info | user_id, name, email, wallet_balance |
| `movies` | Movie catalog | id, title, rental_price, video_url |
| `tv_shows` | Show catalog | id, title, description |
| `seasons` | Show seasons | tv_show_id, season_number |
| `episodes` | Individual episodes | season_id, episode_number, rental_price, video_url |

**Critical Constraints**:
- Only ONE active rental per user+content (prevents duplicates)
- `rental_access.expires_at > NOW()` defines active access
- All prices stored in **kobo** (÷ 100 for naira)

---

## 🔌 Edge Functions (Supabase Deno Functions)

### Rental Payment Processing

**[process-rental/](supabase/functions/process-rental/)**
- Entry point for all rental flows
- Takes: userId, contentId, contentType, price, paymentMethod, referralCode
- Returns: Rental details or error
- Handles: Price calculation, discount application, wallet/Paystack routing

**[wallet-payment/](supabase/functions/wallet-payment/)**
- Deducts from user wallet
- Creates transactions_ledger entry
- Updates wallets.balance atomically
- Failure → Rollback

**[paystack-webhook/](supabase/functions/paystack-webhook/)**
- Receives Paystack payment confirmations
- Verifies HMAC signature (critical security check)
- Updates rental_intent status to "paid"
- Prevents duplicate processing (idempotent)

**[verify-payment/](supabase/functions/verify-payment/)**
- Universal payment verification
- Checks payment status (pending/completed/failed)
- Returns rental_access details if successful
- Frontend polls this for payment confirmation

### Video Access & Security

**[rental-access/](supabase/functions/rental-access/)**
- Validates user has active rental_access
- Checks expiry timestamp
- Returns access token or denies
- Called before video delivery

**[get-video-url/](supabase/functions/get-video-url/)**
- Generates presigned URLs for video playback
- Integrates with Backblaze B2
- Prevents unauthorized direct access
- Tracks bandwidth usage per user

### Key Patterns

All functions in `_shared/rental.ts` export:
- `normalizeContentType()` - Validates content type
- `getDefaultRentalDurationHours()` - Returns duration (movies: 48, seasons: 336, episodes: 168)
- `hasActiveRentalAccess()` - Access check logic
- `buildRentalIntentPayload()` - Intent payload construction

---

## 🎣 Frontend Hooks (State Management)

### Rental Hooks

**[useRentals()](src/hooks/useRentals.tsx)**
- Fetches all active rentals for logged-in user
- Provides `checkAccess(contentId, contentType): boolean`
- Real-time updates via Supabase subscriptions
- Returns time remaining for each rental

**[useOptimizedRentals()](src/hooks/useOptimizedRentals.tsx)**
- Same as above but performance-optimized
- Memoized access checks
- Reduced subscription traffic
- Use in frequently-accessed components (video players)

**[usePaystackRentalVerification()](src/hooks/usePaystackRentalVerification.tsx)**
- `verifyPayment(rentalId, reference)` - Single verification
- `pollPaymentStatus()` - Polls up to 5 minutes
- Handles pending/completed/failed states
- Returns payment confirmation

**[useWallet()](src/hooks/useWallet.tsx)**
- Fetches wallet balance
- `canAfford(amount): boolean` - Check if user can afford rental
- `refreshWallet()` - Force refresh from DB
- Real-time balance updates via subscriptions

### Usage Pattern

```typescript
// In a component
const { rentals, checkAccess } = useOptimizedRentals();
const canWatch = checkAccess(movieId, 'movie');

if (canWatch) {
  // Show "Watch Now"
} else {
  // Show "Rent" button
}
```

---

## 🖥️ Frontend Components (UI)

### Payment Components

**[OptimizedRentalCheckout.tsx](src/components/OptimizedRentalCheckout.tsx)**
- Complete checkout UI (3-step flow)
- Step 1: Display price, discount, total
- Step 2: Select payment method (wallet/Paystack)
- Step 3: Process payment, show success
- Handles all loading/error states

**[OptimizedRentalButton.tsx](src/components/OptimizedRentalButton.tsx)**
- Quick rental trigger component
- Shows "Rent" or "Watch Now" based on access
- One-click rental initiation

### Wallet Components

**[FundWalletModal.tsx](src/components/wallet/FundWalletModal.tsx)**
- Wallet top-up interface
- Integrates with Paystack for funding
- Step-by-step flow

**[WalletWidget.tsx](src/components/wallet/WalletWidget.tsx)**
- Displays current balance
- Positioned in header/navbar
- Auto-refreshes

### Video Player Components

**[VideoPlayer.tsx](src/components/VideoPlayer.tsx)** (Web)
- Video.js-based player
- HLS/DASH streaming support
- Subtitle support, quality switching
- Progress tracking

**[NativeVideoPlayer.tsx](src/components/NativeVideoPlayer.tsx)** (Mobile)
- Capacitor integration
- Platform-specific (iOS/Android)
- Full-screen support, resume playback

---

## 🛣️ Common Workflows

### User Wants to Rent a Movie

1. **Frontend**: User clicks "Rent Movie" button
2. **Hook**: `useOptimizedRentals()` checks current access
3. **Component**: Render `OptimizedRentalCheckout.tsx`
4. **User Choice**: Select payment method
5. **Wallet Path**:
   - Frontend calls `wallet-payment/` edge function
   - Function deducts from wallet balance
   - Returns success
   - Rental is instantly available
6. **Paystack Path**:
   - Frontend calls `process-rental/` edge function
   - Function generates Paystack auth URL
   - User redirected to Paystack
   - Paystack posts webhook to `paystack-webhook/` function
   - Frontend polls `verify-payment/` for confirmation
   - Access granted when payment confirmed
7. **Result**: `rental_access` record created, user sees "Watch Now"

### User Wants to Watch a Video

1. **Frontend**: Navigate to watch page with movie/episode ID
2. **Page**: [Watch.tsx](src/pages/Watch.tsx) checks rental access
3. **Hook**: `useOptimizedRentals()` validates access
4. **Player**: If access granted, render video player
5. **Player Init**: Calls `get-video-url/` function to get presigned URL
6. **Function**: Validates rental_access, returns signed URL with expiry
7. **Playback**: Video.js or NativeVideoPlayer plays content
8. **Tracking**: `useVideoProgress()` saves playback position

### Checking if User Can Access Content

```typescript
const { checkAccess } = useOptimizedRentals();

// Simple boolean check
if (checkAccess(contentId, 'movie')) {
  // Can watch
} else {
  // Cannot watch - show rent button
}

// Or check rentals array directly
const rental = rentals.find(r => r.content_id === contentId);
if (rental?.expires_at > new Date()) {
  // Access still valid
}
```

---

## 🧠 Development Conventions

### Naming Conventions

- **Component Files**: PascalCase (`OptimizedRentalCheckout.tsx`)
- **Hook Files**: useHookName format (`useRentals.tsx`)
- **Edge Functions**: kebab-case directories (`process-rental/`, `verify-payment/`)
- **Database Tables**: snake_case (`rental_intents`, `rental_access`)
- **Database Columns**: snake_case with type suffix (`expires_at`, `user_id`)

### Type Safety

- All API responses typed in [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) (auto-generated from Supabase)
- Custom types in [src/types/](src/types/) directory
- Use strict TypeScript (`tsconfig.json`: `strict: true`)

### State Management Pattern

```typescript
// Good: Extract business logic to hooks
const useRentalLogic = () => {
  const [rentals, setRentals] = useState([]);
  // ... logic here
  return { rentals, checkAccess };
};

// Good: Use hooks in components
const MyComponent = () => {
  const { rentals } = useRentalLogic();
  return <>...</>;
};

// Avoid: Business logic in components
const MyComponent = () => {
  const [rentals, setRentals] = useState([]);
  // ... lots of logic here - REFACTOR
};
```

### Error Handling

- All edge functions use try-catch with meaningful error messages
- Frontend components use `useToast()` for user feedback
- Log errors to browser console in dev, Supabase logs in production
- Never expose internal errors to users (security)

### Performance

- Use `useOptimizedRentals()` in frequently-accessed components
- Memoize expensive computations with `useMemo()`
- Use React Query (TanStack Query) for server state caching
- Batch database queries instead of N+1 queries
- Implement pagination for large result sets

---

## 🔐 Security Considerations

### Critical Security Rules

1. **Never Trust Frontend**: Always validate on backend (edge functions)
2. **Price Validation**: Backend must verify rental price matches content price
3. **User Validation**: Check user_id matches auth token in all functions
4. **Paystack Signature**: Always verify HMAC signature on webhooks (prevents forgery)
5. **RLS Policies**: Row-level security enforces user-specific data access
6. **URL Signing**: Video URLs are presigned and expire after rental expires

### Potential Vulnerabilities to Avoid

- ❌ Accepting price from frontend
- ❌ Skipping Paystack signature verification
- ❌ Issuing unlimited video URLs
- ❌ Allowing users to see other users' rentals
- ❌ Storing passwords (Supabase handles auth)
- ❌ Trusting payment success without webhook verification

---

## 📁 Directory Structure

```
src/
├── components/          # UI components
│   ├── OptimizedRentalCheckout.tsx    (Payment UI)
│   ├── VideoPlayer.tsx                (Web player)
│   ├── NativeVideoPlayer.tsx          (Mobile player)
│   ├── wallet/                        (Wallet components)
│   └── admin/                         (Admin-only components)
├── hooks/               # Business logic hooks (35+ hooks)
│   ├── useRentals.tsx
│   ├── useOptimizedRentals.tsx
│   ├── usePaystackRentalVerification.tsx
│   ├── useWallet.tsx
│   ├── useContentManager.tsx
│   └── ... (many more)
├── pages/               # Route pages
│   ├── Watch.tsx        (Video playback)
│   ├── Wallet.tsx       (Wallet UI)
│   ├── Profile.tsx
│   └── admin/           (30+ admin pages)
├── contexts/            # React context
│   └── AuthContext.tsx
├── types/               # TypeScript types
├── lib/                 # Utility functions
│   ├── priceUtils.ts    (kobo ↔ naira conversion)
│   ├── contentTypes.ts  (Content type validation)
│   ├── security.ts
│   └── ...
└── integrations/
    └── supabase/
        ├── client.ts    (Supabase initialization)
        └── types.ts     (Auto-generated from DB)

supabase/
├── functions/           # Deno edge functions (29 functions)
│   ├── process-rental/  (Main rental handler)
│   ├── wallet-payment/  (Wallet payment)
│   ├── paystack-webhook/(Webhook handler)
│   ├── verify-payment/  (Payment verification)
│   ├── rental-access/   (Access validation)
│   ├── get-video-url/   (URL signing)
│   └── ... (23+ more)
├── migrations/          # Database migrations (58+)
└── config.toml          # Supabase configuration
```

---

## 🚀 Build & Deployment

### Build Commands

```bash
npm run dev              # Start dev server (Vite)
npm run build            # Production build
npm run preview          # Preview production build
npm run deploy:functions # Deploy edge functions to Supabase
npm run deploy:mobile    # Deploy mobile apps (Capacitor)
```

### Deployment Targets

- **Frontend**: Netlify (automatic deployments on git push)
- **Edge Functions**: Supabase (via CLI: `supabase functions deploy`)
- **Mobile**: iOS App Store & Google Play (via Capacitor)

### Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key (frontend)

Required in Supabase secrets:
- `PAYSTACK_SECRET_KEY` - Paystack secret key (backend only)
- `BACKBLAZE_API_KEY_ID` - Backblaze auth
- `BACKBLAZE_API_KEY` - Backblaze auth
- `RESEND_API_KEY` - Email sending

---

## 📚 Documentation Map

See [CODEBASE_OVERVIEW.md](CODEBASE_OVERVIEW.md) for:
- Complete tech stack details
- Full database schema (25+ tables)
- All edge function descriptions
- Frontend architecture deep-dive
- Existing rental implementation details

See [QUICK_REFERENCE_GUIDE.md](QUICK_REFERENCE_GUIDE.md) for quick lookups on specific features.

---

## 🎓 Learning Path

### For New Contributors

1. Read this file (you are here)
2. Review [CODEBASE_OVERVIEW.md](CODEBASE_OVERVIEW.md) for architecture
3. Study [supabase/migrations/20260425000000_add_rental_intents_and_access.sql](supabase/migrations/20260425000000_add_rental_intents_and_access.sql) to understand DB
4. Read [supabase/functions/process-rental/index.ts](supabase/functions/process-rental/index.ts) for payment flow
5. Explore [src/hooks/useOptimizedRentals.tsx](src/hooks/useOptimizedRentals.tsx) for frontend state
6. Test: Navigate to movie page → Click Rent → Complete checkout

### For Fixing Issues

1. **Payment not processing**: Check `paystack-webhook/` logs in Supabase
2. **Access denied**: Check `rental_access` table for user + content
3. **UI not updating**: Check Supabase subscription in hook (real-time listener)
4. **Video not playing**: Check `get-video-url/` function error response
5. **Balance not accurate**: Check `wallets` table directly (source of truth)

---

## 🤖 AI Agent Tips

### When Implementing Rental Features

✅ **Always**:
- Check existing rental intent before creating new one
- Validate prices on backend (never trust frontend)
- Verify Paystack signatures on webhooks
- Use memoized access checks in components
- Add indexes to rental query columns

❌ **Never**:
- Modify rental prices from frontend
- Trust payment success without webhook
- Expose internal errors to users
- Issue unlimited video URLs
- Bypass RLS policies

### When Optimizing Performance

- Profile slow queries in Supabase dashboard
- Add indexes to frequently-queried columns
- Use `useOptimizedRentals()` instead of `useRentals()`
- Batch related queries instead of N+1
- Cache expensive computations with `useMemo()`

### When Debugging Payment Issues

Check in this order:
1. Supabase edge function logs (Settings → Functions)
2. Browser console (network tab for API calls)
3. Database records: `rental_intents`, `rental_access`, `payments`
4. Paystack dashboard (transaction history)
5. Email logs (if notifications involved)

---

## 💡 Next Optimization Opportunities

See [SOLUTION_SUMMARY.md](SOLUTION_SUMMARY.md) for completed tasks and [PROJECT_COMPLETION_SUMMARY.md](PROJECT_COMPLETION_SUMMARY.md) for delivery status.

Current production-ready features:
- ✅ Movie/Season/Episode rentals
- ✅ Wallet + Paystack payments
- ✅ Time-limited access (48hrs movies, 14d seasons, 7d episodes)
- ✅ Referral code discounts
- ✅ Admin rental analytics
- ✅ Video access control
- ✅ Real-time balance updates
- ✅ Webhook payment verification

Future enhancements:
- Subscription models (monthly unlimited)
- Batch rentals (rent multiple at once)
- Rental extensions (pay to extend)
- Advanced analytics
- Offline viewing (cached rentals)
- Family sharing (shared access)

---

## 📞 Support

For questions about:
- **Architecture**: See [CODEBASE_OVERVIEW.md](CODEBASE_OVERVIEW.md)
- **Specific features**: Check relevant documentation files
- **Code examples**: Review the corresponding implementation files
- **Quick lookup**: Use [QUICK_REFERENCE_GUIDE.md](QUICK_REFERENCE_GUIDE.md)

**Last Updated**: April 25, 2026
