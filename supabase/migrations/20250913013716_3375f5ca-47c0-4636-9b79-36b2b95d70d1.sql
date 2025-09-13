-- Add rental validation and expiration improvements

-- Create function to check for existing active rentals to prevent duplicates
CREATE OR REPLACE FUNCTION public.check_existing_rental(
  p_user_id uuid,
  p_content_id uuid,
  p_content_type content_type
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.rentals
    WHERE user_id = p_user_id
      AND content_id = p_content_id
      AND content_type = p_content_type
      AND status = 'active'
      AND expiration_date > NOW()
  );
END;
$$;

-- Create function to automatically expire rentals
CREATE OR REPLACE FUNCTION public.expire_rentals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.rentals
  SET status = 'expired'
  WHERE status = 'active'
    AND expiration_date <= NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Create indexes for better rental query performance
CREATE INDEX IF NOT EXISTS idx_rentals_user_content ON public.rentals(user_id, content_id, content_type, status);
CREATE INDEX IF NOT EXISTS idx_rentals_expiration ON public.rentals(expiration_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_purchases_user_content ON public.purchases(user_id, content_id, content_type);

-- Create trigger to prevent duplicate active rentals
CREATE OR REPLACE FUNCTION public.prevent_duplicate_rentals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND check_existing_rental(NEW.user_id, NEW.content_id, NEW.content_type) THEN
    RAISE EXCEPTION 'User already has an active rental for this content';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_prevent_duplicate_rentals
  BEFORE INSERT ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_rentals();