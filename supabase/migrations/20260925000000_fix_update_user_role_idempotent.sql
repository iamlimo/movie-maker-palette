CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role public.app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin', 'super_admin']::public.app_role[]) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Forbidden: admin access required'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) THEN
    RETURN json_build_object(
      'success', true,
      'updated', false,
      'message', 'Role already assigned'
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'updated', true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_role_by_email(_email text, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin', 'super_admin']::public.app_role[]) THEN
    RETURN false;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = _email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.update_user_role(v_user_id, _role);
  RETURN true;
END;
$$;
