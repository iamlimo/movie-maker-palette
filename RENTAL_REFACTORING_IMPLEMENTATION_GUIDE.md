# Signature TV - Rental System Refactoring Implementation Guide

**Document**: Step-by-step refactoring guide  
**Status**: READY FOR IMPLEMENTATION  
**Estimated Timeline**: 3-4 weeks for comprehensive fix  
**Risk Level**: LOW (backward compatible approach)  

---

## PHASE 1: STABILIZATION (Days 1-2)

### 1.1 Add Webhook Idempotency Constraint

**File**: Database migration  
**Risk**: MINIMAL (read-only for existing data)

```sql
-- Add unique partial index to rental_access
-- Prevents duplicate 'paid' access for same user+content

ALTER TABLE rental_access 
ADD CONSTRAINT unique_active_rental_per_content 
UNIQUE (
  user_id,
  COALESCE(movie_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status = 'paid' AND revoked_at IS NULL;

-- Verify:
-- INSERT INTO rental_access (...) VALUES (..., status='paid', ...)
-- INSERT INTO rental_access (...) VALUES (..., status='paid', ...) -- FAILS (duplicate)
```

**Verification**:
```sql
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'rental_access' 
AND constraint_name LIKE '%unique_active%';
-- Expected: 1 row with UNIQUE constraint
```

---

### 1.2 Enforce Season→Episode Backend Access

**File**: [supabase/functions/rental-access/index.ts](supabase/functions/rental-access/index.ts)  
**Current**: Only checks direct episode rental  
**Fix**: Also check parent season rental  

**Before**:
```ts
async function checkAccess(user, contentId, contentType) {
  // Only checks: rental_access WHERE episode_id = contentId
}
```

**After**:
```ts
async function checkAccess(user, supabase, contentId, contentType) {
  if (contentType === 'episode') {
    // Check 1: Direct episode rental
    const { data: episodeRental, error: epErr } = await supabase
      .from('rental_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('episode_id', contentId)
      .eq('status', 'paid')
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (episodeRental) {
      return jsonResponse({
        has_access: true,
        access_type: 'rental',
        expires_at: episodeRental.expires_at,
        rental_access_id: episodeRental.id,
      });
    }

    // Check 2: Parent season rental
    const { data: episode, error: epDataErr } = await supabase
      .from('episodes')
      .select('season_id')
      .eq('id', contentId)
      .single();

    if (!epDataErr && episode?.season_id) {
      const { data: seasonRental, error: seasonErr } = await supabase
        .from('rental_access')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('season_id', episode.season_id)
        .eq('status', 'paid')
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (seasonRental) {
        return jsonResponse({
          has_access: true,
          access_type: 'rental',
          expires_at: seasonRental.expires_at,
          rental_access_id: seasonRental.id,
        });
      }
    }
  }

  // ... rest of existing logic for movies, seasons, etc.
}
```

**Testing**:
```ts
// Test 1: Direct episode rental
await processRental(userId, episodeId, 'episode', price);
const result = await checkAccess(userId, episodeId, 'episode');
// Expected: has_access = true

// Test 2: Season rental → episode access
await processRental(userId, seasonId, 'season', price);
const result = await checkAccess(userId, episodeId, 'episode');
// Expected: has_access = true (even though only season rented)

// Test 3: Expired season rental
await processRental(userId, seasonId, 'season', price);
// Wait for expiry...
const result = await checkAccess(userId, episodeId, 'episode');
// Expected: has_access = false (expired)
```

---

### 1.3 Centralize Content Type Normalization

**Issue**: 5+ implementations of same function across codebase  
**Fix**: Use single implementation from `_shared/rental.ts`  

**Files to Update**:
1. `process-rental/index.ts`
2. `paystack-webhook/index.ts`
3. `rental-access/index.ts`
4. `verify-payment/index.ts`
5. Any others

