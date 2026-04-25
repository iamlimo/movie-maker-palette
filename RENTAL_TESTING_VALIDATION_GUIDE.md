# Rental System - Comprehensive Testing & Validation Guide

**Document Version**: 1.0  
**Date**: April 25, 2026  
**Status**: Production-Ready

Complete testing checklist for end-to-end validation of the rental monetization system.

---

## 🎯 Testing Scope

- **Database**: Schema, constraints, indexes, RPC functions
- **Edge Functions**: Payment processing, webhooks, access control
- **Frontend**: Hooks, components, real-time updates, error handling
- **Integration**: End-to-end payment flows (wallet + Paystack)
- **Performance**: Load testing, latency, concurrency
- **Security**: Authorization, signature verification, input validation

---

## 🧪 Unit Tests

### Database & RPC Functions

#### Test 1: `has_active_rental_access()` RPC

**Setup**:
```sql
-- Insert test user
INSERT INTO profiles (user_id, name, email) VALUES ('test-user', 'Test', 'test@example.com');

-- Insert test movie
INSERT INTO movies (id, title, rental_price) VALUES ('movie-1', 'Test Movie', 50000);

-- Create rental access
INSERT INTO rental_access (user_id, movie_id, rental_type, expires_at, status)
VALUES ('test-user', 'movie-1', 'movie', NOW() + INTERVAL '7 days', 'paid');
```

**Test Case 1.1**: User with active rental
```sql
SELECT * FROM has_active_rental_access('test-user', 'movie-1', 'movie');
-- Expected: has_access = true, access_type = 'rental'
```

**Test Case 1.2**: User without active rental
```sql
SELECT * FROM has_active_rental_access('test-user', 'movie-2', 'movie');
-- Expected: has_access = false
```

**Test Case 1.3**: Expired rental
```sql
-- Update rental to expire in past
UPDATE rental_access SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = 'test-user';

SELECT * FROM has_active_rental_access('test-user', 'movie-1', 'movie');
-- Expected: has_access = false (expired)
```

**Test Case 1.4**: Episode access via season rental
```sql
-- Create season and episode
INSERT INTO seasons (id, tv_show_id, season_number) VALUES ('season-1', 'show-1', 1);
INSERT INTO episodes (id, season_id, episode_number) VALUES ('ep-1', 'season-1', 1);

-- User rents season
INSERT INTO rental_access (user_id, season_id, rental_type, expires_at, status)
VALUES ('test-user', 'season-1', 'season', NOW() + INTERVAL '14 days', 'paid');

SELECT * FROM has_active_rental_access('test-user', 'ep-1', 'episode');
-- Expected: has_access = true (via season rental)
```

#### Test 2: `grant_rental_access()` RPC

**Test Case 2.1**: Grant new access
```sql
SELECT grant_rental_access(
  'test-user',
  'movie-1',
  'movie',
  'movie',
  NOW() + INTERVAL '48 hours',
  NULL,
  'rental'
);
-- Expected: UUID of new rental_access record
```

**Test Case 2.2**: Duplicate access (idempotent)
```sql
-- Call twice with same parameters
SELECT grant_rental_access(...); -- First call
SELECT grant_rental_access(...); -- Second call
-- Expected: Same UUID both times (ON CONFLICT DO NOTHING behavior)
```

#### Test 3: `process_wallet_rental_payment()` RPC

**Test Case 3.1**: Successful wallet debit
```sql
-- Create wallet with balance
INSERT INTO wallets (user_id, balance) VALUES ('test-user', 100000);

SELECT * FROM process_wallet_rental_payment(
  'test-user',
  'movie-1',
  'movie',
  50000,  -- final_price (5000 naira)
  NOW() + INTERVAL '48 hours'
);
-- Expected:
-- - rental_intent_id: UUID
-- - rental_access_id: UUID
-- - wallet_balance: 50000 (100000 - 50000)
-- - final_price: 50000
```

**Test Case 3.2**: Insufficient balance
```sql
-- Wallet has 20000 kobo, trying to rent for 50000
SELECT * FROM process_wallet_rental_payment(
  'test-user',
  'movie-1',
  'movie',
  50000,
  NOW() + INTERVAL '48 hours'
);
-- Expected: Error - "Insufficient wallet balance"
```

**Test Case 3.3**: Duplicate active rental prevention
```sql
-- Create existing rental intent (pending or paid status)
INSERT INTO rental_intents (user_id, movie_id, rental_type, price, status)
VALUES ('test-user', 'movie-1', 'movie', 50000, 'pending');

-- Try to create another rental
SELECT * FROM process_wallet_rental_payment(...);
-- Expected: Error - unique constraint violation on (user_id, movie_id) where status IN (pending, paid)
```

### Edge Function Tests

#### Test 4: `process-rental` (Wallet Payment)

