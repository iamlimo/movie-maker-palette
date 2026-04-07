

# Upgrade Push Notifications to FCM v1 API

## Problem

The current edge function uses the **legacy FCM HTTP API** (`fcm.googleapis.com/fcm/send` with `key=SERVER_KEY`), which Google has deprecated. The `FIREBASE_SERVICE_ACCOUNT` secret is already stored -- we need to switch to the **FCM v1 HTTP API** which uses OAuth2 access tokens derived from the service account JSON.

## What Changes

### 1. `supabase/functions/send-push-notification/index.ts` — Rewrite FCM sending logic

**Remove**: Legacy `FCM_SERVER_KEY` usage, `fcm.googleapis.com/fcm/send` endpoint, `registration_ids` batch format.

**Add**:
- Parse `FIREBASE_SERVICE_ACCOUNT` JSON secret to extract `client_email`, `private_key`, `project_id`
- Generate a short-lived OAuth2 access token by signing a JWT with the service account's RSA private key (using Web Crypto API available in Deno)
- JWT claims: `iss` = client_email, `sub` = client_email, `aud` = `https://oauth2.googleapis.com/token`, `scope` = `https://www.googleapis.com/auth/firebase.messaging`, `iat`/`exp` (1hr)
- Exchange the signed JWT for an access token via `POST https://oauth2.googleapis.com/token`
- Send individual messages to FCM v1 endpoint: `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`
- FCM v1 payload format uses `message.token` (single device) instead of `registration_ids`
- Send concurrently in batches of 50 using `Promise.allSettled` for performance
- Handle v1 error codes: `UNREGISTERED` and `INVALID_ARGUMENT` trigger token deactivation
- Cache the access token in-memory for the function invocation lifetime

**FCM v1 payload structure**:
```text
{
  "message": {
    "token": "<device_token>",
    "notification": { "title": "...", "body": "..." },
    "data": { "deepLink": "/movie/slug" },
    "android": { "priority": "high" },
    "apns": { "payload": { "aps": { "sound": "default", "badge": 1 } } }
  }
}
```

### 2. `src/hooks/usePushNotifications.tsx` — Minor optimization

- Add token deduplication check: before upserting, compare with a ref to skip redundant DB calls on re-registration
- Properly deactivate token on sign-out by storing last registered token in a ref and calling update on unmount

## Architecture

```text
Service Account JSON (secret)
        │
        ▼
  Sign JWT with RSA key (Web Crypto)
        │
        ▼
  Exchange for OAuth2 access token
        │
        ▼
  POST fcm.googleapis.com/v1/projects/{id}/messages:send
        │
        ▼
  Per-device delivery with platform-specific config
```

## Files Modified

1. **`supabase/functions/send-push-notification/index.ts`** — Replace legacy FCM with v1 API using service account JWT auth
2. **`src/hooks/usePushNotifications.tsx`** — Add token caching ref + sign-out deactivation

No database changes needed. No new files.

