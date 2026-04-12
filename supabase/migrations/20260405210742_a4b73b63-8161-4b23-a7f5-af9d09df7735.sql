
-- Create referral_codes table
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  times_used integer NOT NULL DEFAULT 0,
  max_uses_per_user integer NOT NULL DEFAULT 1,
  min_purchase_amount numeric NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create referral_code_uses table
CREATE TABLE public.referral_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payment_id uuid,
  discount_applied numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_code_uses ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_codes
CREATE POLICY "Super admins can manage referral codes" ON public.referral_codes
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view active codes" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- RLS policies for referral_code_uses
CREATE POLICY "Super admins can manage code uses" ON public.referral_code_uses
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view their own code uses" ON public.referral_code_uses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert code uses" ON public.referral_code_uses
  FOR INSERT WITH CHECK (true);
