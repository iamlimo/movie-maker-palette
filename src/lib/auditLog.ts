import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Safe, fire-and-forget audit log writer.
 * Inserts a row into public.compliance_audit_logs without throwing — failures
 * are swallowed and logged to console so they NEVER break the calling flow.
 */
export async function writeAuditLog(params: {
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // RLS requires auth.uid()
    const row = {
      action: params.action,
      resource_type: params.resource_type,
      resource_id: params.resource_id ?? null,
      user_id: user.id,
      metadata: (params.metadata ?? {}) as Json,
    };
    const { error } = await supabase.from('compliance_audit_logs').insert(row);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[audit] insert failed:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] insert exception:', err);
  }
}