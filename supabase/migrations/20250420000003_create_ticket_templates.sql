-- Create ticket_templates table
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  internal_note_template TEXT,
  user_message_template TEXT,
  suggested_priority TEXT NOT NULL DEFAULT 'Medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_priority CHECK (suggested_priority IN ('Low', 'Medium', 'High')),
  CONSTRAINT valid_category CHECK (category IN ('Payment Issue', 'Streaming Issue', 'Account Issue', 'Creator Issue', 'Abuse / Fraud', 'General'))
);

-- Enable RLS
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view templates" ON ticket_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category ON ticket_templates(category);
