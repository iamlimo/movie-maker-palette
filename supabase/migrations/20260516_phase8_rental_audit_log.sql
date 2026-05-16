-- PHASE 8: Unified Logging Layer
-- 
-- This creates an audit log table for rental system debugging.
-- Every step of the rental flow is logged for complete visibility.

CREATE TABLE IF NOT EXISTS public.rental_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'movie' | 'season' | 'episode'
  step TEXT NOT NULL, -- 'access_check', 'validation', 'intent_created', 'payment_started', 'payment_confirmed', 'webhook_received', 'access_granted', 'error'
  status TEXT NOT NULL, -- 'pending' | 'success' | 'error'
  message TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Rental context
  rental_intent_id UUID,
  rental_access_id UUID,
  payment_method TEXT, -- 'wallet' | 'paystack'
  amount_kobo INT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Indexes for efficient querying
  CONSTRAINT valid_step CHECK (step IN ('access_check', 'validation', 'intent_created', 'payment_started', 'payment_confirmed', 'webhook_received', 'access_granted', 'error')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_rental_audit_user_time 
  ON public.rental_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rental_audit_content 
  ON public.rental_audit_log(content_type, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rental_audit_intent 
  ON public.rental_audit_log(rental_intent_id);

CREATE INDEX IF NOT EXISTS idx_rental_audit_step 
  ON public.rental_audit_log(step, status, created_at DESC);

ALTER TABLE public.rental_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own audit logs
CREATE POLICY "Users can view their own rental audit logs"
  ON public.rental_audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all logs
CREATE POLICY "Admins can view all rental audit logs"
  ON public.rental_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- System can insert logs
CREATE POLICY "System can insert audit logs"
  ON public.rental_audit_log FOR INSERT
  WITH CHECK (true);

-- Document the logging system
COMMENT ON TABLE public.rental_audit_log IS
  'PHASE 8: Unified audit log for rental system.
  Every rental step is logged for debugging and troubleshooting.
  Schema:
  - step: Tracks the rental flow stage (access_check -> intent_created -> payment_started -> webhook_received -> access_granted)
  - status: Whether the step succeeded or failed
  - metadata: Additional context (error messages, API responses, etc.)';

-- Create function to log rental steps
CREATE OR REPLACE FUNCTION public.log_rental_step(
  p_user_id UUID,
  p_content_id TEXT,
  p_content_type TEXT,
  p_step TEXT,
  p_status TEXT,
  p_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_rental_intent_id UUID DEFAULT NULL,
  p_rental_access_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_amount_kobo INT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.rental_audit_log (
    user_id,
    content_id,
    content_type,
    step,
    status,
    message,
    metadata,
    rental_intent_id,
    rental_access_id,
    payment_method,
    amount_kobo
  ) VALUES (
    p_user_id,
    p_content_id,
    p_content_type,
    p_step,
    p_status,
    p_message,
    p_metadata,
    p_rental_intent_id,
    p_rental_access_id,
    p_payment_method,
    p_amount_kobo
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.log_rental_step IS
  'Log a step in the rental process.
  Used by edge functions to track rental flow.
  Example: SELECT log_rental_step(user_id, content_id, ''movie'', ''intent_created'', ''success'', NULL, ''{...}''::JSONB, intent_id);';
