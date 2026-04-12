
-- Fix 1: Add authorization check to update_user_role_by_email to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.update_user_role_by_email(_email text, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    target_user_id uuid;
BEGIN
    -- Authorization check: only super admins can update roles
    IF NOT has_role(auth.uid(), 'super_admin') THEN
        RAISE EXCEPTION 'Only super admins can update user roles';
    END IF;

    -- Find the user by email in profiles table
    SELECT user_id INTO target_user_id 
    FROM public.profiles 
    WHERE email = _email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', _email;
        RETURN FALSE;
    END IF;
    
    -- Update the user role
    UPDATE public.user_roles 
    SET role = _role
    WHERE user_id = target_user_id;
    
    -- If no existing role record, insert one
    IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, _role);
    END IF;
    
    RETURN TRUE;
END;
$function$;

-- Fix 2: Ensure profiles table has proper permissive SELECT policies for authenticated users only
-- Drop existing SELECT policies and recreate as proper permissive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Recreate as standard (permissive) policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
