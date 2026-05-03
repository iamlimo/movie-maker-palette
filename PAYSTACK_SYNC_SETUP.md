# Paystack Sync Edge Function - Setup Guide

## Environment Variables Required

The `sync-paystack-payments` edge function requires three environment variables:

### 1. PAYSTACK_SECRET_KEY ⚠️ CRITICAL
- **Where to get it**: [Paystack Dashboard](https://dashboard.paystack.com/settings/developer)
- **Steps**:
  1. Go to https://dashboard.paystack.com/settings/developer
  2. Copy your **Secret Key** (NOT the Public Key)
  3. This key starts with `sk_live_` or `sk_test_`

### 2. SUPABASE_URL
- **Already configured**: `https://tsfwlereofjlxhjsarap.supabase.co`
- **Verification**: Check in Supabase project settings → API settings

### 3. SUPABASE_SERVICE_ROLE_KEY
- **Where to get it**: Supabase Dashboard → Project Settings → API → Service Role Secret
- **Important**: This is different from the Anon Key. DO NOT expose this publicly.

## Local Development Setup

1. **Create `.env.local` in supabase directory** (already created):
   ```bash
   supabase/.env.local
   ```

2. **Add your Paystack Secret Key**:
   ```
   PAYSTACK_SECRET_KEY="sk_live_your_actual_key_here"
   SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
   ```

## Production Deployment

1. **Set environment variables in Supabase Dashboard**:
   - Go to [Supabase Console](https://app.supabase.com)
   - Select your project → Settings → Secrets and Variables
   - Add new secret: `PAYSTACK_SECRET_KEY` = your secret key
   - Add new secret: `SUPABASE_SERVICE_ROLE_KEY` = your service role key

2. **Deploy the edge function**:
   ```bash
   supabase functions deploy sync-paystack-payments
   ```

## API Key References in Code

✅ **Correct Implementation**:
- **Line 17-26**: Environment variable validation with clear error messages
- **Line 148-151**: Bearer token usage: `Authorization: Bearer ${key}`
- **API Endpoint**: `https://api.paystack.co/transaction/verify/{reference}`

## Testing the Function

### Test with cURL (local):
```bash
curl -X POST http://localhost:54321/functions/v1/sync-paystack-payments \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync_all"}'
```

### Test with cURL (production):
```bash
curl -X POST https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/sync-paystack-payments \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync_all"}'
```

## Paystack API Authentication

The function uses **Bearer Token Authentication**:
```
Authorization: Bearer sk_live_your_paystack_secret_key
```

This is the standard Paystack authentication method and is correctly implemented in the function.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `PAYSTACK_SECRET_KEY environment variable not configured` | Add the key to Supabase environment variables |
| `SUPABASE_SERVICE_ROLE_KEY environment variable not configured` | Add the key to Supabase environment variables |
| `401 Unauthorized from Paystack` | Verify your Paystack secret key is correct |
| `404 Not Found` | Check the Paystack reference exists and is valid |

## Security Notes

⚠️ **NEVER** commit the `.env.local` file to git
⚠️ **NEVER** share your Paystack secret key or Supabase service role key
⚠️ The `PAYSTACK_SECRET_KEY` should only be accessible via Supabase secrets

## Verification Checklist

- [ ] Paystack secret key added to Supabase secrets
- [ ] Supabase service role key added to Supabase secrets
- [ ] Function JWT verification enabled in `config.toml`
- [ ] `rental_payments` table exists in Supabase
- [ ] `payment_anomalies` table created via migration
- [ ] Function deployed: `supabase functions deploy sync-paystack-payments`
