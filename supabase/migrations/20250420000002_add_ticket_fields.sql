-- Add missing columns to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attached_payment_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attached_content_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS include_system_logs BOOLEAN DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT TRUE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS template_used TEXT;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tickets_attached_payment_id ON tickets(attached_payment_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attached_content_id ON tickets(attached_content_id);
