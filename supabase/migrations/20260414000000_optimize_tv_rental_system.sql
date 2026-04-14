-- Optimize TV Show rental system with improved schema
-- Support for episode and season rentals with wallet or Paystack payment

-- Create or update rentals table with optimized structure
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('episode', 'season', 'movie', 'tv')),
  price BIGINT NOT NULL, -- Price in kobo (lowest denomination)
  discount_applied BIGINT DEFAULT 0,
  final_price BIGINT NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('wallet', 'paystack')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, content_id, content_type, status) WHERE status = 'completed' AND expires_at > now()
);

-- Create rental payments tracking table
CREATE TABLE IF NOT EXISTS rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(255),
  paystack_access_code VARCHAR(255),
  amount BIGINT NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create referral code usage tracking table if not exists
CREATE TABLE IF NOT EXISTS referral_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rental_id UUID REFERENCES rentals(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_rentals_user_completed ON rentals(user_id, status, expires_at) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_rentals_content ON rentals(content_id, content_type, status);
CREATE INDEX IF NOT EXISTS idx_rentals_expiry ON rentals(expires_at);
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_paystack_ref ON rental_payments(paystack_reference);

-- Set row-level security policies
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_code_uses ENABLE ROW LEVEL SECURITY;

-- Policies for rentals table
CREATE POLICY "Users can view their own rentals"
  ON rentals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert rentals"
  ON rentals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update rentals"
  ON rentals FOR UPDATE
  USING (true);

-- Policies for rental_payments
CREATE POLICY "Users can view their own payments"
  ON rental_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Policies for referral_code_uses
CREATE POLICY "Users can view their own referral uses"
  ON referral_code_uses FOR SELECT
  USING (auth.uid() = user_id);

-- Update get-episode-access function to check optimized rentals table
-- This function will be called to verify episode access
CREATE OR REPLACE FUNCTION check_episode_access(p_episode_id UUID, p_user_id UUID)
RETURNS TABLE (
  has_access BOOLEAN,
  access_type VARCHAR,
  season_id UUID,
  expires_at TIMESTAMP
) AS $$
BEGIN
  -- Check if user has direct episode rental
  RETURN QUERY
  SELECT 
    TRUE as has_access,
    'episode'::VARCHAR as access_type,
    e.season_id,
    r.expires_at
  FROM rentals r
  JOIN episodes e ON e.id = r.content_id
  WHERE r.user_id = p_user_id
    AND r.content_id = p_episode_id
    AND r.content_type = 'episode'
    AND r.status = 'completed'
    AND r.expires_at > now()
  LIMIT 1;

  -- If no direct episode rental, check for season rental
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      TRUE as has_access,
      'season'::VARCHAR as access_type,
      e.season_id,
      r.expires_at
    FROM rentals r
    JOIN episodes e ON e.season_id = r.content_id
    WHERE r.user_id = p_user_id
      AND e.id = p_episode_id
      AND r.content_type = 'season'
      AND r.status = 'completed'
      AND r.expires_at > now()
    LIMIT 1;
  END IF;

  -- No access found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::VARCHAR, NULL::UUID, NULL::TIMESTAMP;
  END IF;
END;
$$ LANGUAGE plpgsql;
