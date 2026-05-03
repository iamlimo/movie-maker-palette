# Signature TV - Comprehensive Codebase Overview

## 1. PROJECT STRUCTURE

### Root Level Organization
```
├── src/                      # Frontend application (React + TypeScript)
├── supabase/                 # Supabase backend (migrations + edge functions)
├── android/                  # Native Android app (Capacitor)
├── ios/                      # Native iOS app (Capacitor)
├── public/                   # Static assets
├── resources/                # App resources (icons, splash screens)
├── docs/                     # Documentation
└── [Configuration Files]     # Vite, Tailwind, PostCSS, ESLint configs
```

### src/ Directory Structure
```
src/
├── components/               # React UI components
│   ├── admin/               # Admin dashboard components
│   ├── mobile/              # Mobile-specific components
│   ├── wallet/              # Wallet UI components (FundWalletModal, TransactionHistory, WalletWidget)
│   ├── ui/                  # Shadcn UI components
│   ├── VideoPlayer.tsx, NativeVideoPlayer.tsx, OfflineVideoPlayer.tsx
│   ├── RentalButton.tsx, OptimizedRentalButton.tsx, OptimizedRentalCheckout.tsx
│   ├── PaymentSuccessAnimation.tsx
│   └── [Other display components]
├── hooks/                    # Custom React hooks (35+ hooks)
│   ├── useRentals.tsx       # Rental access & management
│   ├── useWallet.tsx        # Wallet balance & transactions
│   ├── useOptimizedRentals.tsx  # Optimized rental checking
│   ├── usePaystackRentalVerification.tsx  # Payment verification
│   ├── useContentManager.tsx    # Content fetching
│   ├── useVideoProgress.tsx     # Video playback tracking
│   ├── useOfflineVideo.tsx      # Offline support
│   ├── useFavorites.tsx, useWatchHistory.tsx
│   ├── usePushNotifications.tsx, useDeepLinking.tsx
│   └── [Many utility hooks]
├── pages/                    # Route pages
│   ├── admin/               # Admin dashboard pages (30 pages)
│   │   ├── Dashboard.tsx, Movies.tsx, TVShows.tsx, Users.tsx
│   │   ├── Finance.tsx, Wallets.tsx, Rentals.tsx
│   │   ├── ReferralCodes.tsx, PushNotifications.tsx
│   │   ├── TicketsList.tsx, JobApplications.tsx
│   │   └── [CRUD pages for content management]
│   ├── Index.tsx            # Home page
│   ├── Movies.tsx, TVShows.tsx, Genres.tsx
│   ├── Watch.tsx            # Video playback page
│   ├── Wallet.tsx           # Wallet page
│   ├── Profile.tsx          # User profile
│   ├── Auth.tsx, ResetPassword.tsx
│   └── [Public pages]
├── contexts/                 # React contexts
│   └── AuthContext.tsx      # Authentication & user profile management
├── types/                    # TypeScript type definitions
│   └── ticket.ts            # Ticket system types
├── integrations/            # Third-party integrations
│   └── supabase/
│       ├── client.ts        # Supabase client initialization
│       └── types.ts         # Auto-generated Supabase types
├── lib/                      # Utility functions
│   ├── priceUtils.ts        # Price formatting & calculations
│   ├── contentTypes.ts      # Content type helpers
│   ├── security.ts          # Security utilities
│   ├── capacitorStorage.ts  # Mobile storage abstraction
│   ├── backgroundSync.ts    # Background sync logic
│   └── [Other utilities]
└── assets/                   # Images, styles, fonts
```

### supabase/ Directory Structure
```
supabase/
├── functions/               # Deno edge functions (23 functions)
│   ├── process-rental/                    # Main rental processing
│   ├── verify-payment/                    # Payment verification
│   ├── verify-rental-payment/             # Rental-specific verification
│   ├── paystack-webhook/                  # Paystack webhook handler
│   ├── sync-paystack-payments/            # Payment sync service
│   ├── create-payment/                    # Payment creation
│   ├── wallet-payment/                    # Wallet payment processing
│   ├── initiate-wallet-funding/           # Wallet funding
│   ├── rental-access/                     # Access control enforcement
│   ├── content-upload/                    # Content management
│   ├── content-sections/, banners/, slider-items/  # CMS functions
│   ├── admin-user-management/, admin-wallet-adjustment/  # Admin functions
│   ├── send-push-notification/, send-ticket-notification/  # Notifications
│   ├── _shared/                           # Shared utilities & types
│   └── _utils/                            # Helper functions
├── migrations/              # 58+ database migrations
│   └── [Latest: 20260425000000_add_rental_intents_and_access.sql]
└── config.toml              # Supabase configuration
```

