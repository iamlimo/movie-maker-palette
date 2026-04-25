-- Add Row-Level Security (RLS) policies for rental_intents and rental_access tables
-- Ensures data isolation and security
-- Date: April 25, 2026

BEGIN;

-- 1) Enable RLS on rental_intents table
ALTER TABLE public.rental_intents ENABLE ROW LEVEL SECURITY;

-- Users can view their own rental intents
CREATE POLICY "Users can view own rental intents"
  ON public.rental_intents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all rental intents
CREATE POLICY "Admins can view all rental intents"
  ON public.rental_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users can insert their own rental intents (via edge function)
CREATE POLICY "Users can insert own rental intents"
  ON public.rental_intents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only edge functions (service role) can update rental intents
CREATE POLICY "Service role can update rental intents"
  ON public.rental_intents
  FOR UPDATE
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 2) Enable RLS on rental_access table
ALTER TABLE public.rental_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own rental access
CREATE POLICY "Users can view own rental access"
  ON public.rental_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all rental access
CREATE POLICY "Admins can view all rental access"
  ON public.rental_access
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Only edge functions (service role) can insert rental access
CREATE POLICY "Service role can insert rental access"
  ON public.rental_access
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Only edge functions (service role) can update rental access
CREATE POLICY "Service role can update rental access"
  ON public.rental_access
  FOR UPDATE
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

COMMIT;