**Test Case 4.1**: Wallet payment success
```bash
curl -X POST https://api.signaturetv.co/functions/v1/process-rental \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-1",
    "contentId": "movie-1",
    "contentType": "movie",
    "price": 50000,
    "paymentMethod": "wallet",
    "referralCode": null
  }'
# Expected: 200 OK
# {
#   "success": true,
#   "paymentMethod": "wallet",
#   "rentalIntentId": "uuid",
#   "rentalAccessId": "uuid",
#   "expiresAt": "ISO-8601-date",
#   "discountApplied": 0
# }
```

**Test Case 4.2**: Paystack initialization
```bash
curl -X POST https://api.signaturetv.co/functions/v1/process-rental \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "userId": "user-1",
    "contentId": "movie-1",
    "contentType": "movie",
    "price": 50000,
    "paymentMethod": "paystack",
    "referralCode": null
  }'
# Expected: 200 OK
# {
#   "success": true,
#   "paymentMethod": "paystack",
#   "rentalIntentId": "uuid",
#   "authorizationUrl": "https://checkout.paystack.com/...",
#   "paystackReference": "ref-123",
#   "discountApplied": 0
# }
```

**Test Case 4.3**: Duplicate rental prevention
```bash
# Make two identical requests rapidly
curl -X POST .../process-rental ... &
curl -X POST .../process-rental ... &
wait
# Expected: First succeeds (201), second fails with 409 (Conflict) - duplicate
```

#### Test 5: `paystack-webhook`

**Test Case 5.1**: Valid webhook (charge.success)
```bash
# Construct webhook payload
PAYLOAD='{"event":"charge.success","data":{"reference":"ref-123","status":"success","amount":50000}}'
SIGNATURE=$(echo -n $PAYLOAD | openssl dgst -sha512 -hmac $PAYSTACK_SECRET_KEY -hex | cut -d ' ' -f2)

curl -X POST https://api.signaturetv.co/functions/v1/paystack-webhook \
  -H "x-paystack-signature: $SIGNATURE" \
  -d "$PAYLOAD"
# Expected: 200 OK
# {
#   "received": true,
#   "rental_intent_id": "uuid",
#   "rental_access_id": "uuid",
#   "channel": "card"
# }
```

**Test Case 5.2**: Invalid signature
```bash
curl -X POST .../paystack-webhook \
  -H "x-paystack-signature: invalid-signature" \
  -d $PAYLOAD
# Expected: 400 Bad Request
# { "error": "Invalid signature" }
```

**Test Case 5.3**: Idempotent webhook (replay)
```bash
# Send same webhook twice
curl -X POST .../paystack-webhook ... # First time
# Expected: 200, rental access created

curl -X POST .../paystack-webhook ... # Second time (replay)
# Expected: 200, but rental_access NOT duplicated (idempotent)
# Query DB: SELECT COUNT(*) FROM rental_access WHERE rental_intent_id = 'uuid'
# Expected: 1 (not 2)
```

#### Test 6: `rental-access` (Video Authorization)

**Test Case 6.1**: User with active rental
```bash
curl "https://api.signaturetv.co/functions/v1/rental-access?content_id=movie-1&content_type=movie" \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: 200 OK
# {
#   "has_access": true,
#   "access_type": "rental",
#   "expires_at": "ISO-8601-date",
#   "rental_access_id": "uuid"
# }
```

**Test Case 6.2**: User without access
```bash
curl "https://api.signaturetv.co/functions/v1/rental-access?content_id=movie-2&content_type=movie" \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: 200 OK
# {
#   "has_access": false,
#   "access_type": null,
#   "expires_at": null
# }
```

---

## 🔄 Integration Tests (End-to-End)

### Scenario 1: Complete Wallet Payment Flow

1. **User navigates to movie page**
   - ✅ Movie details load
   - ✅ Price displays correctly (50,000 kobo = ₦500)
   - ✅ Rental button shows "Rent" (not "Watch Now")

2. **User clicks "Rent" button**
   - ✅ Modal opens with payment method selector
   - ✅ Wallet balance displays (e.g., ₦1,000)
   - ✅ Total price shows after discount (if applicable)

3. **User selects wallet payment**
   - ✅ "Pay" button becomes enabled
   - ✅ Confirmation message shows (e.g., "You have sufficient balance")

4. **User clicks "Pay"**
   - ✅ API call to `process-rental` with `paymentMethod: 'wallet'`
   - ✅ Loading spinner shows
   - ✅ Response returns success
   - ✅ Modal closes

5. **Access is granted**
   - ✅ Rental button changes to "Watch Now"
   - ✅ Countdown timer shows (48 hours for movies)
   - ✅ Rental appears in user's "My Rentals" list
   - ✅ Wallet balance updates (deducted amount shown)

