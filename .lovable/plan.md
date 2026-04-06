

# Push Notifications for iOS & Android

## Overview

Implement push notifications using Capacitor's `@capacitor/push-notifications` plugin with Firebase Cloud Messaging (FCM) for Android and Apple Push Notification service (APNs) for iOS. Super admins can broadcast notifications from the admin dashboard.

## Prerequisites (User Setup Required)

Before this works end-to-end, you'll need to configure:

1. **Firebase project** — Create a Firebase project, enable Cloud Messaging, download `google-services.json` (Android) and add your iOS app to get APNs configured
2. **FCM Server Key** — Store as a Supabase secret (`FCM_SERVER_KEY`) for the edge function to send notifications
3. **Apple Developer Account** — Enable Push Notifications capability and upload APNs key to Firebase

## Database

### New table: `push_device_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL | |
| `token` | text NOT NULL | FCM/APNs device token |
| `platform` | text NOT NULL | `'ios'` or `'android'` |
| `is_active` | boolean DEFAULT true | Soft-disable stale tokens |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | |

Unique constraint on `(user_id, token)`. RLS: users manage own tokens; super admins can read all.

### New table: `push_notifications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `title` | text NOT NULL | |
| `body` | text NOT NULL | |
| `data` | jsonb DEFAULT '{}' | Deep link info, etc. |
| `target` | text DEFAULT 'all' | `'all'`, `'user'`, `'topic'` |
| `target_user_id` | uuid | For targeted notifications |
| `sent_count` | integer DEFAULT 0 | |
| `created_by` | uuid | Super admin who sent it |
| `created_at` | timestamptz DEFAULT now() | |

RLS: super admins full access.

## Files to Modify

### 1. Install `@capacitor/push-notifications`
- Add to `package.json` dependencies

### 2. New hook: `src/hooks/usePushNotifications.tsx`
- Register for push notifications on native platforms
- Request permission, get token, listen for registration events
- Save token to `push_device_tokens` table via Supabase client
- Handle incoming notifications (foreground + tap)
- Navigate to relevant content on notification tap using deep link data
- Respect `user_preferences.push_notifications` toggle

### 3. `src/App.tsx`
- Initialize push notifications hook at app root level (inside AuthProvider)

### 4. `capacitor.config.ts`
- Add `PushNotifications` plugin config

### 5. `src/pages/Profile.tsx`
- Wire existing push notifications toggle to actually request/revoke permission

### 6. New edge function: `supabase/functions/send-push-notification/index.ts`
- Accepts `title`, `body`, `data`, `target`, `target_user_id`
- Validates super_admin role
- Fetches active device tokens from `push_device_tokens`
- Sends via FCM HTTP v1 API using `FCM_SERVER_KEY`
- Records notification in `push_notifications` table
- Handles token cleanup (remove invalid tokens on FCM error)

### 7. New admin page: `src/pages/admin/PushNotifications.tsx`
- Form to compose notification: title, body, optional deep link URL
- Target selector: all users, specific user (search by email)
- Send button with confirmation dialog
- History table showing past notifications with sent count and timestamp

### 8. `src/components/admin/AdminLayout.tsx`
- Add "Push Notifications" item with `Bell` icon

### 9. Native setup files (user must do after git pull)
- **Android**: Place `google-services.json` in `android/app/`
- **iOS**: Enable Push Notifications capability in Xcode, upload APNs key to Firebase

## Architecture Flow

```text
┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│  Admin sends  │────▸│  Edge Function │────▸│  FCM / APNs │
│  notification │     │  send-push-    │     │  (Google)   │
└──────────────┘     │  notification  │     └──────┬──────┘
                     └───────────────┘            │
                                                   ▼
                                          ┌──────────────┐
                                          │  User Device  │
                                          │  (iOS/Android)│
                                          └──────────────┘
```

## Implementation Notes

- Tokens are registered on app launch when user is authenticated and push_notifications preference is enabled
- On sign-out, tokens are soft-deactivated (`is_active = false`)
- FCM HTTP v1 API used for sending (supports both iOS and Android via single endpoint)
- Notification tap navigates using existing deep link infrastructure (`useDeepLinking`)
- Web platform is excluded — push notifications are native-only

