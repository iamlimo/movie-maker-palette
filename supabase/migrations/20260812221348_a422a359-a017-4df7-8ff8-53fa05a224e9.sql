ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS address text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'creator'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'creator';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_profiles TO authenticated;
GRANT ALL ON public.creator_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_creators TO authenticated;
GRANT ALL ON public.content_creators TO service_role;

DROP POLICY IF EXISTS "Admins can insert creator profiles" ON public.creator_profiles;
CREATE POLICY "Admins can insert creator profiles"
ON public.creator_profiles FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.app_role[]));

DROP POLICY IF EXISTS "Admins can update creator profiles" ON public.creator_profiles;
CREATE POLICY "Admins can update creator profiles"
ON public.creator_profiles FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.app_role[]));

DROP POLICY IF EXISTS "Admins can delete creator profiles" ON public.creator_profiles;
CREATE POLICY "Admins can delete creator profiles"
ON public.creator_profiles FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.app_role[]));
