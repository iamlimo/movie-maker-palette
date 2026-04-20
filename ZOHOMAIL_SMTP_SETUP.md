# Zohomail SMTP Setup Guide

## Overview

The Support Ticket System now uses **Zohomail SMTP** to send email notifications directly from your existing email accounts (e.g., `tech@signaturetv.co`). This keeps everything within Zohomail and avoids DNS changes.

## Prerequisites

- ✅ Zohomail account with email addresses set up
- ✅ Supabase project linked
- ✅ Edge function deployed

## Step 1: Generate Zohomail App-Specific Password

For security, create an app-specific password instead of using your main password:

1. Go to **Zohomail Settings** → **Security**
2. Click **Generate new app password**
3. Application: Select "Mail" or "Custom Application"
4. Device: "Other" or "Deno/Node.js"
5. Copy the generated password

**Note:** For better security, create a dedicated SMTP user in Zohomail if available.

## Step 2: Get Your Zohomail SMTP Details

**For US Region:**
```
SMTP Host: smtp.zoho.com
SMTP Port: 465 (SSL) or 587 (TLS)
```

**For EU Region:**
```
SMTP Host: smtp.zohoeu.com
SMTP Port: 465 (SSL) or 587 (TLS)
```

**For India Region:**
```
SMTP Host: smtp.zoho.in
SMTP Port: 465 (SSL) or 587 (TLS)
```

## Step 3: Set Environment Variables in Supabase

Go to your **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**

Add these secrets:

| Key | Value | Example | Required |
|-----|-------|---------|----------|
| `ZOHO_SMTP_HOST` | Your Zohomail SMTP server | `smtp.zoho.com` | ✅ Yes |
| `ZOHO_SMTP_PORT` | SMTP port (465 or 587) | `465` | ✅ Yes |
| `ZOHO_EMAIL` | Sender email (must be Zohomail) | `tech@signaturetv.co` | ✅ Yes |
| `ZOHO_PASSWORD` | Zohomail app-specific password | `(your-app-password)` | ✅ Yes |
| `ADMIN_EMAIL` | Admin notification email | `ceo@signaturetv.co` | ✅ Yes |
| `REPLY_TO_EMAIL` | Email for user replies (can be any domain) | `support@signaturepicture.co` | ❌ Optional* |

*`REPLY_TO_EMAIL` defaults to `ADMIN_EMAIL` if not set

### Example in Supabase CLI:

```bash
supabase secrets set ZOHO_SMTP_HOST=smtp.zoho.com
supabase secrets set ZOHO_SMTP_PORT=465
supabase secrets set ZOHO_EMAIL=tech@signaturetv.co
supabase secrets set ZOHO_PASSWORD=your_app_password_here
supabase secrets set ADMIN_EMAIL=ceo@signaturetv.co
supabase secrets set REPLY_TO_EMAIL=info@gmail.com
```

Or set them via the Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Click **Add new secret**
3. Fill in the key-value pairs from the table above
4. Click **Add secret** for each one

## Step 3b: Configure Reply-To Email (Optional)

The `REPLY_TO_EMAIL` allows users to reply to a different email address than where the notification is sent from:

**Benefits:**
- Emails sent from Zohomail (`tech@signaturetv.co`)
- Users reply to your personal or support email (`info@gmail.com`)
- Centralize support inquiries in one inbox

**Example scenarios:**

```
Emails sent from:    tech@signaturetv.co (Zohomail)
Users reply to:      info@gmail.com (Gmail)
                     or support@otherdomain.com (Any domain)
```

**How it works:**
1. User receives email from `tech@signaturetv.co`
2. User clicks "Reply" in their email client
3. Reply goes to `info@gmail.com` (not `tech@signaturetv.co`)
4. You read the reply in your Gmail account

**To enable:**
```bash
supabase secrets set REPLY_TO_EMAIL=info@gmail.com
```

If you don't set `REPLY_TO_EMAIL`, it defaults to your `ADMIN_EMAIL`.

## Step 4: Deploy the Updated Edge Function

