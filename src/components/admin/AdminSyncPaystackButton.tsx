import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  reference: string;
}

export default function AdminSyncPaystackButton({ reference }: Props) {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);

  // Only show to staff roles
  if (!userRole || !['super_admin', 'admin', 'accounting'].includes(userRole.role)) {
    return null;
  }

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-sync-paystack', {
        body: { reference },
      });

      if (error) throw error;

      toast({ title: 'Sync started', description: `Reference ${reference} synced`, });
    } catch (err: any) {
      console.error('admin sync error', err);
      toast({ title: 'Sync failed', description: err?.message || 'Unable to sync', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={handleSync} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    </Button>
  );
}