**Action**:
```ts
// Delete local implementation in each file:
// ❌ Remove this from process-rental/index.ts:
// function normalizeContentType(value) { ... }

// ✅ Instead, import:
import { normalizeContentType } from '../_shared/rental.ts';

// Use everywhere:
const normalized = normalizeContentType(userInput);
```

**Verification**:
```bash
# Search for duplicate implementations
grep -r "function normalizeContentType" supabase/functions/

# Expected output: ONLY in _shared/rental.ts (1 match)
# If more: delete duplicates and add import
```

---

### 1.4 Document Wallet RPC Contract

**File**: Database functions (Postgres)  
**Goal**: Clarify what `process_wallet_rental_payment` RPC returns  

**Create Documentation**:
```sql
-- File: supabase/functions/_shared/RPC_CONTRACTS.md

## RPC: process_wallet_rental_payment

### Input Parameters
- p_user_id (uuid): User requesting rental
- p_content_id (uuid): Movie/season/episode ID
- p_content_type (text): 'movie' | 'season' | 'episode'
- p_final_price (bigint): Amount in kobo (currency=NGN)
- p_expires_at (timestamp): Expiry time for access
- p_metadata (jsonb): Additional metadata
- p_referral_code (text, nullable): Discount code
- p_discount_amount (bigint): Discount in kobo

### Return Type
```
RETURNS TABLE (
  rental_intent_id uuid,     -- PK of created rental_intent
  rental_access_id uuid,     -- PK of created rental_access (may be null if pending)
  wallet_balance numeric     -- Updated balance after deduction
)
```

### Guarantees
1. **Atomicity**: Either all succeeds or all fails; no partial state
2. **Wallet Deduction**: Balance = Balance - p_final_price (MUST succeed or whole transaction fails)
3. **Intent Status**: rental_intent.status = 'paid' for wallet payments
4. **Access Status**: rental_access.status = 'paid' for wallet payments
5. **Expires At**: rental_access.expires_at = p_expires_at (EXACT, no rounding)
6. **Idempotency**: Can be called twice with same params; returns same IDs

### Side Effects
- Wallets table: balance decreased
- Wallet_transactions table: Debit transaction logged
- Rental_intents table: New row inserted
- Rental_access table: New row inserted
- Referral_code_uses table: Usage recorded (if code provided)

### Error Handling
If any step fails:
- Entire transaction ROLLS BACK
- Wallet NOT deducted
- No rental_intent/access created
- Error message returned

### Example
```sql
SELECT * FROM process_wallet_rental_payment(
  p_user_id := 'abc-123',
  p_content_id := 'movie-456',
  p_content_type := 'movie',
  p_final_price := 1000000,  -- ₦10,000
  p_expires_at := now() + INTERVAL '48 hours',
  p_metadata := '{"source": "web"}'::jsonb,
  p_referral_code := NULL,
  p_discount_amount := 0
);
-- Returns:
-- rental_intent_id | rental_access_id | wallet_balance
-- abc-xyz         | access-123       | 5000000 (if previous balance was 6000000)
```
```

---

### 1.5 Add Request Correlation Logging

**Files to Update**:
- `process-rental/index.ts`
- `paystack-webhook/index.ts`
- `rental-access/index.ts`
- `verify-payment/index.ts`
- Frontend: `OptimizedRentalCheckout.tsx`

