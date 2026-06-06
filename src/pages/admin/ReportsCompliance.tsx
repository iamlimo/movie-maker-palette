import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthCheck } from '@/hooks/useAuthCheck';
import { 
  ShieldAlert, 
  RefreshCw, 
  Calendar, 
  User, 
  Terminal, 
  Search,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_id: string;
  metadata: Record<string, any> | null;
}

export default function ReportsCompliance() {
  const { can, isReady } = useAuthCheck();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('compliance_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(((data as any[]) || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        actor_id: row.user_id ?? row.actor_id ?? '',
        metadata: row.metadata,
      })));
    } catch (err) {
      console.error('Error loading compliance audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && can('finance.audit')) {
      fetchAuditLogs();
    }
  }, [isReady]);

  // Security Gate Guard
  if (!isReady) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can('finance.audit')) {
    return (
      <Card className="border-destructive/50 bg-destructive/5 my-6">
        <CardHeader className="flex flex-row items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-destructive/80">
              Your security clearance profile does not authorize viewing the financial or regulatory audit trail.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actor_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('delete') || action.includes('suspend')) return 'destructive';
    if (action.includes('update') || action.includes('edit')) return 'secondary';
    return 'default';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Audit & Compliance Ledger</h1>
          <p className="text-muted-foreground text-sm">
            Immutable log feed capturing sensitive actions across the Signature TV backend ecosystem.
          </p>
        </div>
        <Button onClick={fetchAuditLogs} disabled={loading} variant="outline" className="gap-2 self-start md:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stream
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by action, resource, or actor UUID..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs tracking-wider border-b">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Target Resource</th>
                  <th className="px-4 py-3">Target ID</th>
                  <th className="px-4 py-3">Actor UUID</th>
                  <th className="px-4 py-3 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Streaming ledger rows from security schema...' : 'No audit trail match found.'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium capitalize text-xs">{log.resource_type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                        {log.resource_id}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                          {log.actor_id.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 px-2 gap-1 text-xs"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* JSON Payload Inspector Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Log Metadata Envelope
            </DialogTitle>
            <DialogDescription>
              Granular point-in-time trace parameters recorded during this transaction.
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block">Event UUID:</span>
                  <span className="font-mono font-medium">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Full Actor UUID:</span>
                  <span className="font-mono font-medium">{selectedLog.actor_id}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold block mb-1 text-muted-foreground">Contextual Payload:</span>
                <pre className="p-4 bg-zinc-950 text-zinc-200 font-mono text-xs rounded-lg overflow-x-auto max-h-64 border">
                  {JSON.stringify(selectedLog.metadata || { message: "No execution context tracked." }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}