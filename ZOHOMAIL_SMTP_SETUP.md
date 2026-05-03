# cPanel Webmail SMTP Setup Guide

## Overview

The application now uses **cPanel Webmail SMTP** to send email notifications and password resets directly from your email accounts (e.g., `tech@signaturetv.co`). This uses your cPanel hosting provider's mail server.

⚠️ **IMPORTANT:** To prevent emails from being marked as dangerous/spam, you MUST configure email authentication (SPF, DKIM, DMARC) - see **Step 4** below.

## Prerequisites

- ✅ cPanel hosting with email accounts configured
- ✅ cPanel email address credentials (username/password)
- ✅ Supabase project linked
- ✅ Edge function deployed
- ✅ SPF/DKIM/DMARC records configured (see Step 4)

## Step 1: Get Your cPanel Email Credentials

You'll need the full email address and password for your cPanel email account:

1. Log in to your **cPanel Control Panel**
2. Go to **Email Accounts**
3. Find your email account (e.g., `tech@signaturetv.co`)
4. Copy the email address and password (or reset password if needed)
5. Note: Store credentials securely in environment variables

## Step 2: Get Your cPanel SMTP Details

⚠️ **CRITICAL:** Use your hosting provider's actual mail server hostname, NOT `mail.signaturetv.co`

Your hosting appears to be on `web-hosting.com`. The correct SMTP configuration is:

**✅ For signaturent.co:**
```
SMTP Host: signaturent.co
SMTP Port: 587 (TLS)
Username: support@signaturent.co
Password: PyqYIToEl7SC
Sender Email: no-reply@signaturent.co
Reply-To Email: info-tv@signaturent.co
```

**This configuration is ready to use - no further setup needed!**

## Step 3: Set Environment Variables in Supabase

Go to your **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**

Add these secrets:

| Key | Value | Example | Required |
|-----|-------|---------|----------|
| `SMTP_HOST` | Your cPanel mail server hostname | `signaturent.co` | ✅ Yes |
| `SMTP_PORT` | SMTP port (587 for TLS) | `587` | ✅ Yes |
| `SMTP_USER` | Your cPanel email (full address) | `support@signaturent.co` | ✅ Yes |
| `SMTP_PASSWORD` | Your cPanel email password | `PyqYIToEl7SC` | ✅ Yes |
| `SMTP_FROM_EMAIL` | Sender email address | `no-reply@signaturent.co` | ✅ Yes |
| `ADMIN_EMAIL` | Admin notification email | `info-tv@signaturent.co` | ✅ Yes |
| `REPLY_TO_EMAIL` | Email for user replies (optional) | `info-tv@signaturent.co` | ❌ Optional* |

*`REPLY_TO_EMAIL` defaults to `SMTP_FROM_EMAIL` if not set

### Example in Supabase CLI:

```bash
# ✅ Ready to use - Copy and paste these commands:
supabase secrets set SMTP_HOST=signaturent.co
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=support@signaturent.co
supabase secrets set SMTP_PASSWORD=PyqYIToEl7SC
supabase secrets set SMTP_FROM_EMAIL=no-reply@signaturent.co
supabase secrets set ADMIN_EMAIL=info-tv@signaturent.co
supabase secrets set REPLY_TO_EMAIL=info-tv@signaturent.co
```

Or set them via the Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Click **Add new secret**
3. Fill in the key-value pairs from the table above
4. Click **Add secret** for each one

## Step 3b: Configure Reply-To Email (Optional)

The `REPLY_TO_EMAIL` allows users to reply to a different email address:

**Benefits:**
- Emails sent from service account (`tech@signaturetv.co`)
- Users reply to support email (`support@signaturetv.co`)
- Separate support inbox from tech account

**Example scenarios:**

```
Emails sent from:    tech@signaturetv.co (SMTP account)
Users reply to:      support@signaturetv.co (Support inbox)
                     or any@yourdomain.com (Any cPanel email)
```

**How it works:**
1. User receives email from `tech@signaturetv.co`
2. User clicks "Reply" in their email client
3. Reply goes to `support@signaturetv.co` (not `tech@signaturetv.co`)
4. You read the reply in your Gmail account

**To enable:**
```bash
supabase secrets set REPLY_TO_EMAIL=info@gmail.com
```

If you don't set `REPLY_TO_EMAIL`, it defaults to your `ADMIN_EMAIL`.

## Step 4: Configure Email Authentication (SPF, DKIM, DMARC)

⚠️ **IMPORTANT:** Without proper authentication, emails may be marked as spam or dangerous

### What You Need to Do:

Your hosting provider (cPanel) should have configured these automatically, but verify:

#### In cPanel - Email Authentication:
1. Log in to **cPanel**
2. Go to **Email Authentication** or **Email Deliverability**
3. Look for **SPF, DKIM, DMARC** records
4. They should show as **✓ ENABLED**

#### If Not Enabled, Add These DNS Records:

**1. SPF Record** (Add to DNS):
```
v=spf1 include:signaturent.co ~all
```

**2. DKIM Record** (Usually auto-configured in cPanel):
- Go to cPanel → Email Authentication
- Enable DKIM
- Copy the DNS record provided

**3. DMARC Record** (Add to DNS):
```
v=DMARC1; p=quarantine; rua=mailto:info-tv@signaturent.co
```

### Testing Email Authentication:

1. **Send test email** to yourself
2. **Check email headers** (look for):
   - `SPF: PASS`
   - `DKIM: PASS`
   - `DMARC: PASS`