```bash
supabase functions deploy send-ticket-notification
```

## Step 5: Test Email Sending

Create a test ticket through the admin dashboard at `/admin/tickets/create`:

1. Fill in the form with test data
2. Click "Create Ticket"
3. Check that:
   - ✅ User receives email notification
   - ✅ Admin receives alert email
   - ✅ Email logs show "sent" status

### Checking Email Logs

```sql
-- View all email logs in Supabase SQL Editor
SELECT 
  id, 
  ticket_id, 
  recipient_email, 
  status, 
  sent_at, 
  error_message 
FROM public.email_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

## Troubleshooting

### Email Not Sending?

**Problem:** "ZOHO_PASSWORD not configured"
- **Solution:** Make sure you added `ZOHO_PASSWORD` to Supabase secrets

**Problem:** "Authentication failed"
- **Solution:** 
  - Verify your app-specific password is correct (copy-paste carefully)
  - Ensure password hasn't expired
  - Check SMTP host and port are correct for your region

**Problem:** "Connection refused"
- **Solution:**
  - Verify `ZOHO_SMTP_HOST` (e.g., `smtp.zoho.com` for US)
  - Check if port 465 or 587 is accessible
  - Try the alternative port (465 vs 587)

**Problem:** "Sender rejected"
- **Solution:**
  - Ensure `ZOHO_EMAIL` is a valid Zohomail address you own
  - Verify the email address matches your Zohomail account

### Check Logs

View edge function logs:

```bash
supabase functions list
supabase functions logs send-ticket-notification
```

### Test SMTP Directly

You can test SMTP connection using Telnet or a tool like `swaks`:

```bash
telnet smtp.zoho.com 465
```

## Configuration Examples

### Multiple Email Accounts

To send from different Zohomail accounts for different ticket types:

Update the edge function `send-ticket-notification/index.ts`:

```typescript
// Route tickets to different email accounts
const getSenderEmail = (category: string) => {
  switch (category) {
    case 'Payment Issue':
      return 'payments@signaturetv.co';
    case 'Streaming Issue':
      return 'support@signaturetv.co';
    case 'Creator Issue':
      return 'creators@signaturetv.co';
    default:
      return 'tech@signaturetv.co';
  }
};
```

Then update the transporter to use the appropriate email.

### Reply-To Email Example

**Configuration:**
```
ZOHO_EMAIL = tech@signaturetv.co
REPLY_TO_EMAIL = info@gmail.com
ADMIN_EMAIL = ceo@signaturetv.co
```

**What User Sees in Email Client:**

```
From: Support Team <tech@signaturetv.co>
Reply-To: info@gmail.com

[User clicks Reply]
↓
To: info@gmail.com  ← Email goes here, not to tech@signaturetv.co
```

**Benefits:**
- ✅ Email sent from your professional Zohomail domain
- ✅ Replies automatically routed to your personal/support Gmail
- ✅ No manual forwarding needed
- ✅ Centralized support inbox

### Using Different Ports

If port 465 doesn't work, try 587:

```
ZOHO_SMTP_PORT=587
```

Then update the transporter secure flag in the edge function.

## Security Best Practices

✅ **Always use app-specific passwords**, not your main Zohomail password
✅ **Store passwords in Supabase Secrets**, not in code or `.env` files
✅ **Rotate passwords regularly** (e.g., quarterly)
✅ **Monitor email logs** for suspicious activity
✅ **Use SMTP over SSL** (port 465) for encryption

## Support References

- [Zohomail SMTP Configuration](https://www.zohomail.com/help/imap-smtp-configuration.html)
- [Zoho Help Center](https://help.zoho.com/)
- [Generate App-Specific Passwords](https://www.zohomail.com/help/app-specific-passwords.html)

## Migration Notes

✅ Successfully migrated from Resend to Zohomail SMTP
✅ No DNS changes required
✅ Emails still work with professional HTML templates
✅ Email tracking in `email_logs` table works as before
✅ Admin notifications still sent to configured email

---

**Status:** ✅ Ready to use Zohomail SMTP for all ticket notifications!
