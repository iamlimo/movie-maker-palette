-- Fix the payments table by making transaction_type nullable or setting a default
-- Check current payments table structure first
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'payments' AND table_schema = 'public';

-- Make transaction_type nullable or add a default value
ALTER TABLE public.payments 
ALTER COLUMN transaction_type DROP NOT NULL;

-- Or alternatively, set a default value based on purpose
-- ALTER TABLE public.payments 
-- ALTER COLUMN transaction_type SET DEFAULT 'payment';