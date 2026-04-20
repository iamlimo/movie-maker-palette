-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'General',
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Open',
  user_type TEXT NOT NULL DEFAULT 'User',
  description TEXT,
  internal_notes TEXT,
  user_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed', 'On Hold')),
  CONSTRAINT valid_priority CHECK (priority IN ('Low', 'Medium', 'High')),
  CONSTRAINT valid_category CHECK (category IN ('Payment Issue', 'Streaming Issue', 'Account Issue', 'Creator Issue', 'Abuse / Fraud', 'General'))
);

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tickets table
-- Allow authenticated users to view all tickets (admin panel)
CREATE POLICY "Authenticated users can view tickets" ON tickets
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create tickets
CREATE POLICY "Authenticated users can create tickets" ON tickets
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update tickets
CREATE POLICY "Authenticated users can update tickets" ON tickets
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete tickets
CREATE POLICY "Authenticated users can delete tickets" ON tickets
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS Policies for ticket_comments table
-- Allow authenticated users to view all comments
CREATE POLICY "Authenticated users can view comments" ON ticket_comments
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments" ON ticket_comments
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update comments
CREATE POLICY "Authenticated users can update comments" ON ticket_comments
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete comments
CREATE POLICY "Authenticated users can delete comments" ON ticket_comments
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