**Implementation**:
```ts
// At top of process-rental handler:
const requestId = crypto.randomUUID();
const startTime = Date.now();

console.log(`[PAYMENT-START] requestId=${requestId}, userId=${req.body.userId}, contentId=${req.body.contentId}, price=${req.body.price}, method=${req.body.paymentMethod}`);

try {
  // ... payment logic ...
  
  if (paymentMethod === 'wallet') {
    console.log(`[PAYMENT-WALLET] requestId=${requestId}, intentId=${result.rentalId}, newBalance=${result.walletBalance}`);
  }
  
  if (paymentMethod === 'paystack') {
    console.log(`[PAYMENT-PAYSTACK] requestId=${requestId}, intentId=${result.rentalId}, authUrl=${result.authorizationUrl}`);
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[PAYMENT-END] requestId=${requestId}, success=true, elapsed=${elapsed}ms`);
  
  return { success: true, requestId, ...result };
} catch (error) {
  console.log(`[PAYMENT-ERROR] requestId=${requestId}, error=${error.message}, elapsed=${Date.now() - startTime}ms`);
  throw error;
}
```

**Frontend Logging**:
```tsx
// In OptimizedRentalCheckout:
const handlePayment = async () => {
  const requestId = crypto.randomUUID();
  console.log(`[CHECKOUT-START] requestId=${requestId}, contentId=${contentId}, contentType=${contentType}, price=${price}`);
  
  try {
    const result = await processRental(...);
    console.log(`[CHECKOUT-RESPONSE] requestId=${requestId}, result.requestId=${result.requestId || 'N/A'}`);
    // ...rest...
  } catch (error) {
    console.error(`[CHECKOUT-ERROR] requestId=${requestId}, error=${error.message}`);
  }
};
```

**Benefit**: Trace single user action through entire payment pipeline

---

## PHASE 2: UNIFICATION (Days 3-5)

### 2.1 Make wallet-payment/ Delegate to process-rental/

**Current State**:
- `wallet-payment/index.ts`: Independent full implementation
- `process-rental/index.ts`: Also handles wallet via different path
- **Result**: Two code paths, hard to maintain

**Migration Strategy**:
1. Keep `wallet-payment/` endpoint for backward compatibility
2. Make it delegate to `process-rental/` internally
3. Remove duplicate logic from `wallet-payment/`
4. Monitor logs for any issues
5. After 1 week with no issues, mark as deprecated

**Implementation**:
```ts
// File: wallet-payment/index.ts (NEW - simplified)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { contentId, contentType, price, referralCode } = await req.json();
    
    // Get auth from header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // ✅ DELEGATE TO process-rental
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-rental`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          contentId,
          contentType,
          price,
          paymentMethod: 'wallet',  // ✅ Enforce wallet
          referralCode,
        }),
      }
    );

    const result = await response.json();
    
    // Return response with legacy field names for compatibility
    return new Response(JSON.stringify({
      success: result.success,
      payment_method: 'wallet',
      rental_expires_at: result.expiresAt,
      discount_applied: result.discountApplied,
      message: 'DEPRECATED: Use /process-rental instead',
    }), {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
```

**Verification**:
```bash
# Test old endpoint still works
curl -X POST https://api.example.com/wallet-payment \
  -H "Authorization: Bearer ${token}" \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "movie-123",
    "contentType": "movie",
    "price": 1000000,
    "referralCode": "SUMMER20"
  }'

# Should return: { success: true, payment_method: 'wallet', ... }
```

---

### 2.2 Consolidate Payment Logic in process-rental/

**Goal**: Single function handles both wallet and Paystack  
**Current**: Already does, but inconsistently

