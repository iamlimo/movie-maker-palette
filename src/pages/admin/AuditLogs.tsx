import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Eye, KeyRound, LogIn, RefreshCw, Search, ShieldCheck, Terminal, User } from 'lucide-react';

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_id: string | null;
  metadata: any;
}

const PERMISSION_RESOURCES = ['roles', 'permissions', 'role_permissions', 'user_roles'];
const AUTH_RESOURCES = ['auth', 'auth.session', 'auth.user'];

function LogTable({ logs, loading, emptyText }: { logs: AuditLog[]; loading: boolean; emptyText: string }) {
  const [selected, setSelected] = useState<AuditLog | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!logs.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-xs tracking-wider border-b">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={/delete|revoke|suspend|fail/i.test(log.action) ? 'destructive' : 'secondary'}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="font-medium">{log.resource_type}</span>
                  {log.resource_id && (
                    <span className="ml-1 font-mono text-muted-foreground">
                      {String(log.resource_id).substring(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                    {log.user_id ? `${log.user_id.substring(0, 8)}…` : 'system'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => setSelected(log)}>
                    <Eye className="h-3.5 w-3.5" />
                    Inspect
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>Full event payload captured for this audit row.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block">Event UUID</span>
                  <span className="font-mono font-medium break-all">{selected.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Actor UUID</span>
                  <span className="font-mono font-medium break-all">{selected.user_id || 'system'}</span>
                </div>
              </div>
              <pre className="p-4 bg-zinc-950 text-zinc-200 font-mono text-xs rounded-lg overflow-x-auto max-h-64 border">
                {JSON.stringify(selected.metadata || { message: 'No metadata recorded.' }, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AuditLogs() {
  const [permLogs, setPermLogs] = useState<AuditLog[]>([]);
  const [authLogs, setAuthLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [permRes, authRes] = await Promise.all([
        supabase
          .from('compliance_audit_logs')
          .select('*')
          .in('resource_type', PERMISSION_RESOURCES)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('compliance_audit_logs')
          .select('*')
          .in('resource_type', AUTH_RESOURCES)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      setPermLogs((permRes.data ?? []) as AuditLog[]);
      setAuthLogs((authRes.data ?? []) as AuditLog[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filter = (rows: AuditLog[]) => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      r.action.toLowerCase().includes(s) ||
      r.resource_type.toLowerCase().includes(s) ||
      (r.user_id || '').toLowerCase().includes(s) ||
      (r.resource_id || '').toLowerCase().includes(s)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Audit Logs
          </h2>
          <p className="text-sm text-muted-foreground">Authentication events and permission changes across the platform.</p>
        </div>
        <Button onClick={fetchLogs} disabled={loading} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action, resource, or actor…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions" className="gap-2">
            <KeyRound className="h-4 w-4" /> Permission Changes
            <Badge variant="secondary" className="ml-1">{permLogs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="auth" className="gap-2">
            <LogIn className="h-4 w-4" /> Authentication
            <Badge variant="secondary" className="ml-1">{authLogs.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="permissions">
          <Card>
            <CardContent className="p-0">
              <LogTable
                logs={filter(permLogs)}
                loading={loading}
                emptyText="No permission or role change events recorded yet."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="auth">
          <Card>
            <CardContent className="p-0">
              <LogTable
                logs={filter(authLogs)}
                loading={loading}
                emptyText="No authentication events recorded yet. New sign-ins and sign-outs will appear here."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}