---

## 2. TECH STACK

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.x
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.x + PostCSS
- **UI Components**: Shadcn UI (Radix UI primitives)
- **Form Handling**: React Hook Form + Zod validation
- **State Management**: React Query 5.83.0 (TanStack Query)
- **Routing**: React Router DOM 6.30.1
- **Video Playback**: Video.js 8.23.7 + HLS streaming
- **Animations**: Framer Motion 12.23.12
- **Mobile Framework**: Capacitor 7.4.4 (Android & iOS)
- **Analytics**: Vercel Analytics & Speed Insights
- **PWA**: Vite PWA Plugin + Workbox
- **Icons**: Lucide React 0.462.0
- **Notifications**: Toast (Sonner & React Toaster)
- **Offline Support**: Service Workers + IndexedDB

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (JWT-based)
- **Edge Runtime**: Deno (Supabase Functions)
- **Storage**: Supabase Storage (+ Backblaze integration)
- **Real-time**: Supabase Realtime subscriptions
- **Payments**: Paystack integration
- **Notifications**: Push notifications via Capacitor

### Deployment & Infrastructure
- **Frontend Hosting**: Netlify
- **Backend Hosting**: Supabase
- **Video Hosting**: Backblaze B2
- **DNS/CDN**: Custom domain setup
- **Mobile Deployment**: iOS App Store & Google Play

---

## 3. DATABASE SCHEMA

### Core Tables

#### Users & Authentication
- **profiles**: User account information
  - `user_id` (UUID, FK to auth.users)
  - `name`, `email`, `phone_number`, `country`, `date_of_birth`
  - `wallet_balance` (integer in kobo)
  - `created_at`, `updated_at`

- **user_roles**: Role-based access control
  - `user_id` (UUID)
  - `role` (enum: 'user', 'admin', 'super_admin')

- **user_preferences**: User settings
  - Content preferences, theme settings, notification prefs

#### Content Management
- **movies**: Movie catalog
  - `id`, `title`, `description`, `genre_id`, `poster_url`, `video_url`
  - `rental_price`, `purchase_price` (in kobo)
  - `duration`, `released_at`, `created_by` (user_id)
  - RLS policies for visibility

- **tv_shows**: TV series information
  - Similar structure to movies, links to seasons

- **seasons**: TV show seasons
  - `tv_show_id`, `season_number`, `description`
  - Links to episodes

- **episodes**: Individual episodes
  - `season_id`, `episode_number`, `title`, `description`
  - `rental_price`, `video_url`, `duration`

- **genres**: Content categories
  - Lookup table for movie/show genres

- **cast_crew**: Actor/crew information
  - Tracks cast and crew members

#### Rental & Payment System (Primary Monetization)
- **rental_intents** (NEW - Latest Migration)
  - Unified intent for rental transactions
  - Supports: movies, seasons, episodes
  - `user_id`, `movie_id`/`season_id`/`episode_id`, `rental_type`
  - `price`, `currency` (default 'NGN'), `payment_method` ('wallet' or 'paystack')
  - `status` (enum: 'pending', 'paid', 'failed')
  - `paystack_reference`, `provider_reference`, `referral_code`
  - `discount_amount`, `expires_at`, `paid_at`, `failed_at`
  - **Constraints**: Only one active rental per user+content

- **rental_access** (NEW - Latest Migration)
  - Access tokens granted after successful payment
  - `user_id`, `content_id`, `rental_type`, `status`
  - `rental_intent_id` (FK), `source` ('rental', 'purchase', 'admin_grant')
  - `granted_at`, `expires_at`, `revoked_at`
  - Supports time-limited access

- **rentals** (Legacy - Still in use)
  - Historical/active rental records
  - `user_id`, `content_id`, `content_type`
  - `amount` (payment), `status` ('active', 'expired', 'cancelled')
  - `expires_at` (defines rental duration)
  - `payment_method`, `discount_amount`

#### Payment Processing
- **payments**: Transaction records
  - `user_id`, `amount`, `currency`, `payment_method`
  - `status`, `transaction_id`, `description`
  - Audit trail for all payments