**Refactor**:
```ts
// process-rental/index.ts (improved)

async function serve(req: Request) {
  const { userId, contentId, contentType, price, paymentMethod, referralCode } = await req.json();
  
  // ✅ UNIFIED PREPARATION PHASE
  try {
    // 1. Validate inputs
    validateInputs(userId, contentId, contentType, price, paymentMethod);
    
    // 2. Check for existing rental
    const hasExisting = await hasExistingRentalAccess(supabase, userId, contentId, contentType);
    if (hasExisting) {
      return errorResponse('already has active rental', 400);
    }
    
    // 3. Validate referral code (UNIFIED)
    let discountApplied = 0;
    if (referralCode) {
      const validation = await validateReferralCode(supabase, referralCode, userId, price);
      if (!validation.valid) {
        return errorResponse(validation.error, 400);
      }
      discountApplied = validation.discountAmount;
    }
    
    // 4. Get rental duration (UNIFIED)
    const expiryHours = await getRentalExpiryHours(supabase, contentId, contentType);
    const expiresAt = buildExpiryAt(contentType, expiryHours);
    
    const finalPrice = price - discountApplied;
    
    // ✅ BRANCHING PHASE (payment-method specific)
    let result;
    if (paymentMethod === 'wallet') {
      result = await handleWalletPayment(supabase, {
        userId, contentId, contentType, price, finalPrice,
        expiresAt, referralCode, discountApplied,
      });
    } else if (paymentMethod === 'paystack') {
      result = await handlePaystackPayment(supabase, {
        userId, contentId, contentType, price, finalPrice,
        expiresAt, referralCode, discountApplied,
      });
    } else {
      return errorResponse('invalid payment method', 400);
    }
    
    // ✅ UNIFIED RESPONSE
    return successResponse(result);
  } catch (error) {
    console.error(`[process-rental] Error:`, error);
    return errorResponse(error.message, 500);
  }
}

// Separate handlers (testable, focused)
async function handleWalletPayment(supabase, input) {
  // Only wallet-specific logic here
  // Calls RPC, deducts balance, creates intent+access
}

async function handlePaystackPayment(supabase, input) {
  // Only Paystack-specific logic here
  // Creates intent, returns auth URL
}
```

**Benefits**:
- Single entry point
- Unified validation
- Testable in isolation
- Easier to add new payment methods

---

## PHASE 3: STATE MANAGEMENT (Days 6-12)

### 3.1 Implement Proper State Machine

**File**: Create new file  
**Path**: `src/lib/rentalStateMachine.ts`

```ts
// src/lib/rentalStateMachine.ts

export type RentalState =
  | 'NOT_RENTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_VERIFICATION'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'FAILED'
  | 'REVOKED'
  | 'REFUNDED';

export interface RentalStateContext {
  rentalIntent: {
    id: string;
    status: 'pending' | 'paid' | 'failed';
    payment_method: 'wallet' | 'paystack';
    expires_at: string;
    failed_at: string | null;
  } | null;
  rentalAccess: {
    id: string;
    status: 'pending' | 'paid';
    expires_at: string;
    revoked_at: string | null;
  } | null;
  now: Date;
}

/**
 * Derives rental state from intent + access records.
 * Deterministic: same inputs always produce same output.
 * Testable: no side effects.
 */
export function deriveRentalState(context: RentalStateContext): RentalState {
  const { rentalIntent, rentalAccess, now } = context;

  // Case 1: No records exist
  if (!rentalIntent && !rentalAccess) {
    return 'NOT_RENTED';
  }

  // Case 2: Pending wallet payment (transient, usually instant)
  if (
    rentalIntent &&
    rentalIntent.status === 'pending' &&
    rentalIntent.payment_method === 'wallet' &&
    !rentalIntent.failed_at
  ) {
    return 'PAYMENT_PENDING';
  }

  // Case 3: Pending Paystack payment (waiting for webhook)
  if (
    rentalIntent &&
    rentalIntent.status === 'pending' &&
    rentalIntent.payment_method === 'paystack' &&
    !rentalIntent.failed_at
  ) {
    return 'PAYMENT_VERIFICATION';
  }

  // Case 4: Payment failed
  if (rentalIntent && rentalIntent.status === 'failed') {
    return 'FAILED';
  }

  // Case 5: Access active
  if (
    rentalAccess &&
    rentalAccess.status === 'paid' &&
    !rentalAccess.revoked_at &&
    new Date(rentalAccess.expires_at) > now
  ) {
    return 'ACTIVE';
  }

  // Case 6: Access expired
  if (
    rentalAccess &&
    rentalAccess.status === 'paid' &&
    !rentalAccess.revoked_at &&
    new Date(rentalAccess.expires_at) <= now
  ) {
    return 'EXPIRED';
  }

  // Case 7: Access revoked
  if (rentalAccess && rentalAccess.revoked_at) {
    return 'REVOKED';
  }

  // Case 8: Refunded (rental_access.source = 'refund' or similar)
  // TODO: Implement when refund feature exists
  
  return 'NOT_RENTED';  // Fallback
}

// Unit tests
export function testRentalStateMachine() {
  const tests = [
    {
      name: 'No records → NOT_RENTED',
      context: { rentalIntent: null, rentalAccess: null, now: new Date() },
      expected: 'NOT_RENTED',
    },
    {
      name: 'Pending wallet → PAYMENT_PENDING',
      context: {
        rentalIntent: {
          id: '1',
          status: 'pending',
          payment_method: 'wallet',
          expires_at: new Date(Date.now() + 1000).toISOString(),
          failed_at: null,
        },
        rentalAccess: null,
        now: new Date(),
      },
      expected: 'PAYMENT_PENDING',
    },
    {
      name: 'Pending Paystack → PAYMENT_VERIFICATION',
      context: {
        rentalIntent: {
          id: '1',
          status: 'pending',
          payment_method: 'paystack',
          expires_at: new Date(Date.now() + 1000).toISOString(),
          failed_at: null,
        },
        rentalAccess: null,
        now: new Date(),
      },
      expected: 'PAYMENT_VERIFICATION',
    },
    {
      name: 'Active access → ACTIVE',
      context: {
        rentalIntent: { /* ... */ },
        rentalAccess: {
          id: '1',
          status: 'paid',
          expires_at: new Date(Date.now() + 1000000).toISOString(),
          revoked_at: null,
        },
        now: new Date(),
      },
      expected: 'ACTIVE',
    },
    // ... more tests ...
  ];

  tests.forEach((test) => {
    const result = deriveRentalState(test.context);
    if (result !== test.expected) {
      console.error(`❌ ${test.name}: got ${result}, expected ${test.expected}`);
    } else {
      console.log(`✅ ${test.name}`);
    }
  });
}
```

