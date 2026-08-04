CREATE TABLE IF NOT EXISTS public.payment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  reason text NOT NULL,
  message text,
  user_id uuid,
  rental_intent_id uuid,
  reference text,
  provider_event_id text,
  attempts integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

CREATE INDEX IF NOT EXISTS payment_alerts_created_at_idx ON public.payment_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_alerts_reference_idx ON public.payment_alerts (reference);
CREATE INDEX IF NOT EXISTS payment_alerts_intent_idx ON public.payment_alerts (rental_intent_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_alerts_unique_reason_per_intent
  ON public.payment_alerts (rental_intent_id, source, reason)
  WHERE rental_intent_id IS NOT NULL;

GRANT SELECT, INSERT ON public.payment_alerts TO authenticated;
GRANT UPDATE ON public.payment_alerts TO authenticated;
GRANT ALL ON public.payment_alerts TO service_role;

ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read payment alerts" ON public.payment_alerts;
CREATE POLICY "Staff can read payment alerts"
  ON public.payment_alerts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can log their own payment alerts" ON public.payment_alerts;
CREATE POLICY "Users can log their own payment alerts"
  ON public.payment_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can acknowledge payment alerts" ON public.payment_alerts;
CREATE POLICY "Staff can acknowledge payment alerts"
  ON public.payment_alerts FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));