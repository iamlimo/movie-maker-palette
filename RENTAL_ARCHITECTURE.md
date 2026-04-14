# TV Rental System Architecture Diagram

## Component Hierarchy

```
┌─────────────────────────────────────────────────────┐
│           TVShowPreview Page                        │
│  (Displays TV show, seasons, and episodes)          │
└────┬──────────────────────────────────┬─────────────┘
     │                                  │
     ▼                                  ▼
┌─────────────────────┐      ┌──────────────────────┐
│ Pricing Section     │      │ Episodes Section     │
│ (Season level)      │      │ (Episode level)      │
└────┬────────────────┘      └────┬─────────────────┘
     │                             │
     │ isSeasonRented?             │ isEpisodeRented?
     │                             │
     ▼                             ▼
┌──────────────────────────────────────────────────────┐
│  OptimizedRentalButton                              │
│  - Shows "Rent Season - ₦X"                         │
│  - Shows "Watch Now" if user has access             │
│  - Shows "Sign In" if not authenticated             │
└────┬───────────────────────────────────────────────┘
     │
     │ onClick
     ▼
┌───────────────────────────────────────────────────────┐
│  OptimizedRentalCheckout (Dialog)                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Price Summary + Referral Code Input             │ │
│  │ ┌────────────────────────────────────────────┐ │ │
│  │ │ Wallet │ Card                              │ │ │
│  │ │────────────────────────────────────────────│ │ │
│  │ │ Wallet Balance: ₦50,000                    │ │ │
│  │ │ [Debit Card Powered by Paystack]          │ │ │
│  │ └────────────────────────────────────────────┘ │ │
│  │                                                 │ │
│  │ [Cancel] [Pay ₦X]                              │ │
│  └─────────────────────────────────────────────────┘ │
└───┬───────────────────────────────────────────────────┘
    │
    ├──────────────────┬────────────────────┐
    │                  │                    │
    │ Wallet           │ Paystack           │
    │                  │                    │
    ▼                  ▼                    ▼
┌─────────┐    ┌──────────────┐     ┌──────────────┐
│ INSTANT │    │ OPENS PAYSTACK│     │ PENDING      │
│ SUCCESS │    │ CHECKOUT     │     │              │
│         │    │              │     │ (Polling for │
│ Rental  │    │ Returns Auth │     │ completion)  │
│ Created │    │ URL          │     │              │
│ (✓)     │    └─────┬────────┘     └──────┬───────┘
│         │          │                     │
│ Wallet  │          ▼                     │
│ Reduced │    ┌────────────────┐          │
└────┬────┘    │ User Completes │          │
     │         │ Payment        │          │
     │         │ (External)     │          │
     │         └────────┬───────┘          │
     │                  │                  │
     │                  ▼                  │
     │         ┌──────────────────┐        │
     │         │ Paystack Webhook │        │
     │         │ or Client Polls  │        │
     │         └────┬─────────────┘        │
     │              │                      │
     └──────┬───────┴──────────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ Rental Completed  │
    │ Status = 'active' │
    │ Access Granted    │
    └───────┬───────────┘
            │
            ▼
    ┌─────────────────────┐
    │ User Sees:          │
    │ [▶ Watch Now]       │
    │ 2h 30m remaining    │
    └─────────────────────┘
```

---

## Data Flow - Wallet Payment

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT (React Component)                                         │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ OptimizedRentalCheckout                                      ││
│ │ - User chooses Wallet                                        ││
│ │ - Clicks "Pay ₦X"                                           ││
│ │ - Calls: processRental(id, type, price, 'wallet')          ││
│ └────────────────────┬───────────────────────────────────────┘│
└─────────────────────┼────────────────────────────────────────────
                      │
                      │ supabase.functions.invoke('process-rental')
                      │
                      ▼
          ┌─────────────────────────────┐
          │ CLOUD FUNCTION              │
          │ process-rental              │
          │ ┌─────────────────────────┐ │
          │ │ 1. Check wallet balance │ │
          │ │ 2. Validate content     │ │
          │ │ 3. Create rental        │ │
          │ │ 4. Deduct wallet        │ │
          │ │ 5. Return success       │ │
          │ └──────────┬──────────────┘ │
          └────────────┼────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐      ┌──────────┐      ┌──────────┐
│ RENTALS │      │ WALLETS  │      │ SUCCESS  │
│ TABLE   │      │ TABLE    │      │ RESPONSE │
│         │      │          │      │          │
│INSERT   │      │UPDATE    │      │Return    │
│rental   │      │balance   │      │rentalId  │
│✓        │      │-amount   │      │✓         │
│         │      │✓         │      │          │
└─────────┘      └──────────┘      └────┬─────┘
                                         │
                                         │ Real-time update
                                         ▼
          ┌─────────────────────────────────────┐
          │ CLIENT (React)                      │
          │ ┌───────────────────────────────┐  │
          │ │ Toast: "Payment Successful!"  │  │
          │ │ Show: [▶ Watch Now]           │  │
          │ │ Or: Navigate to watch page    │  │
          │ └───────────────────────────────┘  │
          └─────────────────────────────────────┘