---

### 3.2 Consolidate Frontend Hooks

**Files to Update**:
- `src/hooks/useEntitlements.tsx` (KEEP, improved)
- `src/hooks/useOptimizedRentals.tsx` (DEPRECATE)

**New useEntitlements (unified)**:
```tsx
// src/hooks/useEntitlements.tsx (v2 - unified)

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { deriveRentalState } from '@/lib/rentalStateMachine';
import type { RentalState } from '@/lib/rentalStates';

export interface Entitlement {
  contentId: string;
  contentType: 'movie' | 'season' | 'episode';
  state: RentalState;
  expiresAt: string | null;
  timeRemaining?: {
    hours: number;
    minutes: number;
    formatted: string;
  };
}

export function useEntitlements() {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all entitlements
  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setEntitlements([]);
      return;
    }

    setLoading(true);
    try {
      // ✅ SINGLE SOURCE OF TRUTH
      const { data, error } = await supabase
        .from('v_user_entitlements')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // ✅ DERIVE STATE USING STATE MACHINE
      const mapped: Entitlement[] = (data || []).map((row) => {
        const state = deriveRentalState({
          rentalIntent: row.rental_intent ? {
            id: row.rental_intent.id,
            status: row.rental_intent.status,
            payment_method: row.rental_intent.payment_method,
            expires_at: row.rental_intent.expires_at,
            failed_at: row.rental_intent.failed_at,
          } : null,
          rentalAccess: row.rental_access ? {
            id: row.rental_access.id,
            status: row.rental_access.status,
            expires_at: row.rental_access.expires_at,
            revoked_at: row.rental_access.revoked_at,
          } : null,
          now: new Date(),
        });

        return {
          contentId: row.content_id,
          contentType: row.content_type as any,
          state,
          expiresAt: row.expires_at,
          timeRemaining: state === 'ACTIVE' && row.expires_at
            ? computeTimeRemaining(row.expires_at)
            : undefined,
        };
      });

      setEntitlements(mapped);
    } catch (err) {
      console.error('[useEntitlements] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ✅ REALTIME SUBSCRIPTION (single, unified)
  useEffect(() => {
    if (!user) return;

    fetchEntitlements();

    const subscription = supabase
      .channel(`entitlements-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_intents',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchEntitlements()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_access',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchEntitlements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, fetchEntitlements]);

  // ✅ UNIFIED ACCESS CHECK
  const checkAccess = useCallback(
    (contentId: string, contentType: 'movie' | 'season' | 'episode') => {
      const entitlement = entitlements.find(
        (e) => e.contentId === contentId && e.contentType === contentType
      );

      return {
        hasAccess: entitlement?.state === 'ACTIVE',
        state: entitlement?.state || 'NOT_RENTED',
        expiresAt: entitlement?.expiresAt,
        timeRemaining: entitlement?.timeRemaining,
      };
    },
    [entitlements]
  );

  // ✅ UNIFIED REFRESH
  const refresh = useCallback(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  return {
    entitlements,
    loading,
    checkAccess,
    refresh,
    fetchEntitlements,  // For explicit control
  };
}