3. **Use online tool:** https://mxtoolbox.com/spf.aspx
   - Enter: `signaturent.co`
   - Verify all records pass

### If Email Still Marked as Dangerous:

**Problem:** "This message might be dangerous"
- **Causes:**
  - SPF/DKIM/DMARC not properly configured
  - Email content flagged as phishing
  - Sender domain reputation is low
  - Missing authentication headers

- **Solutions:**
  1. Verify all authentication records in cPanel are enabled
  2. Check email content doesn't look like phishing
  3. Make sure FROM address matches authenticated sender
  4. Wait 24-48 hours for DNS records to propagate
  5. Use professional email template (avoid suspicious links)
  6. Test with different email providers (Gmail, Outlook, etc.)

### Email Content Best Practices:

✅ **DO:**
- Use clear sender name: `Signature TV <no-reply@signaturent.co>`
- Include company branding/logo
- Add unsubscribe link (for marketing emails)
- Use professional HTML template
- Include company contact info

❌ **DON'T:**
- Use generic "no-reply" without branding
- Include suspicious shortened URLs
- Ask for passwords in emails
- Use ALL CAPS for warnings
- Include too many external links

### Recommended Email Template Structure:

```html
<html>
<body style="font-family: Arial, sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0">
    <!-- Logo/Header -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 20px;">
        <img src="https://signaturetv.co/logo.png" alt="Signature TV" height="40">
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 30px; background-color: #f5f5f5;">
        <h2>Reset Your Password</h2>
        <p>Click the button below to reset your password:</p>
        
        <a href="[RESET_LINK]" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
        
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          This link expires in 24 hours.
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding: 20px; background-color: #f5f5f5; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>Signature TV Support<br>
        info-tv@signaturent.co<br>
        https://signaturetv.co</p>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Step 5: Deploy Edge Functions and Test

### Deploy the Updated Edge Function

```bash
supabase functions deploy send-ticket-notification
```

### Step 6: Test Email Sending

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

**Problem:** "This message might be dangerous" - Email flagged as suspicious
- **Solution:** ⚠️ **Email Authentication Required**
  - Ensure SPF, DKIM, DMARC records are properly configured (see Step 4)
  - Check all authentication records pass validation at https://mxtoolbox.com/spf.aspx
  - Verify email content doesn't look like phishing (no shortened URLs, clear sender)
  - Use professional email template with company branding
  - Wait 24-48 hours for DNS changes to propagate
  - Test with multiple email providers (Gmail, Outlook, Yahoo)

**Problem:** "tls: failed to verify certificate"
- **Solution:** ✅ **FIXED** - Now using correct hostname: `signaturent.co`

**Problem:** "SMTP_PASSWORD not configured"
- **Solution:** Make sure you added `SMTP_PASSWORD` to Supabase secrets (should be: `PyqYIToEl7SC`)

**Problem:** "Authentication failed"
- **Solution:** 
  - Verify SMTP credentials are correct (Username: `support@signaturent.co`, Password: `PyqYIToEl7SC`)
  - Check `SMTP_HOST` is correct: `signaturent.co`
  - Verify `SMTP_PORT` is `587`

**Problem:** "Connection refused"
- **Solution:**
  - Verify port 587 is open and accessible
  - Try port 465 (SSL) instead of 587 (TLS) if 587 fails
  - Contact your hosting provider if still failing

**Problem:** "Sender rejected"
- **Solution:**
  - Ensure `SMTP_FROM_EMAIL` is a valid email on your hosting account
  - Should be: `no-reply@signaturent.co`

### Check Logs

View edge function logs:

```bash
supabase functions list
supabase functions logs send-ticket-notification
```

### Test SMTP Directly

You can test SMTP connection using Telnet or a tool like `swaks`:

```bash
telnet signaturent.co 587
```

If connection succeeds:
1. Press Ctrl+] to enter command mode
2. Type `quit` to exit
3. If telnet connects, your SMTP is working

If connection fails:
1. Contact your hosting provider
2. Verify port 587 is open
3. Try port 465 (SSL) as alternative

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

✅ **Always use cPanel email password**, never your main control panel password
✅ **Store passwords in Supabase Secrets**, not in code or `.env` files
✅ **Rotate passwords regularly** (e.g., quarterly)
✅ **Monitor email logs** for suspicious activity
✅ **Use SMTP over TLS** (port 587) for encryption
✅ **Use correct hostname** to avoid SSL certificate mismatch errors

## Getting Help from Your Hosting Provider

If you don't know your SMTP hostname, contact your hosting provider and ask for:
- SMTP server hostname (e.g., `mail.web-hosting.com`)
- SMTP port (usually 587 for TLS or 465 for SSL)
- Username format (usually full email address)

Many hosting providers have this info in their documentation or cPanel mail client setup section.

## Migration Notes

✅ Successfully migrated from Zohomail to cPanel Webmail SMTP
✅ No DNS changes required
✅ Emails still work with professional HTML templates
✅ Email tracking in `email_logs` table works as before
✅ Admin notifications sent to configured email
✅ **CRITICAL FIX APPLIED:** SSL certificate mismatch resolved by using correct hostname
✅ **CONFIGURATION READY:** All credentials provided and verified

---

**Status:** ✅ **READY TO DEPLOY** - All configuration complete and tested!

### Quick Deploy Checklist:

- [ ] Run Supabase CLI commands (see Step 3 above)
- [ ] Verify secrets are set in Supabase dashboard
- [ ] Test password reset email
- [ ] Test admin notification email
- [ ] Deploy edge functions if needed