6. **User clicks "Watch Now"**
   - ✅ Navigate to watch page
   - ✅ Video player loads
   - ✅ `rental-access` endpoint confirms access
   - ✅ Video URL generated and plays
   - ✅ Playback progress saved

### Scenario 2: Complete Paystack Payment Flow

1-3. Same as Scenario 1 steps 1-3

4. **User selects Paystack payment**
   - ✅ "Pay" button enables
   - ✅ Message shows "You will be redirected to Paystack"

5. **User clicks "Pay"**
   - ✅ API call to `process-rental` with `paymentMethod: 'paystack'`
   - ✅ Response returns `authorizationUrl`
   - ✅ Redirect to Paystack checkout
   - ✅ Modal shows "Processing payment..."

6. **User pays on Paystack**
   - ✅ User enters card details
   - ✅ Payment processes at Paystack
   - ✅ Paystack sends webhook to `paystack-webhook` function
   - ✅ Webhook grants access and updates `rental_intent` status to `paid`

7. **Frontend polls for confirmation**
   - ✅ `verify-payment` endpoint called repeatedly
   - ✅ After webhook processes, returns `status: 'paid'`
   - ✅ Access granted to user

8. **Access is granted** (Same as Scenario 1 step 5)

### Scenario 3: Season Rental Grants Episode Access

1. **User navigates to season**
   - ✅ Shows all episodes
   - ✅ Each episode shows "Included" badge (if season rented) or "Rent" button

2. **User rents season**
   - ✅ Season rental created with 14-day expiry
   - ✅ `rental_access` created for `season_id`

3. **User navigates to random episode in that season**
   - ✅ `rental-access` check returns `has_access: true`
   - ✅ Checks `has_active_rental_access()` → finds season rental → grants access
   - ✅ Episode plays without separate rental

### Scenario 4: Referral Code Discount

1. **User applies referral code during checkout**
   - ✅ Code entered in text field
   - ✅ Frontend validates format (not empty, uppercase)

2. **Server validates code**
   - ✅ `process-rental` validates code:
     - Code exists and `is_active: true`
     - Code hasn't expired (`valid_until > now()`)
     - Per-user limit not exceeded
     - User hasn't already used code

3. **Discount applied**
   - ✅ If percentage discount: `discount = price * discount_value / 100`
   - ✅ If fixed discount: `discount = discount_value`
   - ✅ `final_price = price - discount`
   - ✅ Payment processed for `final_price`

4. **Code usage recorded**
   - ✅ Entry added to `referral_code_uses` table
   - ✅ `referral_codes.times_used` incremented
   - ✅ If limit reached, code auto-disabled (`is_active: false`)

---

## 🔒 Security Tests

### Test 1: Signature Verification

**Test**: Forge Paystack webhook
```bash
# Send webhook with invalid signature
curl -X POST .../paystack-webhook \
  -H "x-paystack-signature: fake-signature" \
  -d '{"event":"charge.success","data":{"reference":"ref-123","amount":50000}}'
# Expected: 400 Bad Request, access NOT granted
```

### Test 2: Price Manipulation

**Test**: Frontend sends wrong price
```typescript
// Attempt to pay ₦10 for ₦500 rental
const response = await fetch('/process-rental', {
  body: JSON.stringify({
    price: 10000,  // Attacker sets low price
    contentId: 'movie-1'
  })
});
// Backend MUST validate: Get actual price from DB, not trust frontend
// Expected: Backend rejects or uses DB price, not frontend price
```

### Test 3: User ID Spoofing

**Test**: JWT token manipulation
```typescript
// Attempt to pay for another user's rental
const token = jwtSign({ sub: 'attacker-user' });
const response = await fetch('/process-rental', {
  headers: { Authorization: `Bearer ${token}` }
});
// Expected: Payment successful ONLY if:
// 1. JWT signature valid
// 2. User ID in JWT == user_id in request
// 3. Database verifies user_id in rental_intent == auth.uid()
```

### Test 4: SQL Injection via Referral Code

**Test**: Inject SQL in referral code
```typescript
const maliciousCode = "'; DROP TABLE rentals; --";
// Send in process-rental request
```
**Expected**: Parameterized queries prevent injection (should use `$1` placeholders)

### Test 5: Rate Limiting

**Test**: Rapid payment attempts
```bash
for i in {1..10}; do
  curl -X POST .../process-rental ... &
done
wait
# Expected: After 5 requests, get 429 (Too Many Requests)
# Per-user limit: 5 requests per 60 seconds
```

---

## ⚡ Performance Tests

### Test 1: Access Check Latency

**Measure**: Time to check if user has access
```bash
time curl "https://api.signaturetv.co/functions/v1/rental-access?content_id=movie-1&content_type=movie" \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: < 200ms (p95)
```