- **wallets**: User wallet accounts
  - `user_id`, `balance` (in kobo)
  - `updated_at` for last modification

- **transactions_ledger**: Financial audit log
  - `wallet_id`, `amount`, `transaction_type`
  - `status`, `reference`, `metadata`
  - Double-entry accounting support

- **payouts**: Creator/producer payouts
  - `payee_id`, `amount`, `payout_method`, `status`
  - `bank_details`, `processed_at`

- **webhook_events**: Paystack webhook log
  - Stores all incoming webhook events
  - Prevents duplicate processing

#### User Engagement
- **watch_history**: Video playback tracking
  - `user_id`, `content_id`, `content_type`
  - `last_watched`, `progress` (in seconds)

- **favorites**: Watchlist items
  - `user_id`, `content_id`, `content_type`

#### Support & Content Management
- **submissions**: Creator submissions
  - Content proposals from producers
  - `status` ('pending', 'approved', 'rejected')

- **tickets**: Support ticket system
  - `user_id`, `title`, `description`, `status`
  - `priority`, `assigned_to`, `created_at`

- **ticket_comments**: Ticket responses
  - `ticket_id`, `user_id`, `comment_text`

- **email_logs**: Email delivery tracking
  - Records all sent emails for audit

#### Content Discovery
- **slider_items**: Homepage hero carousel
  - `title`, `content_id`, `content_type`, `image_url`
  - `order`, `active` flag

- **banners**: Promotional banners
  - Content, images, links, expiry

#### Analytics & Recommendations (Supporting)
- **finance_audit_logs**: Financial operations log
  - All wallet/payment operations logged
  - Admin actions tracked

- **payment_anomalies**: Suspicious payment detection
  - Flagged duplicate/suspicious transactions

- **referral_codes**: Referral program
  - User-specific promo codes
  - Discount mechanisms

---

## 4. EDGE FUNCTIONS (Supabase Functions)

### Payment & Rental Processing
1. **process-rental**: Main rental transaction handler
   - Accepts: userId, contentId, contentType, price, paymentMethod, referralCode
   - Creates rental intent → charges wallet/Paystack → grants access
   - Handles discounts & referral codes

2. **verify-payment**: Universal payment verification
   - Verifies both wallet & Paystack payments
   - Updates rental intent status
   - Returns payment confirmation

3. **verify-rental-payment**: Rental-specific verification
   - Wraps verify-payment for rental context
   - Returns rental access details

4. **paystack-webhook**: Incoming Paystack events
   - Verifies HMAC signature
   - Updates payment status on success
   - Prevents duplicate processing

5. **sync-paystack-payments**: Periodic reconciliation
   - Syncs Paystack records with database
   - Fixes missed or stuck payments

6. **create-payment**: Generic payment creation
   - Initializes new payment record
   - Generates Paystack authorization URL

7. **wallet-payment**: In-app wallet payments
   - Deducts from user balance
   - Records transaction
   - Updates ledger

### Content & Access Management
8. **rental-access**: Access control enforcement
   - Verifies user has valid rental/access
   - Returns access token or denies
   - Checks expiry status

9. **get-video-url**: Signed video URL generation
   - Returns presigned URLs for video playback
   - Prevents unauthorized direct access
   - Expiry-based security

10. **content-upload**: Content ingestion
    - Handles video/metadata uploads
    - Integrates with Backblaze B2
    - Creates database records

### Content Management System
11. **banners**: Banner CRUD operations
12. **slider-items**: Hero carousel management
13. **content-sections**: CMS section management
14. **create-season**: TV season creation
15. **create-tv-show**: TV show creation
16. **upload-episode**: Episode upload handler

### Admin Functions
17. **admin-user-management**: User manipulation
    - Enable/disable accounts
    - Role management
    - Delete user data

18. **admin-wallet-adjustment**: Wallet corrections
    - Admin credit/debit operations
    - Audit logging

### Notifications
19. **send-push-notification**: Push delivery
    - Sends to registered FCM tokens
    - Broadcast or targeted

20. **send-ticket-notification**: Ticket updates
    - Notifies support participants

### Utilities
21. **generate-trailer-url**: Trailer URL signing
22. **delete-own-account**: User data deletion
23. **initiate-wallet-funding**: Wallet top-up initiation

