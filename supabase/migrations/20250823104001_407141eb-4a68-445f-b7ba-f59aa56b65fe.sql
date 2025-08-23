-- =============================================
-- SIGNATURE TV DATABASE SCHEMA
-- Complete implementation with all tables, constraints, and security
-- =============================================

-- Phase 1: Create Enums
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE public.producer_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.content_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.submission_type AS ENUM ('movie', 'tv_show');
CREATE TYPE public.submission_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
CREATE TYPE public.content_type AS ENUM ('movie', 'episode');
CREATE TYPE public.rental_status AS ENUM ('active', 'expired');
CREATE TYPE public.transaction_type AS ENUM ('rental', 'purchase', 'wallet_topup');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Phase 2: Core Tables
-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    date_of_birth DATE,
    phone_number TEXT,
    country TEXT,
    wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Genres table
CREATE TABLE public.genres (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 3: Content Management Tables
-- Movies table
CREATE TABLE public.movies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    genre_id UUID REFERENCES public.genres(id),
    release_date DATE,
    duration INTEGER, -- in minutes
    language TEXT,
    rating TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    thumbnail_url TEXT,
    video_url TEXT,
    status content_status NOT NULL DEFAULT 'pending',
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- TV Shows table
CREATE TABLE public.tv_shows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    genre_id UUID REFERENCES public.genres(id),
    release_date DATE,
    language TEXT,
    rating TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    thumbnail_url TEXT,
    status content_status NOT NULL DEFAULT 'pending',
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seasons table
CREATE TABLE public.seasons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tv_show_id UUID NOT NULL REFERENCES public.tv_shows(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tv_show_id, season_number)
);

-- Episodes table
CREATE TABLE public.episodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    episode_number INTEGER NOT NULL,
    duration INTEGER, -- in minutes
    release_date DATE,
    video_url TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status content_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(season_id, episode_number)
);

-- Phase 4: Producer & Submission System
-- Producers table
CREATE TABLE public.producers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    bio TEXT,
    status producer_status NOT NULL DEFAULT 'pending',
    reviewer_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Submissions table
CREATE TABLE public.submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    producer_id UUID NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type submission_type NOT NULL,
    file_url TEXT,
    status submission_status NOT NULL DEFAULT 'pending',
    reviewer_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Phase 5: Rental & Purchase System
-- Rentals table
CREATE TABLE public.rentals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type content_type NOT NULL,
    content_id UUID NOT NULL, -- references either movies.id or episodes.id
    rental_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    price_paid DECIMAL(10,2) NOT NULL,
    status rental_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchases table
CREATE TABLE public.purchases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type content_type NOT NULL,
    content_id UUID NOT NULL, -- references either movies.id or episodes.id
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    price_paid DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    method TEXT,
    transaction_type transaction_type NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reference_id TEXT
);

-- Phase 6: Constraints
-- Unique constraint for phone_number + country combination
ALTER TABLE public.profiles ADD CONSTRAINT unique_phone_country 
    UNIQUE (phone_number, country);

-- Phase 7: Indexes for Performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_movies_genre ON public.movies(genre_id);
CREATE INDEX idx_movies_status ON public.movies(status);
CREATE INDEX idx_tv_shows_genre ON public.tv_shows(genre_id);
CREATE INDEX idx_episodes_season ON public.episodes(season_id);
CREATE INDEX idx_rentals_user ON public.rentals(user_id);
CREATE INDEX idx_rentals_content ON public.rentals(content_type, content_id);
CREATE INDEX idx_purchases_user ON public.purchases(user_id);
CREATE INDEX idx_submissions_producer ON public.submissions(producer_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);

-- Phase 8: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Phase 9: Security Definer Functions
-- Function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get current user profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Phase 10: RLS Policies
-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Genres policies (public read access)
CREATE POLICY "Anyone can view genres" ON public.genres
    FOR SELECT USING (true);

CREATE POLICY "Super admins can manage genres" ON public.genres
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Movies policies
CREATE POLICY "Anyone can view approved movies" ON public.movies
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Super admins can manage movies" ON public.movies
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- TV Shows policies
CREATE POLICY "Anyone can view approved tv shows" ON public.tv_shows
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Super admins can manage tv shows" ON public.tv_shows
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Seasons policies
CREATE POLICY "Anyone can view seasons of approved shows" ON public.seasons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tv_shows 
            WHERE id = tv_show_id AND status = 'approved'
        )
    );

CREATE POLICY "Super admins can manage seasons" ON public.seasons
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Episodes policies
CREATE POLICY "Anyone can view episodes of approved shows" ON public.episodes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.seasons s
            JOIN public.tv_shows t ON s.tv_show_id = t.id
            WHERE s.id = season_id AND t.status = 'approved'
        )
    );

CREATE POLICY "Super admins can manage episodes" ON public.episodes
    FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Producers policies
CREATE POLICY "Users can view their own producer profile" ON public.producers
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create producer profiles" ON public.producers
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view and manage producers" ON public.producers
    FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Submissions policies
CREATE POLICY "Producers can view their own submissions" ON public.submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.producers p
            WHERE p.id = producer_id AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Producers can create submissions" ON public.submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.producers p
            WHERE p.id = producer_id AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view and review submissions" ON public.submissions
    FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Rentals policies
CREATE POLICY "Users can view their own rentals" ON public.rentals
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create rentals" ON public.rentals
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all rentals" ON public.rentals
    FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Purchases policies
CREATE POLICY "Users can view their own purchases" ON public.purchases
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create purchases" ON public.purchases
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all purchases" ON public.purchases
    FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Payments policies
CREATE POLICY "Users can view their own payments" ON public.payments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create payments" ON public.payments
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all payments" ON public.payments
    FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Phase 11: Automatic Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
        NEW.email
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Phase 12: Update Timestamp Triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_movies_updated_at
    BEFORE UPDATE ON public.movies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tv_shows_updated_at
    BEFORE UPDATE ON public.tv_shows
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_producers_updated_at
    BEFORE UPDATE ON public.producers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 13: Sample Data
INSERT INTO public.genres (name) VALUES 
    ('Action'),
    ('Comedy'),
    ('Drama'),
    ('Horror'),
    ('Sci-Fi'),
    ('Romance'),
    ('Thriller'),
    ('Documentary'),
    ('Animation'),
    ('Adventure');