```

---

## Data Flow - Paystack Payment

```
┌──────────────────────────────────────────────────────────────┐
│ CLIENT (React Component)                                      │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ OptimizedRentalCheckout                               │  │
│ │ - User chooses Card                                   │  │
│ │ - Clicks "Pay ₦X"                                    │  │
│ │ - Calls: processRental(id, type, price, 'paystack') │  │
│ └──────────────────┬─────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────
                      │
                      │ supabase.functions.invoke('process-rental')
                      │ { paymentMethod: 'paystack' }
                      │
                      ▼
          ┌─────────────────────────────────┐
          │ CLOUD FUNCTION                  │
          │ process-rental                  │
          │ ┌───────────────────────────┐  │
          │ │ 1. Create rental (pending)│  │
          │ │ 2. Init Paystack trans.   │  │
          │ │ 3. Return auth_url + id   │  │
          │ └───────────┬───────────────┘  │
          └─────────────┼──────────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    ▼                   ▼                   ▼
┌─────────┐       ┌──────────┐      ┌──────────────┐
│ RENTALS │       │ PAYSTACK │      │ RESPONSE     │
│ TABLE   │       │ API      │      │              │
│         │       │          │      │authUrl +     │
│INSERT   │       │POST      │      │rentalId      │
│rental   │       │trans.    │      │              │
│status   │       │initial.  │      └────┬─────────┘
│=pending │       │✓         │           │
│✓        │       └──────────┘           │
└─────────┘                              │
                                         │ User opens URL in new window
                                         ▼
                    ┌──────────────────────────────┐
                    │ EXTERNAL: Paystack Checkout │
                    │ - User enters card details   │
                    │ - Paystack processes payment│
                    │ - Success / Failure callback │
                    └────────┬─────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
          ┌──────────────┐    ┌──────────────┐
          │SUCCESS       │    │FAILURE       │
          │Paystack      │    │Paystack      │
          │redirects to: │    │redirects to: │
          │callback URL  │    │error URL     │
          └────┬─────────┘    └──────┬───────┘
               │                     │
               │                     │
               ▼                     ▼
    ┌────────────────────┐   ┌──────────────┐
    │ CLIENT POLLS:      │   │ User Return  │
    │ verify-payment()   │   │ to app       │
    │ ┌────────────────┐ │   │ Show retry   │
    │ │Check Paystack  │ │   │ option      │
    │ │response code   │ │   └──────────────┘
    │ │Update rental   │ │
    │ │status =        │ │
    │ │'completed'     │ │
    │ └────────┬───────┘ │
    │          │         │
    │ Polling  │ (2/3 sec)
    │ repeats  │
    │ until:   │
    │ SUCCESS  │
    └────┬─────┘
         │
         ▼
 ┌──────────────────────────┐
 │ CLIENT (React)           │
 │ ┌──────────────────────┐ │
 │ │ Toast: "Payment OK!" │ │
 │ │ Show: [▶ Watch Now]  │ │
 │ │ Or: Navigate/refresh │ │
 │ └──────────────────────┘ │
 └──────────────────────────┘
```

---

## State Machine - Rental Lifecycle

```
                    ┌─────────────┐
                    │   CREATED   │ (User clicks Rent)
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼ Wallet                     ▼ Paystack
    ┌──────────────┐           ┌──────────────────┐
    │ WALLET PAY   │           │ PAYSTACK INIT    │
    │ (atomic)     │           │ (awaiting user)  │
    └──────┬───────┘           └─────────┬────────┘
           │                             │
           ▼ Success                     ▼ User Pays
    ┌────────────────┐          ┌──────────────────┐
    │   COMPLETED    │          │   PENDING        │
    │ ✓ Can Access  │          │ ⏳ Waiting verify│
    └────────────────┘          └────────┬─────────┘
           ▲                             │
           │                             │
           │                    ┌────────┴────────┐
           │                    │                 │
           │              Success  or     Failure
           │              (polling)       (webhook)
           │                    │                 │
           │                    ▼                 ▼
           │          ┌──────────────┐  ┌──────────────┐
           │          │ COMPLETED    │  │  CANCELLED   │
           │          │ ✓ Can Access │  │ ✗ Retry      │
           │          └──────────────┘  └──────────────┘
           │                    △
           │                    │
           └────────────────────┘
                (Polling confirms)

    Hours/Days pass...
                │
                ▼
    ┌──────────────────┐
    │ EXPIRED          │  (expires_at < now())
    │ Cannot access    │
    │ Show Rent again  │
    └──────────────────┘