### Shared Utilities (_shared/rental.ts)
- `normalizeContentType()`: Validates content type
- `getDefaultRentalDurationHours()`: Returns rental duration (movies: 48hrs, seasons: 14 days, episodes: 7 days)
- `hasActiveRentalAccess()`: Access check logic
- `buildRentalIntentPayload()`: Intent payload construction

---

## 5. FRONTEND ARCHITECTURE

### Authentication Flow
1. **AuthContext.tsx**: Central auth state management
   - `useAuth()` hook provides user, session, profile, userRole
   - Handles sign up, sign in, sign out, password reset
   - Fetches user profile & role on auth state change
   - Tracks loading state

2. **Authentication Pages**:
   - `Auth.tsx`: Sign in & sign up form (combined)
   - `ResetPassword.tsx`: Password recovery

3. **Route Protection**:
   - `ProtectedRoute.tsx`: Requires authentication
   - `SuperAdminRoute.tsx`: Requires super_admin role
   - `AdminLayout.tsx`: Admin dashboard wrapper

### Rental & Payment System

#### Key Hooks
- **useRentals.tsx**: Core rental management
  - Fetches active rentals
  - `checkAccess(contentId, contentType)`: Boolean access check
  - Real-time rental updates via Supabase subscriptions
  - Time-remaining calculations

- **useOptimizedRentals.tsx**: Performance-optimized version
  - Same functionality as useRentals
  - Optimized for frequent access checks
  - Used in video players

- **usePaystackRentalVerification.tsx**: Payment verification
  - `verifyPayment(rentalId, reference)`: Single verification
  - `pollPaymentStatus()`: Polls for completion (up to 5 minutes)
  - Handles pending/completed/failed states

- **useWallet.tsx**: Wallet management
  - Fetches wallet balance
  - Auto-creates wallet if missing
  - Real-time balance updates
  - `canAfford()`, `refreshWallet()`

#### Payment Components
- **RentalButton.tsx**: Basic rental trigger
- **OptimizedRentalButton.tsx**: Performance-optimized version
- **OptimizedRentalCheckout.tsx**: Complete checkout UI
  - Displays price, discount, total
  - Selects payment method (wallet/Paystack)
  - Shows wallet balance
  - Initiates payment flow

- **PaymentSuccessAnimation.tsx**: Success feedback

- **Wallet Components** (wallet/):
  - `FundWalletModal.tsx`: Wallet top-up UI
  - `TransactionHistory.tsx`: Payment history
  - `WalletWidget.tsx`: Balance display widget

### Video Playback System

#### Video Player Components
1. **VideoPlayer.tsx**: Web-based player (Video.js)
   - HLS/DASH streaming support
   - Progressive playback tracking
   - Subtitle support
   - Quality switching

2. **NativeVideoPlayer.tsx**: Native mobile player
   - Capacitor integration
   - Platform-specific (iOS/Android)
   - Resume playback from saved position
   - Full-screen support

3. **OfflineVideoPlayer.tsx**: Offline playback
   - IndexedDB storage
   - Local file playback
   - Background sync support

4. **VideoPlayerControls.tsx**: Custom player controls
   - Play/pause, seek, volume
   - Quality selector
   - Subtitle toggle
   - Full-screen button

#### Video Progress Tracking
- **useVideoProgress.tsx**: Saves playback position
  - Stores in local storage/IndexedDB
  - Retrieves for resume playback
  - Tracks completion

- **useWatchHistory.tsx**: Records watch history
  - Syncs with database
  - Updates `watch_history` table
  - Enables recommendations

#### Playback Pages
- **Watch.tsx**: Main video playback page
  - Accepts movie/episode/show params
  - Checks rental access
  - Renders appropriate player
  - Handles errors

### Content Discovery

#### Content Fetching
- **useContentManager.tsx**: Fetches content catalog
  - Movies, TV shows, episodes
  - Caching & pagination
  - Search/filter support

- **useSections.tsx**: Gets CMS sections
  - Hero slider, banners
  - Themed collections

- **useSliderItems.tsx**: Homepage carousel items

#### Content Display Components
- **CinematicHeroSlider.tsx**: Homepage hero carousel
- **ContentCarousel.tsx**: Horizontal scroll sections
- **MovieCard.tsx**: Movie grid item
- **EnhancedContentCard.tsx**: Advanced card display
- **ContentHero.tsx**: Large content preview

