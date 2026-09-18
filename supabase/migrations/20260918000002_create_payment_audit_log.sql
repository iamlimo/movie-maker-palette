-- Create payment_audit_log table for admin sync/audit entries
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  payment_id uuid NULL,
  reference text NULL,
  actor_user_id uuid NULL,
  event_type text NOT NULL,
  details jsonb NULL,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.payment_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.payment_audit_log TO service_role;
