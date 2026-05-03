# Database Migration Status - Payment Tables

## Migration Files Ready for Deployment

### Order of Execution (by timestamp):

1. **20260414000000_optimize_tv_rental_system.sql**
   - Creates `rentals` table
   - Creates `rental_payments` table
   - Creates `referral_code_uses` table
   - Sets up initial RLS policies

2. **20260417000000_add_payment_tracking_columns.sql**
   - Adds `payment_channel` column to `rental_payments`
   - Adds `metadata` column to `rental_payments`
   - Creates indexes on payment_channel
   - Updates RLS policies for better admin access

3. **20260417000001_add_payment_anomalies_table.sql**
   - Creates `payment_anomalies` table
   - Creates indexes for common queries
   - Enables RLS
   - Sets up admin access policies
   - Allows service role to insert anomalies

## Table Schema Summary

### rental_payments
```sql
- id (UUID PRIMARY KEY)
- rental_id (UUID FK → rentals.id)
- user_id (UUID FK → auth.users.id)
- paystack_reference (VARCHAR)
- paystack_access_code (VARCHAR)
- amount (BIGINT)
- payment_status (VARCHAR) -- 'pending', 'completed', 'failed', 'disputed'
- payment_channel (VARCHAR) -- 'card', 'bank_transfer', 'ussd'
- metadata (JSONB) -- Paystack transaction data
- created_at (TIMESTAMP)
- completed_at (TIMESTAMP)
```

### payment_anomalies
```sql
- id (UUID PRIMARY KEY)
- rental_payment_id (UUID FK → rental_payments.id)
- paystack_reference (TEXT)
- anomaly_type (TEXT) -- 'dispute', 'refund', 'partial_payment', 'amount_mismatch', 'status_mismatch'
- severity (TEXT) -- 'warning', 'critical'
- message (TEXT)
- paystack_data (JSONB)
- resolved (BOOLEAN)
- resolution_notes (TEXT)
- created_at (TIMESTAMP)
- resolved_at (TIMESTAMP)
```

## Deployment Steps

### Option 1: Deploy via CLI (Recommended)
```bash
# Verify migrations are ready
supabase migration list

# Deploy all pending migrations
supabase db push

# Verify tables were created
supabase migration list --remote
```

### Option 2: Deploy via Web Console
1. Go to [Supabase Console](https://app.supabase.com)
2. Select your project
3. Go to SQL Editor
4. Run each migration file in order

### Option 3: Manual Verification
After deployment, verify tables exist by running:

```sql
-- Check rental_payments table
SELECT * FROM information_schema.tables 
WHERE table_name = 'rental_payments' AND table_schema = 'public';

-- Check payment_anomalies table
SELECT * FROM information_schema.tables 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public';

-- Check rental_payments columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rental_payments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check payment_anomalies columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_anomalies' AND table_schema = 'public'
ORDER BY ordinal_position;
```

## Expected Indexes

After deployment, these indexes should exist:

**rental_payments:**
- idx_rental_payments_rental
- idx_rental_payments_paystack_ref
- idx_rental_payments_channel
- idx_rental_payments_status_channel

**payment_anomalies:**
- idx_payment_anomalies_severity
- idx_payment_anomalies_type
- idx_payment_anomalies_resolved
- idx_payment_anomalies_rental_payment_id
- idx_payment_anomalies_created_at

## RLS Policies

### rental_payments
- Users can view their own payments
- Admins can view all payments

### payment_anomalies
- Admins can view all anomalies
- Admins can update anomalies
- Service role can insert anomalies

## Troubleshooting

### Error: Foreign Key Constraint
If you get a foreign key error about rental_payments not existing:
1. Ensure 20260414000000_optimize_tv_rental_system.sql is deployed first
2. Check that rentals table exists

### Error: Function not_exists
If you get errors about `has_role` function not existing:
1. This function should exist from earlier migrations
2. Check that the admin user management migration was deployed

### Tables don't appear in UI
1. Refresh the Supabase console
2. Clear browser cache
3. Try logging out and back in

## Post-Deployment Checks

After deployment, verify the admin dashboard rental tracking page:

1. Navigate to `/admin/rentals`
2. Should see rental records loading
3. Payment status, channel, and reference columns should display correctly
4. If no data, check the browser console for errors
