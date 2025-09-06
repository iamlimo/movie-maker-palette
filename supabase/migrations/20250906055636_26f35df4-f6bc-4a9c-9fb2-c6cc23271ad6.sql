-- Enhanced Payment System Schema for Paystack Integration
-- Phase 1: Enhance existing payments table and create new tables for production-grade payment processing

-- First, let's enhance the existing payments table with Paystack-specific fields
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS provider text CHECK (provider IN ('paystack', 'wallet')) DEFAULT 'paystack',
ADD COLUMN IF NOT EXISTS provider_reference text, -- Paystack transaction reference
ADD COLUMN IF NOT EXISTS intent_id text NOT NULL DEFAULT gen_random_uuid()::text, -- idempotency key
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'wallet_topup' CHECK (purpose IN ('wallet_topup', 'rental', 'purchase', 'subscription')),
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update existing status enum to include new statuses
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enhanced_payment_status') THEN
        CREATE TYPE enhanced_payment_status AS ENUM ('initiated', 'pending', 'completed', 'failed', 'refunded', 'success');
    END IF;
END $$;

-- Add new status column (keeping old one for compatibility)
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS enhanced_status enhanced_payment_status DEFAULT 'initiated';

-- Create unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS payments_intent_id_unique ON public.payments(intent_id);
CREATE INDEX IF NOT EXISTS payments_provider_reference_idx ON public.payments(provider_reference);
CREATE INDEX IF NOT EXISTS payments_user_id_status_idx ON public.payments(user_id, enhanced_status);

-- Create transactions ledger for revenue splits and audit trail
CREATE TABLE IF NOT EXISTS public.transactions_ledger (
    ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    party text NOT NULL CHECK (party IN ('platform', 'producer')),
    party_id uuid, -- producer user id if party='producer'
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on transactions_ledger
ALTER TABLE public.transactions_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions_ledger
CREATE POLICY "Super admins can manage ledger" 
ON public.transactions_ledger 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view their own ledger entries" 
ON public.transactions_ledger 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = party_id);

-- Create dedicated wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
    wallet_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create policies for wallets
CREATE POLICY "Users can view their own wallet" 
ON public.wallets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" 
ON public.wallets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets" 
ON public.wallets 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Super admins can manage wallets" 
ON public.wallets 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create payouts table for producer payments
CREATE TABLE IF NOT EXISTS public.payouts (
    payout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
    payout_date timestamp with time zone,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for payouts
CREATE POLICY "Producers can view their own payouts" 
ON public.payouts 
FOR SELECT 
USING (auth.uid() = producer_id);

CREATE POLICY "Super admins can manage payouts" 
ON public.payouts 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create finance audit logs table
CREATE TABLE IF NOT EXISTS public.finance_audit_logs (
    audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on finance_audit_logs
ALTER TABLE public.finance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for finance_audit_logs
CREATE POLICY "Super admins can view audit logs" 
ON public.finance_audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert audit logs" 
ON public.finance_audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create webhook events table to prevent replay attacks
CREATE TABLE IF NOT EXISTS public.webhook_events (
    event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL DEFAULT 'paystack',
    provider_event_id text NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now(),
    payload jsonb,
    UNIQUE(provider, provider_event_id)
);

-- Enable RLS on webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook_events
CREATE POLICY "System can manage webhook events" 
ON public.webhook_events 
FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ledger_payment_id_idx ON public.transactions_ledger(payment_id);
CREATE INDEX IF NOT EXISTS ledger_user_id_idx ON public.transactions_ledger(user_id);
CREATE INDEX IF NOT EXISTS ledger_party_idx ON public.transactions_ledger(party, party_id);
CREATE INDEX IF NOT EXISTS payouts_producer_id_idx ON public.payouts(producer_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payouts(status);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.finance_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.finance_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS webhook_events_provider_event_idx ON public.webhook_events(provider, provider_event_id);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payouts_updated_at ON public.payouts;
CREATE TRIGGER update_payouts_updated_at
    BEFORE UPDATE ON public.payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create wallet for new users
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block profile creation
        RAISE WARNING 'Error creating user wallet: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to create wallet when profile is created
DROP TRIGGER IF EXISTS create_wallet_on_profile_creation ON public.profiles;
CREATE TRIGGER create_wallet_on_profile_creation
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_wallet();

-- Create function for recording finance audit logs
CREATE OR REPLACE FUNCTION public.log_finance_action(
    p_action text,
    p_details jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
    audit_id uuid;
BEGIN
    INSERT INTO public.finance_audit_logs (actor_id, action, details)
    VALUES (auth.uid(), p_action, p_details)
    RETURNING finance_audit_logs.audit_id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;