#### Discovery Pages
- **Index.tsx**: Homepage (hero, sections, recommendations)
- **Movies.tsx**: Movies browsing page
- **TVShows.tsx**: TV shows browsing page
- **Genres.tsx**: Category browsing
- **Watchlist.tsx**: User favorites

### User Management

#### Hooks
- **useProfile.tsx**: Profile management
- **useRole.tsx**: User role checking
- **useFavorites.tsx**: Favorite management
- **useFavorites.tsx**: Watchlist sync

#### Components
- **ProfileImagePicker.tsx**: Avatar upload
- **Header.tsx**: Top navigation
- **BottomNav.tsx**: Mobile bottom nav (mobile/)

#### Pages
- **Profile.tsx**: User profile page
- **Wallet.tsx**: Wallet balance & transactions
- **Watchlist.tsx**: Saved content

### Mobile & Offline

#### Mobile Optimization
- **useMobile.tsx**: Mobile detection hook
- **usePullToRefresh.tsx**: Refresh gesture
- **mobile/**: Mobile-specific components
- **NativeVideoOptimization.tsx**: Mobile player tweaks
- **MobileRouteAnimator.tsx**: Page transitions

#### Offline Support
- **useOfflineVideo.tsx**: Offline video sync
- **useServiceWorker.tsx**: Service worker registration
- **OfflineBanner.tsx**: Shows offline status
- **OfflineSyncStatus.tsx**: Sync progress indicator
- **backgroundSync.ts**: Background sync logic

#### Notifications
- **usePushNotifications.tsx**: FCM push setup
- **useDeepLinking.tsx**: Deep link handling

### Admin Dashboard (30 Pages)

#### Content Management
- **Dashboard.tsx**: Overview & metrics
- **Movies.tsx**, **AddMovieNew.tsx**, **EditMovie.tsx**, **ViewMovie.tsx**
- **TVShows.tsx**, **AddTVShow.tsx**, **EditTVShow.tsx**, **ViewTVShow.tsx**
- **AddSeason.tsx**, **EditSeason.tsx**
- **AddEpisode.tsx**, **EditEpisode.tsx**

#### Financial Management
- **Finance.tsx**: Revenue dashboard
- **Wallets.tsx**: User wallet admin
- **Rentals.tsx**: Rental analytics

#### User Management
- **Users.tsx**: User list & controls
- **Submissions.tsx**: Creator applications
- **Producers.tsx**: Producer management

#### Content Control
- **Sections.tsx**: Homepage section editor
- **HeroSlider.tsx**: Hero carousel editor
- **Banners.tsx**: Promotional banner management

#### Marketing & Engagement
- **ReferralCodes.tsx**: Referral program management
- **PushNotifications.tsx**: Send push campaigns
- **JobListings.tsx**, **JobApplications.tsx**: Career section

#### Support
- **CreateTicket.tsx**, **TicketsList.tsx**, **TicketDetails.tsx**

#### Settings
- **Settings.tsx**: Platform configuration

---

## 6. EXISTING RENTAL/PAYMENT IMPLEMENTATION

### Rental Model (Latest Architecture)

#### Two-Table Approach (Optimized)
1. **rental_intents**: Represents the "intent to rent"
   - Created when user initiates rental
   - Links to payment (Paystack reference or wallet deduction)
   - Tracks discount & referral codes
   - Status: pending → paid → access granted

2. **rental_access**: Represents "access token"
   - Created when rental intent is paid
   - Time-limited (expires_at)
   - Can be revoked by admin
   - Allows flexible access models (rental, purchase, admin_grant)

#### Rental Duration Defaults
- **Movies**: 48 hours
- **Seasons**: 14 days
- **Episodes**: 7 days

#### Payment Methods
1. **Wallet Payment**
   - Direct balance deduction
   - Instant confirmation
   - Must have sufficient balance

2. **Paystack Payment**
   - External payment processor
   - Async processing via webhook
   - Integrates with Paystack API

### Payment Flow

```
User Initiates Rental
    ↓
Check User Balance & Access
    ↓
Calculate Price (with discounts)
    ↓
Select Payment Method
    ├─→ [WALLET]
    │   ├─→ Create rental_intent (pending)
    │   ├─→ Deduct from wallet
    │   ├─→ Update intent to "paid"
    │   ├─→ Create rental_access
    │   └─→ Return success
    │
    └─→ [PAYSTACK]
        ├─→ Create rental_intent (pending)
        ├─→ Generate Paystack auth URL
        ├─→ Redirect to Paystack
        ├─→ [Async] Paystack webhook received
        ├─→ Verify signature & amount
        ├─→ Update intent to "paid"
        ├─→ Create rental_access
        └─→ Confirm via polling/redirect
```

### Access Control

#### Checking Rental Access
```typescript
1. Query rental_access table:
   - WHERE user_id = ? AND content_id = ? AND content_type = ?
   - AND status = 'pending' or 'paid'
   - AND expires_at > NOW()
   - AND revoked_at IS NULL

2. Return: true/false for access
```

#### Video Delivery
- `rental-access` edge function validates before issuing signed URL
- Prevents unauthorized direct video access
- Presigned URLs expire with rental

### Monetization Features

#### Pricing System
- Per-content pricing (set by admins)
- Different prices for movie/episode/season
- Support for purchase vs. rental pricing

#### Discount System
- Referral code discounts (`referral_codes` table)
- Admin-applied discounts
- Discount tracking in rental_intents

#### Wallet System
- User account balance in kobo (Nigerian Naira)
- Top-up via Paystack
- Used for both rentals and purchases
- Ledger tracking for every transaction

#### Commission & Payouts
- Creator revenue sharing
- Automated payout processing
- Finance audit logs

### Integration Points

#### Paystack Integration
- **API**: Accept payments via card, mobile money, bank transfer
- **Webhook**: Receives payment confirmations
- **Verification**: HMAC signature verification
- **Reconciliation**: Daily sync for missed payments

#### RLS Policies
- Rentals visible only to owner + admins
- Video URLs require validated rental token
- Payment records restricted

#### Real-time Updates
- Supabase Realtime subscriptions
- Wallet balance updates
- Rental status changes
- Instant notification on payment success

---

## 7. KEY FILES TO REVIEW

### Understanding Payment Architecture
1. [supabase/functions/process-rental/index.ts](supabase/functions/process-rental/index.ts) - Entry point for rental processing
2. [supabase/functions/paystack-webhook/index.ts](supabase/functions/paystack-webhook/index.ts) - Webhook handling
3. [src/hooks/usePaystackRentalVerification.tsx](src/hooks/usePaystackRentalVerification.tsx) - Frontend verification
4. [supabase/migrations/20260425000000_add_rental_intents_and_access.sql](supabase/migrations/20260425000000_add_rental_intents_and_access.sql) - Latest schema

### Understanding Video Access Control
1. [supabase/functions/rental-access/index.ts](supabase/functions/rental-access/index.ts) - Access enforcement
2. [supabase/functions/get-video-url/index.ts](supabase/functions/get-video-url/index.ts) - URL signing
3. [src/hooks/useOptimizedRentals.tsx](src/hooks/useOptimizedRentals.tsx) - Frontend access checks

### Authentication & User Management
1. [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) - Auth state management
2. [src/pages/Auth.tsx](src/pages/Auth.tsx) - Login/signup UI
3. [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) - Supabase initialization

### Wallet System
1. [src/hooks/useWallet.tsx](src/hooks/useWallet.tsx) - Wallet state
2. [src/pages/Wallet.tsx](src/pages/Wallet.tsx) - Wallet UI
3. [src/components/wallet/](src/components/wallet/) - Wallet components
4. [supabase/functions/wallet-payment/index.ts](supabase/functions/wallet-payment/index.ts) - Payment processing

### Video Playback
1. [src/components/VideoPlayer.tsx](src/components/VideoPlayer.tsx) - Web player
2. [src/components/NativeVideoPlayer.tsx](src/components/NativeVideoPlayer.tsx) - Mobile player
3. [src/pages/Watch.tsx](src/pages/Watch.tsx) - Watch page logic
4. [src/hooks/useVideoProgress.tsx](src/hooks/useVideoProgress.tsx) - Progress tracking

### Admin Dashboard
1. [src/pages/admin/Dashboard.tsx](src/pages/admin/Dashboard.tsx) - Dashboard overview
2. [src/pages/admin/Finance.tsx](src/pages/admin/Finance.tsx) - Financial reports
3. [src/pages/admin/Rentals.tsx](src/pages/admin/Rentals.tsx) - Rental analytics

### Content Management
1. [src/hooks/useContentManager.tsx](src/hooks/useContentManager.tsx) - Content fetching
2. [src/pages/admin/Movies.tsx](src/pages/admin/Movies.tsx) - Movie management
3. [supabase/functions/content-upload/index.ts](supabase/functions/content-upload/index.ts) - Upload handler

### Database Schema Overview
- [supabase/migrations/20250823104001_*.sql](supabase/migrations/20250823104001_407141eb-4a68-445f-b7ba-f59aa56b65fe.sql) - Core schema
- [supabase/migrations/20250906055636_*.sql](supabase/migrations/20250906055636_26f35df4-f6bc-4a9c-9fb2-c6cc23271ad6.sql) - Wallet system
- [supabase/migrations/20260425000000_*.sql](supabase/migrations/20260425000000_add_rental_intents_and_access.sql) - Rental intents (latest)

---

## 8. ARCHITECTURE PATTERNS & BEST PRACTICES

### State Management
- **React Context + Hooks**: Auth, Rental, Wallet state
- **TanStack Query**: Server state caching, sync
- **Real-time Subscriptions**: Supabase channels for live updates
- **Local State**: Component-level useState for UI state

### Code Organization
- **Hooks**: Business logic extracted into custom hooks
- **Components**: Presentational components separated from logic
- **Pages**: Route-level components
- **Utils/Lib**: Shared functions (priceUtils, contentTypes, security)

### Security
- **JWT Auth**: Supabase Auth handles tokens
- **RLS Policies**: Database-level access control
- **Signed URLs**: Time-limited video access
- **Webhook Verification**: HMAC signature on Paystack events
- **Credential Storage**: Capacitor-based secure storage

### Performance
- **Code Splitting**: Lazy loading of routes
- **Image Caching**: Service workers cache images & fonts
- **API Caching**: React Query staleTime & gcTime
- **Offline Support**: IndexedDB for offline videos

### Error Handling
- **Try-catch blocks**: Async operations
- **Error boundaries**: React error boundaries (not yet visible)
- **Toast notifications**: User-facing error messages
- **Logging**: Console logging for debugging

---

## 9. DEPLOYMENT & ENVIRONMENT

### Frontend (Netlify)
- Automatic CI/CD from git
- Environment variables for Supabase & analytics
- PWA manifest included
- Service worker auto-registration

### Backend (Supabase)
- Managed PostgreSQL database
- Edge functions via Deno
- Storage integration with Backblaze B2
- Real-time listeners enabled

### Environment Variables
```
VITE_SUPABASE_URL=https://tsfwlereofjlxhjsarap.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
PAYSTACK_SECRET_KEY=sk_live_...
BACKBLAZE_APP_KEY_ID=...
BACKBLAZE_APP_KEY=...
```

### Mobile Deployment
- Capacitor for iOS & Android
- Native app stores (Apple App Store, Google Play)
- Push notifications via FCM
- Deep linking support

---

## 10. CURRENT CAPABILITIES SUMMARY

✅ **Implemented**
- User registration & authentication
- Video streaming (HLS/DASH)
- Movie & TV show rental system
- Per-content pricing
- Wallet system with top-up
- Paystack payment integration
- Payment verification & reconciliation
- Admin dashboard (30 pages)
- Content management (movies, shows, episodes)
- Referral code system
- Push notifications
- Offline video support
- Watch history & favorites
- User search
- Support ticket system
- Role-based access control
- Mobile apps (Capacitor)
- PWA support

🔄 **Latest Additions**
- Rental intents & access table (2-table model)
- Improved payment tracking
- Payment anomaly detection
- Email logging
- Finance audit logging

🚀 **Production Ready**
- Security policies
- CORS handling
- Error recovery
- Rate limiting
- Webhook validation

---

## 11. CRITICAL PATHS FOR FEATURE DEVELOPMENT

### Adding a New Rental Feature
1. Create edge function in `supabase/functions/`
2. Add database table in migration if needed
3. Create frontend hook in `src/hooks/`
4. Build UI component in `src/components/`
5. Wire into page component
6. Add admin controls in admin page

### Adding Payment Method
1. Create payment edge function
2. Add payment provider SDK
3. Integrate webhook handler
4. Add verification logic
5. Update UI with payment option

### Adding Content Type
1. Create database table & foreign keys
2. Add normalization in `_shared/rental.ts`
3. Update rental duration mapping
4. Create admin CRUD pages
5. Update discovery pages
6. Add playback support

---

This overview captures the complete Signature TV system architecture. The platform is a mature, production-ready streaming service with robust payment processing, content management, and mobile support.
