-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START WITH 1;

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT ('TKT-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('public.ticket_number_seq')::TEXT, 5, '0')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Ticket metadata
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Payment Issue', 'Streaming Issue', 'Account Issue', 'Creator Issue', 'Abuse / Fraud')),
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  status TEXT NOT NULL CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed', 'On Hold')) DEFAULT 'Open',
  user_type TEXT NOT NULL CHECK (user_type IN ('Viewer', 'Creator')) DEFAULT 'Viewer',
  
  -- Messages
  internal_notes TEXT,
  user_message TEXT NOT NULL,
  
  -- Context attachments (store IDs without foreign keys for flexibility)
  attached_payment_id UUID,
  attached_content_id UUID,
  include_system_logs BOOLEAN DEFAULT FALSE,
  
  -- Admin metadata
  is_admin_created BOOLEAN DEFAULT TRUE,
  template_used TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  assigned_team TEXT DEFAULT 'support',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create ticket comments/history table
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket templates table
CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  internal_note_template TEXT,
  user_message_template TEXT,
  suggested_priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket activity log for audit trail
CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON public.tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON public.ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON public.ticket_activity_log(ticket_id);

-- Create trigger function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_templates_updated_at BEFORE UPDATE ON public.ticket_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_activity_log_updated_at BEFORE UPDATE ON public.ticket_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO ticket_templates (name, category, title, internal_note_template, user_message_template, suggested_priority) VALUES
('Payment Failure Notice', 'Payment Issue', 'Payment processing failed', 'Payment failed to process. Check with finance team.', 'Your payment could not be processed. Our team is investigating this issue.', 'High'),
('Refund Processing', 'Payment Issue', 'Refund request', 'Process refund to user account', 'We are processing your refund. It may take 3-5 business days.', 'Medium'),
('Content Removal Notice', 'Abuse / Fraud', 'Content removal', 'Content flagged for violation', 'Your content has been removed due to policy violation.', 'High'),
('Suspicious Activity Alert', 'Abuse / Fraud', 'Suspicious account activity detected', 'Review account for fraudulent activity', 'We detected unusual activity on your account. Please verify your recent actions.', 'High')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Tickets: Admins can see all, users can see their own
CREATE POLICY "Admins can view all tickets" ON tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own tickets" ON tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can insert tickets" ON tickets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update tickets" ON tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tickets" ON tickets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Comments: Similar policies
CREATE POLICY "Authorized users can view comments" ON ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE id = ticket_id AND (user_id = auth.uid() OR (
        SELECT role FROM auth.users WHERE id = auth.uid()
      ) = 'admin')
    ) OR (NOT is_internal)
  );

CREATE POLICY "Authorized users can insert comments" ON ticket_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE id = ticket_id AND (user_id = auth.uid() OR (
        SELECT role FROM auth.users WHERE id = auth.uid()
      ) = 'admin')
    )
  );

-- Templates: Admins can manage
CREATE POLICY "Anyone can view templates" ON ticket_templates
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage templates" ON ticket_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates" ON ticket_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
