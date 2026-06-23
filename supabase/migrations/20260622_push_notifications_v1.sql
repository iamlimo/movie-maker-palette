-- Push notifications v1: normalized device tokens + notification audit/history + RLS
-- Tables: public.push_device_tokens, public.push_notifications

BEGIN;

-- 1) Device tokens
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  token text NOT NULL,
  device_type text NOT NULL DEFAULT 'unknown', -- 'ios'|'android'|'web'|'unknown'
  last_used_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_device_tokens_token_unique UNIQUE (token),
  CONSTRAINT push_device_tokens_user_token_unique UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS push_device_tokens_user_id_idx
  ON public.push_device_tokens(user_id);

CREATE INDEX IF NOT EXISTS push_device_tokens_active_idx
  ON public.push_device_tokens(is_active);

-- 2) Notification history
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  target text NOT NULL DEFAULT 'all', -- 'all' | 'user'
  target_user_id uuid NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  sent_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_notifications_created_by_idx
  ON public.push_notifications(created_by, created_at DESC);

-- 3) RLS
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

-- Device token access:
-- - users can manage their own tokens
-- - staff/admin can view all (optional but helpful for ops/debug)
DROP POLICY IF EXISTS push_device_tokens_select_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_select_own
  ON public.push_device_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS push_device_tokens_insert_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_insert_own
  ON public.push_device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS push_device_tokens_update_own ON public.push_device_tokens;
CREATE POLICY push_device_tokens_update_own
  ON public.push_device_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Notification history:
-- - only creator (user) or staff/admin can read
DROP POLICY IF EXISTS push_notifications_select_own ON public.push_notifications;
CREATE POLICY push_notifications_select_own
  ON public.push_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by OR public.is_staff(auth.uid()));

-- Edge/admin writes via service role; still keep strict client policies:
-- - regular users cannot create notification history directly
DROP POLICY IF EXISTS push_notifications_insert_staff ON public.push_notifications;
CREATE POLICY push_notifications_insert_staff
  ON public.push_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Prevent client DELETE (optional hardening)
DROP POLICY IF EXISTS push_notifications_delete_staff ON public.push_notifications;
CREATE POLICY push_notifications_delete_staff
  ON public.push_notifications
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_device_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notifications TO authenticated;

GRANT ALL ON public.push_device_tokens TO service_role;
GRANT ALL ON public.push_notifications TO service_role;

COMMIT;
