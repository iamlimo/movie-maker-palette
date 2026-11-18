-- Disable the ₦400 signup bonus for all future registrations.
-- Existing wallet balances are intentionally not clawed back; this only
-- prevents the signup trigger or direct RPC calls from granting new credits.

CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NULL;
END;
$function$;