function computeTimeRemaining(expiresAt: string) {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const remaining = expires - now;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  let formatted = '';
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    formatted = `${days}d remaining`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m remaining`;
  } else {
    formatted = `${minutes}m remaining`;
  }

  return { hours, minutes, formatted };
}
```

**Migration for Components**:
```tsx
// Before:
const { getEntitlement } = useEntitlements();
const { checkAccess } = useOptimizedRentals();  // Different hook!

// After:
const { checkAccess, entitlements } = useEntitlements();  // Single hook
```

---

## PHASE 4: VALIDATION & TESTING

### 4.1 Unit Tests for State Machine

```tsx
// src/lib/__tests__/rentalStateMachine.test.ts

import { deriveRentalState } from '../rentalStateMachine';

describe('rentalStateMachine', () => {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  test('No records → NOT_RENTED', () => {
    const state = deriveRentalState({
      rentalIntent: null,
      rentalAccess: null,
      now,
    });
    expect(state).toBe('NOT_RENTED');
  });

  test('Pending wallet → PAYMENT_PENDING', () => {
    const state = deriveRentalState({
      rentalIntent: {
        id: '1',
        status: 'pending',
        payment_method: 'wallet',
        expires_at: future.toISOString(),
        failed_at: null,
      },
      rentalAccess: null,
      now,
    });
    expect(state).toBe('PAYMENT_PENDING');
  });

  test('Active access → ACTIVE', () => {
    const state = deriveRentalState({
      rentalIntent: null,
      rentalAccess: {
        id: '1',
        status: 'paid',
        expires_at: future.toISOString(),
        revoked_at: null,
      },
      now,
    });
    expect(state).toBe('ACTIVE');
  });

  test('Expired access → EXPIRED', () => {
    const state = deriveRentalState({
      rentalIntent: null,
      rentalAccess: {
        id: '1',
        status: 'paid',
        expires_at: past.toISOString(),
        revoked_at: null,
      },
      now,
    });
    expect(state).toBe('EXPIRED');
  });

  // ... more tests ...
});
```

### 4.2 Integration Tests

```tsx
// tests/rental-flow.integration.test.ts

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoviePreview from '@/pages/MoviePreview';
import { createClient } from '@supabase/supabase-js';

describe('Rental Flow - Integration', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const testUserId = 'test-user-123';
  const testMovieId = 'test-movie-123';

  beforeEach(async () => {
    // Clean up test data
    await supabase.from('rental_access').delete().eq('user_id', testUserId);
    await supabase.from('rental_intents').delete().eq('user_id', testUserId);
  });

  test('Wallet payment: User rents movie and can watch', async () => {
    const { rerender } = render(<MoviePreview movieId={testMovieId} />);

    // 1. Click rent button
    const rentButton = await screen.findByRole('button', { name: /Rent Movie/i });
    userEvent.click(rentButton);

    // 2. See checkout modal
    expect(screen.getByText('Unlock this movie')).toBeInTheDocument();

    // 3. Select wallet payment
    const walletOption = screen.getByLabelText(/Wallet/i);
    userEvent.click(walletOption);

    // 4. Click pay
    const payButton = screen.getByRole('button', { name: /Pay/i });
    userEvent.click(payButton);

    // 5. Wait for success
    await waitFor(() => {
      expect(screen.getByText(/Payment successful/i)).toBeInTheDocument();
    });

    // 6. Verify database state
    const { data: intent } = await supabase
      .from('rental_intents')
      .select('*')
      .eq('user_id', testUserId)
      .eq('movie_id', testMovieId)
      .single();

    expect(intent.status).toBe('paid');

    const { data: access } = await supabase
      .from('rental_access')
      .select('*')
      .eq('user_id', testUserId)
      .eq('movie_id', testMovieId)
      .single();

    expect(access.status).toBe('paid');
    expect(new Date(access.expires_at).getTime()).toBeGreaterThan(Date.now());

    // 7. Verify UI shows "Watch Now" instead of "Rent"
    rerender(<MoviePreview movieId={testMovieId} />);
    expect(await screen.findByRole('button', { name: /Watch Now/i })).toBeInTheDocument();
  });

  test('Paystack payment: Webhook confirms access', async () => {
    // ... similar to above, but verify webhook behavior ...
  });

  test('Season rental: User can access all episodes', async () => {
    // Rent season
    const { data: access } = await supabase
      .from('rental_access')
      .insert({
        user_id: testUserId,
        season_id: 'test-season-123',
        status: 'paid',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    // Query episode access via rental-access function
    const response = await supabase.functions.invoke('rental-access', {
      body: {
        content_id: 'test-episode-456',
        content_type: 'episode',
      },
    });

    // Should have access because parent season is rented
    expect(response.data.has_access).toBe(true);
  });
});
```

---

## PHASE 5: DEPLOYMENT & MONITORING

### 5.1 Deployment Checklist

- [ ] Deploy Phase 1 fixes (stabilization)
  - [ ] Test on staging with full payment flow
  - [ ] Monitor webhook idempotency constraint
  - [ ] Verify content type normalization works
  - [ ] Check logging doesn't break anything

- [ ] Deploy Phase 2 (unification)
  - [ ] Keep wallet-payment/ endpoint backward compatible
  - [ ] Monitor error rates during transition
  - [ ] Gradually switch traffic from wallet-payment to process-rental
  - [ ] After 1 week with 0 issues, mark wallet-payment as deprecated

- [ ] Deploy Phase 3-4 (refactoring)
  - [ ] Deploy new state machine in parallel with old
  - [ ] Gradual component migration
  - [ ] A/B test for UX changes
  - [ ] Monitor performance impact

### 5.2 Monitoring

**Key Metrics**:
```
- Payment success rate (should be >99%)
- Webhook processing time (should be <5s)
- Access check latency (should be <50ms)
- Duplicate rental_access rows (should be 0)
- Failed wallet payments (should be <1%)
- Paystack webhook failures (should be <0.1%)
```

**Alerts**:
```
- Payment success rate < 95% → Investigate immediately
- Webhook failures > 1% → Check webhook logs
- Duplicate access rows > 0 → Database constraint issue
- Access check timeout > 100ms → Performance issue
```

---

## SUCCESS CRITERIA

After completing all phases:

✅ **No Duplicate Payments**: Webhook idempotency guaranteed  
✅ **Episode Access Works**: Season rental unlocks episodes  
✅ **Content Type Correct**: Consistent normalization  
✅ **Request Tracking**: Every payment traceable by requestId  
✅ **Single Hook**: No more useOptimizedRentals conflicts  
✅ **State Machine**: Deterministic, testable state derivation  
✅ **Error Clarity**: Clear error messages, root cause obvious  
✅ **Payment Reliability**: >99% success rate, <0.1% duplicates  

---

**Document prepared**: May 18, 2026  
**Status**: Ready for implementation  
**Questions**: See RENTAL_SYSTEM_AUDIT_REPORT.md
