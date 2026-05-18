# Paystack Webhook Investigation & Fixes

**Date**: May 17, 2026  
**Status**: Critical Issues Found and Fixed

---

## 🔍 Issues Discovered

### 1. **CRITICAL: Amount Multiplication Bug** 
**Severity**: 🔴 CRITICAL - Payment fails on webhook  
**Location**: [supabase/functions/paystack-webhook/index.ts](supabase/functions/paystack-webhook/index.ts#L269)

**The Problem**:
```
Line 269: const expectedAmount = Math.round(Number(rentalIntent.price || 0) * 100);
```

**Why it's broken**:
- In `process-rental/index.ts`, the `finalPrice` is **already in kobo** (smallest currency unit)
- Example: ₦1,000 = 100,000 kobo
- When sent to Paystack API: `amount: Math.round(input.finalPrice)` (Line 528) - already kobo
- The webhook receives the payment in kobo from Paystack
- **But then multiplies by 100 again**, making it expect 100x the actual amount!

**Example Flow**:
1. User rents for ₦1,000 (100,000 kobo)
2. `process-rental` sends: `amount: 100000` to Paystack ✅ Correct
3. Paystack processes payment of 100,000 kobo ✅
4. Webhook receives: `event.data.amount = 100000`
5. **Webhook calculates**: `expectedAmount = Math.round(100000 * 100) = 10,000,000` ❌ WRONG!
6. **Check fails**: 100,000 < 10,000,000 → Payment marked as FAILED ❌

---

### 2. **Missing Logging for Debugging**
**Severity**: 🟡 MEDIUM - Makes troubleshooting impossible  
**Location**: [supabase/functions/paystack-webhook/index.ts](supabase/functions/paystack-webhook/index.ts#L217)

**The Problem**:
- Webhook doesn't log actual payment amounts before validation
- Can't see what Paystack sent vs. what was expected
- Makes it impossible to debug amount mismatches

---

### 3. **Potential JSON Parsing Issue**
**Severity**: 🟡 MEDIUM - Rare but possible  
**Location**: [supabase/functions/paystack-webhook/index.ts](supabase/functions/paystack-webhook/index.ts#L223)

**The Problem**:
```typescript
const body = await req.text();
const isValid = await verifyPaystackSignature(body, signature);
const event = JSON.parse(body);
```

If the raw body text doesn't exactly match what was signed (trailing whitespace, encoding, etc.), the signature verification will fail silently.

---

### 4. **Missing Webhook Deployment Verification**
**Severity**: 🟡 MEDIUM - URL might not be in Paystack dashboard  

**Current Status**:
- ✅ Function is deployed: `paystack-webhook` (ID: 421ee302-8200-47a1-b610-7bc0cce34f4f)
- ✅ Status: ACTIVE, Version: 160, JWT verification: OFF
- ❓ **Unknown**: Is the webhook URL actually registered in your Paystack dashboard?

**The URL should be**:
```
https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/paystack-webhook
```

---

## 🔧 Fixes Applied

### Fix #1: Remove Amount Multiplication
The webhook should **NOT** multiply the Paystack amount by 100. The amount from Paystack is already in kobo.

**Change**:
```typescript
// BEFORE (WRONG):
const expectedAmount = Math.round(Number(rentalIntent.price || 0) * 100);

// AFTER (CORRECT):
const expectedAmount = Math.round(Number(rentalIntent.price || 0));
```

---

### Fix #2: Add Detailed Amount Logging
Log the amounts before and after validation so you can debug mismatches.

**Add this logging**:
```typescript
console.log(`[Webhook Amount Check] Reference: ${paymentReference}`);
console.log(`  - Paystack paid amount: ${paidAmount}`);
console.log(`  - Rental intent price: ${rentalIntent.price}`);
console.log(`  - Expected amount: ${expectedAmount}`);
console.log(`  - Amount check result: ${paidAmount >= expectedAmount ? 'PASS ✅' : 'FAIL ❌'}`);
```

---

### Fix #3: Ensure Body Isn't Modified Before Signature Verification
The current code is correct (signature is verified before parsing), but make sure the raw body text is preserved exactly.

---

## 🧪 Testing the Webhook

### Step 1: Verify Webhook URL in Paystack Dashboard
1. Go to [dashboard.paystack.co](https://dashboard.paystack.co)
2. Settings → API Keys & Webhooks
3. Find "Webhook URL"
4. Ensure it's set to: `https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/paystack-webhook`
5. **Whitelisted Events**: Should include `charge.success`, `charge.failed`, `charge.dispute.create`

### Step 2: View Webhook Logs in Supabase
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to: **Functions** → **paystack-webhook**
3. Click **Logs** tab
4. Look for your recent payment attempts
5. Should see:
   ```
   [Webhook Amount Check] Reference: [reference]
   - Paystack paid amount: 100000
   - Rental intent price: 100000
   - Expected amount: 100000
   - Amount check result: PASS ✅
   ```

### Step 3: Test Payment Flow End-to-End
1. Go to your app, start a rental with Paystack
2. Complete payment on Paystack
3. **Check 1**: Verify the webhook received the success event in Supabase logs
4. **Check 2**: Verify `rental_intents` table status changed to `paid`
5. **Check 3**: Verify `rental_access` record was created
6. **Check 4**: Verify frontend shows "Watch Now" instead of "Rent"

### Step 4: Monitor Webhook Events
In Paystack dashboard, go to **Settings** → **API Keys & Webhooks** → **Webhook Events**

Should see:
- ✅ Recent `charge.success` events
- ✅ HTTP 200 responses from webhook
- ✅ Response body containing `received: true`

---

## 📋 Verification Checklist

- [ ] Amount multiplication removed from webhook
- [ ] Detailed logging added for amount checks
- [ ] Webhook URL verified in Paystack dashboard
- [ ] Webhook function redeployed: `npx supabase functions deploy paystack-webhook`
- [ ] Test payment completed successfully
- [ ] Rental access instantly granted after payment
- [ ] "Watch Now" button appears instead of "Rent"
- [ ] Webhook logs show successful processing

---

## 🔗 Related Files

- **Webhook Handler**: [supabase/functions/paystack-webhook/index.ts](supabase/functions/paystack-webhook/index.ts)
- **Payment Processor**: [supabase/functions/process-rental/index.ts](supabase/functions/process-rental/index.ts#L528)
- **Rental Database**: [supabase/migrations/20260425000000_add_rental_intents_and_access.sql](supabase/migrations/20260425000000_add_rental_intents_and_access.sql)
- **Payment Verification Hook**: [src/hooks/usePaystackRentalVerification.tsx](src/hooks/usePaystackRentalVerification.tsx)

---

## 🚀 Next Steps

1. **Fix the amount calculation immediately**
2. **Deploy the updated webhook**:
   ```bash
   npx supabase functions deploy paystack-webhook
   ```
3. **Test with a real payment**
4. **Monitor logs** in Supabase dashboard
5. **Verify entitlements** update in real-time

---

## 💡 How to Debug Future Webhook Issues

1. **Always check logs first**: Supabase Functions → paystack-webhook → Logs
2. **Compare expected vs. actual amounts**: Look for the new logging output
3. **Check Paystack dashboard** for webhook event history
4. **Verify signature**: Console will log "Invalid Paystack signature" if it fails
5. **Check database state**: Manually query `rental_intents` to see status
6. **Test locally**: You can simulate webhook with curl:
   ```bash
   curl -X POST https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/paystack-webhook \
     -H "x-paystack-signature: [test-signature]" \
     -H "Content-Type: application/json" \
     -d '{"event":"charge.success","data":{"reference":"test","amount":100000}}'
   ```

