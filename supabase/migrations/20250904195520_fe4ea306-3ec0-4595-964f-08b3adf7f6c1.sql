-- Add missing fields to profiles table if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive'));

-- Update existing name field to first_name where first_name is null
UPDATE public.profiles 
SET first_name = name 
WHERE first_name IS NULL AND name IS NOT NULL;

-- Ensure RLS is enabled on all tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create missing RLS policies if they don't exist
DO $$ 
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can view their own preferences') THEN
        CREATE POLICY "Users can view their own preferences" 
        ON public.user_preferences 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can update their own preferences') THEN
        CREATE POLICY "Users can update their own preferences" 
        ON public.user_preferences 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can insert their own preferences') THEN
        CREATE POLICY "Users can insert their own preferences" 
        ON public.user_preferences 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Admins can view all preferences') THEN
        CREATE POLICY "Admins can view all preferences" 
        ON public.user_preferences 
        FOR SELECT 
        USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
    END IF;

    -- Watch history policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'Users can view their own watch history') THEN
        CREATE POLICY "Users can view their own watch history" 
        ON public.watch_history 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'Users can update their own watch history') THEN
        CREATE POLICY "Users can update their own watch history" 
        ON public.watch_history 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'Users can insert their own watch history') THEN
        CREATE POLICY "Users can insert their own watch history" 
        ON public.watch_history 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'Admins can view all watch history') THEN
        CREATE POLICY "Admins can view all watch history" 
        ON public.watch_history 
        FOR SELECT 
        USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
    END IF;

    -- Favorites policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view their own favorites') THEN
        CREATE POLICY "Users can view their own favorites" 
        ON public.favorites 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can manage their own favorites') THEN
        CREATE POLICY "Users can manage their own favorites" 
        ON public.favorites 
        FOR ALL 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Admins can view all favorites') THEN
        CREATE POLICY "Admins can view all favorites" 
        ON public.favorites 
        FOR SELECT 
        USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
    END IF;
END $$;

-- Create function to automatically create user preferences if it doesn't exist
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block profile creation
        RAISE WARNING 'Error creating user preferences: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create preferences when profile is created if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_user_preferences_trigger') THEN
        CREATE TRIGGER create_user_preferences_trigger
            AFTER INSERT ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.create_user_preferences();
    END IF;
END $$;

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON public.watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_content ON public.watch_history(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched ON public.watch_history(last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_content ON public.favorites(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_favorites_added_at ON public.favorites(added_at DESC);

-- Create triggers for updated_at fields if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
        CREATE TRIGGER update_user_preferences_updated_at
            BEFORE UPDATE ON public.user_preferences
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_watch_history_updated_at') THEN
        CREATE TRIGGER update_watch_history_updated_at
            BEFORE UPDATE ON public.watch_history
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;