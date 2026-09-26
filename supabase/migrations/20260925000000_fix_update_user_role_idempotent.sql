CREATE OR REPLACE FUNCTION public.update_user_role(_user_id uuid, _role public.app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_exists boolean := false;
  v_inserted boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  IF NOT public.has_any_role(auth.uid(), ARRAY['admin', 'super_admin']::public.app_role[]) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Forbidden: admin access required'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
  INTO v_already_exists;

  IF v_already_exists THEN
    RETURN json_build_object(
      'success', true,
      'updated', false,
      'message', 'Role already assigned'
    );
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING
  RETURNING true INTO v_inserted;

  IF v_inserted THEN
    RETURN json_build_object(
      'success', true,
      'updated', true,
      'message', 'Role assigned successfully'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'updated', false,
    'message', 'Role already assigned'
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
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

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

  SELECT public.update_user_role(v_user_id, _role) INTO v_result;
  RETURN COALESCE((v_result->>'success')::boolean, false);
END;
$$;
