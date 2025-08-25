-- Update the user role to super_admin for the admin account
-- First, let's create a function to safely update user role by email
CREATE OR REPLACE FUNCTION public.update_user_role_by_email(_email text, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
BEGIN
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
$$;

-- Now update the admin account role to super_admin
-- Note: This will only work after the user has signed up with the email above
SELECT public.update_user_role_by_email('signaturepicturesnetwork@gmail.com', 'super_admin'::app_role);