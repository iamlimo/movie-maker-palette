-- Disable RLS temporarily to allow ticket operations
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_comments DISABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if any exist
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can create tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view comments on own tickets" ON ticket_comments;
DROP POLICY IF EXISTS "Admins can view all comments" ON ticket_comments;
DROP POLICY IF EXISTS "Admins can create comments" ON ticket_comments;
DROP POLICY IF EXISTS "Admins can update own comments" ON ticket_comments;
DROP POLICY IF EXISTS "Admins can delete comments" ON ticket_comments;
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can delete tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can view comments" ON ticket_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON ticket_comments;
DROP POLICY IF EXISTS "Authenticated users can update comments" ON ticket_comments;
DROP POLICY IF EXISTS "Authenticated users can delete comments" ON ticket_comments;