```

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────┐
│              AUTH.USERS (Supabase Auth)                     │
│              ┌──────────────────┐                           │
│              │ id (PK)          │                           │
│              │ email            │                           │
│              │ ...              │                           │
│              └────────┬─────────┘                           │
└───────────────────────┼──────────────────────────────────────┘
                        │ 1:N
                        │
    ┌───────────────────┼──────────────────┐
    │                   │                  │
    ▼ 1:N               ▼ 1:N              ▼ 1:N
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ WALLETS      │    │ RENTALS      │    │ PROFILES     │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ id (PK)      │    │ id (PK)      │    │ id (PK)      │
│ user_id (FK) │    │ user_id (FK) │    │ user_id (FK) │
│ balance      │    │ content_id   │    │ email        │
│              │    │ content_type │    │ ...          │
│              │    │ price        │    │              │
│              │    │ discount_amt │    │              │
│              │    │ status       │    │              │
│              │    │ expires_at   │    │              │
│              │    │ created_at   │    │              │
│              │    └──────┬───────┘    │              │
└──────────────┘           │            └──────────────┘
                           │ 1:1
                           │
                           ▼
              ┌──────────────────────────┐
              │ RENTAL_PAYMENTS          │
              │ (Paystack tracking)      │
              ├──────────────────────────┤
              │ id (PK)                  │
              │ rental_id (FK)           │
              │ paystack_reference       │
              │ amount                   │
              │ payment_status           │
              │ completed_at             │
              │ created_at               │
              └──────────┬───────────────┘
                         │ 1:N
                         │
                         ▼
         ┌────────────────────────────────┐
         │ REFERRAL_CODE_USES             │
         ├────────────────────────────────┤
         │ id (PK)                        │
         │ code_id (FK)                   │
         │ user_id (FK)                   │
         │ rental_id (FK, nullable)       │
         │ created_at                     │
         └────────────────────────────────┘

DEPENDENCIES:
→ rentals.user_id REFERENCES auth.users(id)
→ rental_payments.rental_id REFERENCES rentals(id)
→ referral_code_uses.rental_id REFERENCES rentals(id)
→ wallets.user_id REFERENCES auth.users(id)
→ profiles.user_id REFERENCES auth.users(id)
```

---

## Security & Validation

```
┌─────────────────────────────────────────────────────────┐
│         SECURITY CHECK LAYERS                          │
└─────────────────────────────────────────────────────────┘

1. CLIENT-SIDE (React)
   ┌─────────────────────────────────────┐
   │ • Validate content exists           │
   │ • Check user is authenticated       │
   │ • Validate price format             │
   │ • Validate referral code length     │
   └─────────────────────────────────────┘
           │ Pass to cloud function →

2. CLOUD FUNCTION (Trusted Server)
   ┌─────────────────────────────────────┐
   │ • Verify auth header/JWT            │
   │ • Check content exists in DB        │
   │ • Validate price matches DB         │
   │ • Check for duplicate rental        │
   │ • Validate referral code in DB      │
   │ • Verify wallet balance             │
   │ • Atomic transaction (all-or-none)  │
   └─────────────────────────────────────┘
           │ Pass to Paystack API / Wallet →

3. PAYSTACK (External Service)
   ┌─────────────────────────────────────┐
   │ • Verify customer details           │
   │ • Process payment securely          │
   │ • Return verified transaction ID    │
   │ • Webhook back to cloud function    │
   └─────────────────────────────────────┘
           │ Return to client →

4. DATABASE (RLS Policies)
   ┌─────────────────────────────────────┐
   │ • Users can only read own rentals   │
   │ • System can insert/update rentals  │
   │ • Timestamps auto-managed           │
   │ • Foreign keys enforced             │
   └─────────────────────────────────────┘
```

---

## Performance Optimizations

```
QUERY PERFORMANCE INDEXES:

rentals table:
┌─────────────────────────────────────────────────┐
│ CREATE INDEX ON rentals(                        │
│   user_id,                                      │
│   status,                                       │
│   expires_at                                    │
│ ) WHERE status = 'completed'                    │
│                                                 │
│ Used for: "Get active rentals for user"        │
│ Query time: O(1) ≈ 0-5ms                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ CREATE INDEX ON rentals(                        │
│   content_id,                                   │
│   content_type,                                 │
│   status                                        │
│ )                                               │
│                                                 │
│ Used for: "Check if episode rented"            │
│ Query time: O(1) ≈ 0-5ms                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ CREATE INDEX ON rentals(expires_at)             │
│                                                 │
│ Used for: "Cleanup expired rentals"            │
│ Query time: O(1) ≈ 1-10ms                      │
└─────────────────────────────────────────────────┘

CACHING STRATEGY:

┌────────────────────────┐
│ useOptimizedRentals()  │
│ ┌────────────────────┐ │
│ │ rentals: []        │ │  ← Cached in React state
│ │ Auto-refresh via   │ │     Real-time updates
│ │ Supabase subscribe │ │     via subscriptions
│ └────────────────────┘ │
└────────────────────────┘
              │
              │ Subscription channel updates
              ▼
   ┌─────────────────────┐
   │ Client state        │
   │ ┌─────────────────┐ │
   │ │ Memoized checks │ │  ← Fast access checks
   │ │ checkAccess()   │ │     O(1) in-memory
   │ │ No DB query     │ │
   │ └─────────────────┘ │
   └─────────────────────┘
```

This architecture ensures:
✓ Fast access checks (in-memory)
✓ Real-time updates (subscriptions)
✓ Atomic payments (transactions)
✓ Secure validation (server-side)
✓ Scalable for high volume
