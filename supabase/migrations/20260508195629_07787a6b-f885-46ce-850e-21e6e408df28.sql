
-- Helper: check if a user holds any of the listed roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- Helper: any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','support','sales','accounting')
  )
$$;

-- ============================================================
-- CONTENT (admin + super_admin manage)
-- ============================================================
CREATE POLICY "Admins can manage movies"      ON public.movies      FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage tv shows"    ON public.tv_shows    FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage seasons"     ON public.seasons     FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage episodes"    ON public.episodes    FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage cast crew"   ON public.cast_crew   FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage movie cast"  ON public.movie_cast  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage episode cast" ON public.episode_cast FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))   WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage genres"      ON public.genres      FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage producers"   ON public.producers   FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))      WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage content sections" ON public.content_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- HOMEPAGE / MARKETING (admin + sales)
-- ============================================================
CREATE POLICY "Admins and sales can manage banners"     ON public.banners      FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[]));
CREATE POLICY "Admins and sales can manage sections"    ON public.sections     FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[]));
CREATE POLICY "Admins and sales can manage slider items" ON public.slider_items FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[]));
CREATE POLICY "Admins and sales can manage referral codes" ON public.referral_codes FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[]));

-- ============================================================
-- TICKETS / SUPPORT (admin + support)
-- ============================================================
CREATE POLICY "Support staff can manage tickets"        ON public.tickets         FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[]));
CREATE POLICY "Support staff can manage ticket comments" ON public.ticket_comments FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[]));
CREATE POLICY "Support staff can view email logs"       ON public.email_logs      FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','support']::public.app_role[]));
CREATE POLICY "Support staff can manage job listings"   ON public.job_listings    FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[]));
CREATE POLICY "Support staff can manage job applications" ON public.job_applications FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','support']::public.app_role[]));

-- ============================================================
-- FINANCE (accounting full read; admin/sales/support read-only where defined)
-- ============================================================
CREATE POLICY "Finance staff can view payments"          ON public.payments          FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting','sales']::public.app_role[]));
CREATE POLICY "Finance staff can view rental payments"   ON public.rental_payments   FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting','sales']::public.app_role[]));
CREATE POLICY "Finance staff can view rental intents"    ON public.rental_intents    FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting','sales','support']::public.app_role[]));
CREATE POLICY "Finance staff can view rental access"     ON public.rental_access     FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting','sales','support']::public.app_role[]));
CREATE POLICY "Finance staff can view rentals"           ON public.rentals           FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting','sales','support']::public.app_role[]));
CREATE POLICY "Accounting can view audit logs"           ON public.finance_audit_logs FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accounting']::public.app_role[]));
CREATE POLICY "Accounting can manage payouts"            ON public.payouts           FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accounting']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accounting']::public.app_role[]));
CREATE POLICY "Accounting can view anomalies"            ON public.payment_anomalies FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','accounting']::public.app_role[]));
CREATE POLICY "Accounting can update anomalies"          ON public.payment_anomalies FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accounting']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accounting']::public.app_role[]));

-- ============================================================
-- USERS / PROFILES (sales gets PII per user request)
-- ============================================================
CREATE POLICY "Staff can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','support','sales','accounting']::public.app_role[]));

CREATE POLICY "Staff can view user roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
