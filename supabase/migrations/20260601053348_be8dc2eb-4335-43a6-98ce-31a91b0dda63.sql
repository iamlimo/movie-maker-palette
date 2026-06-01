
-- =====================================================
-- Restore RLS policies, GRANTs, and signup trigger
-- =====================================================

-- A. Re-enable RLS on tables where it got disabled
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets    ENABLE ROW LEVEL SECURITY;

-- B. Recreate handle_new_user + trigger (profile + wallet + 400 NGN signup bonus)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_phone text;
BEGIN
  v_name  := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data->>'phone_number';

  INSERT INTO public.profiles (user_id, name, email, phone_number, created_at, updated_at)
  VALUES (NEW.id, v_name, NEW.email, v_phone, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        updated_at = now();

  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 400 NGN signup bonus (idempotent via reference)
  PERFORM public.grant_signup_bonus(NEW.id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- C. Helper: safer drop-and-create for repeated policy names
-- (we just create policies; if they exist we drop first via IF EXISTS)

-- =====================================================
-- PUBLIC READ, STAFF WRITE (catalog/homepage)
-- =====================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'movies','tv_shows','seasons','episodes','genres',
    'sections','content_sections','slider_items','banners',
    'cast_crew','movie_cast','tv_show_cast','episode_cast'
  ]
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_public_select" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_public_select" ON public.%I FOR SELECT USING (true)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_insert" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_update" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;

-- =====================================================
-- JOB LISTINGS: public read of active, staff full
-- =====================================================
GRANT SELECT ON public.job_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_listings TO authenticated;
GRANT ALL ON public.job_listings TO service_role;

DROP POLICY IF EXISTS "job_listings_public_select_active" ON public.job_listings;
CREATE POLICY "job_listings_public_select_active" ON public.job_listings
  FOR SELECT USING (status = 'active' OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "job_listings_staff_write" ON public.job_listings;
CREATE POLICY "job_listings_staff_write" ON public.job_listings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================
-- USER-OWNED DATA (auth.uid() = user_id, plus staff read)
-- =====================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rentals','rental_intents','rental_access','payments',
    'wallet_transactions','favorites','watch_history',
    'user_preferences','purchases','referral_code_uses',
    'push_device_tokens','user_payments'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_own" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_update_own" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid())) WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;

-- =====================================================
-- STAFF-ONLY tables
-- =====================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'referral_codes','payouts','finance_audit_logs','transactions_ledger',
    'payment_anomalies','payment_attempts','producers','submissions',
    'rental_payments','rental_audit_log','email_logs','push_notifications',
    'ticket_templates','permissions','roles','role_permissions',
    'webhook_events','job_applications'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_all" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_all" ON public.%I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Allow public/anon to INSERT a job application (public careers form)
DROP POLICY IF EXISTS "job_applications_public_insert" ON public.job_applications;
CREATE POLICY "job_applications_public_insert" ON public.job_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);
GRANT INSERT ON public.job_applications TO anon;

-- =====================================================
-- TICKETS (owner can read own, staff full)
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_activity_log TO authenticated;
GRANT ALL ON public.tickets, public.ticket_comments, public.ticket_activity_log TO service_role;

DROP POLICY IF EXISTS "tickets_owner_select" ON public.tickets;
CREATE POLICY "tickets_owner_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "tickets_staff_write" ON public.tickets;
CREATE POLICY "tickets_staff_write" ON public.tickets
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "tickets_owner_insert" ON public.tickets;
CREATE POLICY "tickets_owner_insert" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "ticket_comments_select" ON public.ticket_comments;
CREATE POLICY "ticket_comments_select" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS "ticket_comments_write" ON public.ticket_comments;
CREATE POLICY "ticket_comments_write" ON public.ticket_comments
  FOR ALL TO authenticated
  USING (author_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "ticket_activity_log_staff" ON public.ticket_activity_log;
CREATE POLICY "ticket_activity_log_staff" ON public.ticket_activity_log
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================
-- USER_ROLES: keep own-select, add super_admin full
-- =====================================================
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================
-- PROFILES: keep own-policies, add staff select
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "profiles_staff_select" ON public.profiles;
CREATE POLICY "profiles_staff_select" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "profiles_staff_update" ON public.profiles;
CREATE POLICY "profiles_staff_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================
-- WALLETS: keep own-select, add staff select
-- =====================================================
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

DROP POLICY IF EXISTS "wallets_staff_select" ON public.wallets;
CREATE POLICY "wallets_staff_select" ON public.wallets
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
