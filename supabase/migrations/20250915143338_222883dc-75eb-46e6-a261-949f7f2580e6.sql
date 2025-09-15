-- Create clean rentals table for new payment flow
DROP TABLE IF EXISTS rentals CASCADE;

CREATE TABLE public.rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'tv')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_rentals_user_id ON public.rentals(user_id);
CREATE INDEX idx_rentals_content ON public.rentals(content_id, content_type);
CREATE INDEX idx_rentals_status ON public.rentals(status);
CREATE INDEX idx_rentals_expires_at ON public.rentals(expires_at);

-- Enable RLS
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own rentals" 
ON public.rentals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create rentals" 
ON public.rentals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all rentals" 
ON public.rentals 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));