# Payment Tables Deployment - Complete Setup

## Current Status ✅

### Migration Files Ready
- ✅ `20260414000000_optimize_tv_rental_system.sql` - Creates rental_payments table
- ✅ `20260417000000_add_payment_tracking_columns.sql` - Adds payment tracking columns  
- ✅ `20260417000001_add_payment_anomalies_table.sql` - Creates payment_anomalies table

### File Verification
- ✅ Duplicate migration removed (20260418000001)
- ✅ All RLS policies updated to use `has_role()` function
- ✅ All foreign key constraints configured
- ✅ All indexes created for performance

## Deployment Checklist

### Step 1: Verify Migration Files ✅
All migration files are in: `supabase/migrations/`
- Contains proper SQL syntax
- Foreign keys reference existing tables
- RLS policies use existing `has_role` function

### Step 2: Deploy to Supabase
**Option A - CLI (Recommended)**
```bash
cd c:\Users\ASUS\Documents\new_projects\movie-maker-palette
npx supabase db push
```

**Option B - Supabase Console**
1. Go to https://app.supabase.com
2. Select your project (tsfwlereofjlxhjsarap)
3. SQL Editor → New Query
4. Copy content from each migration file in order:
   - 20260414000000_optimize_tv_rental_system.sql
   - 20260417000000_add_payment_tracking_columns.sql
   - 20260417000001_add_payment_anomalies_table.sql
5. Run each query

### Step 3: Verify Tables Exist
Run these queries in Supabase SQL Editor:

```sql
-- Check if rental_payments exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'rental_payments' AND table_schema = 'public';

-- Check if payment_anomalies exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public';

-- List all columns in rental_payments
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'rental_payments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- List all columns in payment_anomalies
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public'
ORDER BY ordinal_position;
```

## Table Specifications

### rental_payments Table
```
Columns:
- id (UUID, Primary Key)
- rental_id (UUID, Foreign Key to rentals.id)
- user_id (UUID, Foreign Key to auth.users.id)
- paystack_reference (VARCHAR)
- paystack_access_code (VARCHAR)
- amount (BIGINT)
- payment_status (VARCHAR) - 'pending', 'completed', 'failed', 'disputed'
- payment_channel (VARCHAR) - 'card', 'bank_transfer', 'ussd'
- metadata (JSONB)
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)

Indexes:
- PRIMARY KEY on id
- FOREIGN KEY on rental_id
- FOREIGN KEY on user_id
- idx_rental_payments_rental
- idx_rental_payments_paystack_ref
- idx_rental_payments_channel
- idx_rental_payments_status_channel
```

### payment_anomalies Table
```
Columns:
- id (UUID, Primary Key)
- rental_payment_id (UUID, Foreign Key to rental_payments.id)
- paystack_reference (TEXT)
- anomaly_type (TEXT) - 'dispute', 'refund', 'partial_payment', 'amount_mismatch', 'status_mismatch'
- severity (TEXT) - 'warning', 'critical'
- message (TEXT)
- paystack_data (JSONB)
- resolved (BOOLEAN)
- resolution_notes (TEXT)
- created_at (TIMESTAMP)
- resolved_at (TIMESTAMP)

Indexes:
- PRIMARY KEY on id
- FOREIGN KEY on rental_payment_id
- idx_payment_anomalies_severity
- idx_payment_anomalies_type
- idx_payment_anomalies_resolved
- idx_payment_anomalies_rental_payment_id
- idx_payment_anomalies_created_at
```

## RLS Policies

### rental_payments RLS
1. "Users can view their own payments"
   - SELECT: auth.uid() = user_id
   
2. "Admins can view all payments"
   - SELECT: has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')

### payment_anomalies RLS
1. "Admins can view all anomalies"
   - SELECT: has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
   
2. "Admins can update anomalies"
   - UPDATE: has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')
   
3. "Service role can insert anomalies"
   - INSERT: auth.role() = 'service_role'

## Post-Deployment Configuration

### 1. Paystack Edge Function
Run after tables are deployed:
```bash
supabase functions deploy sync-paystack-payments
```

### 2. Environment Variables
In Supabase Console → Project Settings → Secrets and Variables:
```
PAYSTACK_SECRET_KEY = your_paystack_secret_key
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
```

### 3. Verify Frontend Integration
- Frontend already handles graceful fallback if tables don't exist
- Once deployed, payment columns in admin dashboard auto-populate
- Sync button on rental tracking page triggers Paystack verification

## Expected Frontend Behavior

**Before Migration Deployed:**
- ✅ Rentals page loads with rental data
- ✅ Payment columns show "—" (dashes)
- ✅ No errors in console

**After Migration Deployed:**
- ✅ Payment status displays correctly
- ✅ Payment channel shows (card, bank_transfer, USSD)
- ✅ Paystack reference visible
- ✅ Sync button becomes functional
- ✅ Anomalies appear when detected

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tables don't exist after deployment | Check Supabase logs for errors during migration |
| Foreign key errors | Ensure 20260414000000 migration deployed first |
| RLS permission errors | Verify has_role function exists from admin migrations |
| Sync button errors | Check PAYSTACK_SECRET_KEY environment variable set |
| Dashboard shows dashes for payments | Tables exist but no payment records yet - create test rental |

## Files Created/Modified

✅ `supabase/migrations/20260417000000_add_payment_tracking_columns.sql`
✅ `supabase/migrations/20260417000001_add_payment_anomalies_table.sql`
✅ `supabase/config.toml` - Added sync-paystack-payments function config
✅ `supabase/.env.local` - Environment variable template
✅ `supabase/functions/sync-paystack-payments/index.ts` - Edge function ready
✅ `src/pages/admin/Rentals.tsx` - Dashboard fully implemented
✅ `PAYSTACK_SYNC_SETUP.md` - Setup documentation
✅ `DATABASE_MIGRATION_STATUS.md` - Migration documentation

## Next Steps

1. **Immediate**: Deploy migrations using `npx supabase db push`
2. **After Migration**: Set Paystack secret key in Supabase console
3. **Deploy Edge Function**: `supabase functions deploy sync-paystack-payments`
4. **Test Frontend**: Navigate to `/admin/rentals` and verify data loads
5. **Create Test Rental**: Test the Paystack sync button functionality

## Success Indicators

✅ `rental_payments` table exists with all columns
✅ `payment_anomalies` table exists with all columns  
✅ Both tables have proper indexes
✅ RLS policies are in place
✅ Admin dashboard loads without 404 errors
✅ Payment columns display correctly (no more dashes)
✅ Sync button successfully calls Paystack API
