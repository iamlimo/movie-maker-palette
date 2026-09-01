ALTER TABLE public.compliance_audit_logs
  DROP CONSTRAINT IF EXISTS compliance_audit_logs_user_id_fkey;

ALTER TABLE public.finance_audit_logs
  DROP CONSTRAINT IF EXISTS finance_audit_logs_actor_id_fkey;