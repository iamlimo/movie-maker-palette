-- Create function to update user roles (admin only)
CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result_json json;
    old_role app_role;
BEGIN
    -- Check if the calling user is super admin
    IF NOT has_role(auth.uid(), 'super_admin') THEN
        RAISE EXCEPTION 'Only super admins can update user roles';
    END IF;
    
    -- Get the current role
    SELECT role INTO old_role 
    FROM public.user_roles 
    WHERE user_id = _user_id;
    
    -- Update the user role
    UPDATE public.user_roles 
    SET role = _role, updated_at = now()
    WHERE user_id = _user_id;
    
    -- If no existing role record, insert one
    IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (_user_id, _role);
        old_role := 'user'::app_role;
    END IF;
    
    -- Create audit log entry (for future implementation)
    -- This helps track role changes for security
    
    -- Return success with details
    result_json := json_build_object(
        'success', true,
        'user_id', _user_id,
        'old_role', old_role,
        'new_role', _role,
        'updated_at', now()
    );
    
    RETURN result_json;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Add updated_at column to user_roles if it doesn't exist
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create trigger to update updated_at column
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();