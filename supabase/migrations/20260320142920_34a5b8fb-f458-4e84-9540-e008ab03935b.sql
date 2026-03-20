
-- Job Listings table
CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  location text,
  type text DEFAULT 'Full-time',
  description text,
  requirements text,
  benefits text,
  salary_range text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active job listings"
  ON public.job_listings FOR SELECT
  USING (status = 'active');

CREATE POLICY "Super admins can manage job listings"
  ON public.job_listings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Job Applications table
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_listing_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  cover_letter text,
  resume_url text,
  portfolio_url text,
  linkedin_url text,
  years_of_experience integer,
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit job applications"
  ON public.job_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admins can manage job applications"
  ON public.job_applications FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Resumes storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

CREATE POLICY "Anyone can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Super admins can view resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_job_listings_updated_at
  BEFORE UPDATE ON public.job_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