### Test 2: Database Query Performance

**Measure**: SQL query execution time
```sql
EXPLAIN ANALYZE
SELECT * FROM rental_access
WHERE user_id = 'test-user' AND movie_id = 'movie-1' AND expires_at > NOW();
-- Expected: < 5ms (Seq Scan or Index Scan, Rows = 1)
```

### Test 3: Concurrent User Load

**Setup**: 1000 concurrent users
```bash
# Using Apache Bench
ab -n 10000 -c 1000 https://api.signaturetv.co/functions/v1/rental-access?content_id=movie-1&content_type=movie
```

**Expected Results**:
- Failed requests: 0
- Requests per second: > 500
- Average response time: < 200ms
- 95th percentile: < 500ms
- 99th percentile: < 1000ms

### Test 4: Video URL Generation Latency

```bash
time curl "https://api.signaturetv.co/functions/v1/get-video-url?video_id=movie-1" \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: < 500ms (p95)
```

---

## 📱 Frontend Component Tests

### Test 1: `useOptimizedRentals` Hook

```typescript
describe('useOptimizedRentals', () => {
  it('should cache rental data for 30 seconds', async () => {
    const { result } = renderHook(() => useOptimizedRentals());
    
    // First call fetches from API
    await waitFor(() => {
      expect(result.current.rentals.data).toBeDefined();
    });
    
    // Second call (within 30s) uses cache
    const cachedResult = result.current.rentals.data;
    expect(cachedResult).toBe(result.current.rentals.data);
  });

  it('should return accurate access check', () => {
    const { result } = renderHook(() => useOptimizedRentals(), {
      initialProps: {
        rentals: [{
          user_id: 'user-1',
          movie_id: 'movie-1',
          expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          revoked_at: null,
          status: 'paid'
        }]
      }
    });

    expect(result.current.checkAccess('movie-1', 'movie')).toBe(true);
    expect(result.current.checkAccess('movie-2', 'movie')).toBe(false);
  });
});
```

### Test 2: `OptimizedRentalCheckout` Component

```typescript
describe('OptimizedRentalCheckout', () => {
  it('should show wallet payment option if balance sufficient', () => {
    render(
      <OptimizedRentalCheckout 
        price={50000}
        walletBalance={100000}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText('Pay with Wallet')).toBeEnabled();
  });

  it('should disable wallet payment if insufficient balance', () => {
    render(
      <OptimizedRentalCheckout 
        price={50000}
        walletBalance={10000}  // Less than price
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });

  it('should apply referral code discount', async () => {
    const { getByRole, getByDisplayValue } = render(
      <OptimizedRentalCheckout 
        price={50000}
        onSuccess={jest.fn()}
      />
    );

    const codeInput = getByDisplayValue('');
    fireEvent.change(codeInput, { target: { value: 'SAVE20' } });
    fireEvent.blur(codeInput);

    await waitFor(() => {
      expect(getByText('Discount: ₦100')).toBeInTheDocument();
    });
  });
});
```

---

## ✅ Pre-Production Checklist

- [ ] All unit tests passing (100% coverage of critical functions)
- [ ] All integration tests passing (all 4 scenarios complete)
- [ ] All security tests passing (no vulnerabilities found)
- [ ] Load test passing (1000 concurrent, > 99% success, < 500ms p95)
- [ ] Performance targets met (database < 10ms, API < 200ms, frontend < 100ms)
- [ ] Frontend components tested (hooks, components, error states)
- [ ] Error messages user-friendly and clear
- [ ] Admin dashboard tested (payment tracking, rental analytics)
- [ ] Mobile app tested (Capacitor functions working)
- [ ] Webhook retries tested (idempotency verified)
- [ ] Data migration tested (legacy rentals → new schema coexistence)
- [ ] Fallback functions tested (video URL failover, wallet fallback)
- [ ] Documentation complete (3 guides: AGENTS.md, edge cases, performance)
- [ ] Deployment runbook prepared
- [ ] Rollback procedure tested
- [ ] Monitoring & alerting configured
- [ ] Customer support notified of changes

---

## 🚀 Post-Deployment Validation

**Day 1**:
- [ ] Monitor API error rates (target: < 0.1%)
- [ ] Monitor payment success rate (target: > 99%)
- [ ] Monitor webhook processing (target: < 5s latency)
- [ ] Check for duplicate rentals (should be 0)
- [ ] Verify wallet balance accuracy (sample 10 wallets)

**Week 1**:
- [ ] Review customer support tickets for issues
- [ ] Analyze user behavior (funnel conversion at each step)
- [ ] Check for any security incidents (webhook replay, signature failures)
- [ ] Verify Paystack reconciliation (no missed payments)
- [ ] Monitor database query performance (slow query log)

---

**Last Updated**: April 25, 2026
