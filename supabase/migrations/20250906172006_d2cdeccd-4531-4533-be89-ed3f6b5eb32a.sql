-- Fix critical security vulnerability in webhook_events table
-- Remove the overly permissive policy that allows public access

-- First, drop the existing insecure policy
DROP POLICY IF EXISTS "System can manage webhook events" ON public.webhook_events;

-- Create secure, restrictive policies

-- Policy 1: Only super admins can view webhook events for auditing/debugging
CREATE POLICY "Super admins can view webhook events" 
ON public.webhook_events 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'));

-- Policy 2: Only system processes (edge functions with service role) can insert webhook events
-- This policy uses auth.role() = 'service_role' to identify system processes
CREATE POLICY "System can insert webhook events" 
ON public.webhook_events 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Policy 3: Only system processes can update webhook processing status
CREATE POLICY "System can update webhook events" 
ON public.webhook_events 
FOR UPDATE 
USING (auth.role() = 'service_role');

-- Policy 4: Prevent deletion of webhook events for audit trail integrity
-- No DELETE policy means no one can delete webhook events, preserving audit trail