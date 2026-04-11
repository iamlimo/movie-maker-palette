import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  Filter,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuditLog {
  audit_id: string;
  actor_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
  actor_email?: string;
  actor_name?: string;
}

export const AuditTrail = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('finance_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      // Apply search
      if (searchTerm) {
        query = query.or(`
          action.ilike.%${searchTerm}%,
          audit_id.ilike.%${searchTerm}%
        `);
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data: logsData, error, count } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch audit logs',
          variant: 'destructive',
        });
        return;
      }

      // Fetch actor profiles/info for actor_id
      const actorIds = logsData?.map(l => l.actor_id).filter(Boolean) || [];
      let actorsMap: Record<string, { email: string; name: string }> = {};

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, name')
          .in('user_id', actorIds);

        if (profiles) {
          actorsMap = profiles.reduce((acc, profile) => {
            acc[profile.user_id] = { email: profile.email, name: profile.name };
            return acc;
          }, {} as Record<string, { email: string; name: string }>);
        }
      }

      const logsWithActors = logsData?.map(log => ({
        ...log,
        details: (log.details || {}) as Record<string, any>,
        actor_email: actorsMap[log.actor_id]?.email || 'System',
        actor_name: actorsMap[log.actor_id]?.name || 'System',
      })) || [];

      setLogs(logsWithActors);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, actionFilter, searchTerm]);

  const exportAuditLog = () => {
    const csv = [
      ['Audit Trail Report', new Date().toLocaleDateString()],
      [],
      ['Date', 'Action', 'Performed By', 'Details'],
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.action,
        log.actor_email || 'System',
        JSON.stringify(log.details),
      ]),
    ];

    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created') || action.includes('completed')) return 'default';
    if (action.includes('failed') || action.includes('refunded')) return 'destructive';
    return 'secondary';
  };

  const getActionDescription = (action: string): string => {
    const descriptions: Record<string, string> = {
      payment_created: 'Payment Created',
      payment_completed: 'Payment Completed',
      payment_failed: 'Payment Failed',
      payment_refunded: 'Payment Refunded',
      rental_created: 'Rental Created',
      rental_expired: 'Rental Expired',
      payout_created: 'Payout Initiated',
      payout_completed: 'Payout Completed',
      payout_failed: 'Payout Failed',
      wallet_adjusted: 'Wallet Balance Adjusted',
      reconciliation_run: 'Reconciliation Executed',
      payout_status_updated: 'Payout Status Updated',
    };
    return descriptions[action] || action;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading audit logs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Audit Trail</h2>
          <p className="text-muted-foreground">Track all financial transactions and administrative actions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAuditLogs} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportAuditLog} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setCurrentPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="payment_created">Payment Created</SelectItem>
            <SelectItem value="payment_completed">Payment Completed</SelectItem>
            <SelectItem value="payment_failed">Payment Failed</SelectItem>
            <SelectItem value="payment_refunded">Payment Refunded</SelectItem>
            <SelectItem value="rental_created">Rental Created</SelectItem>
            <SelectItem value="rental_expired">Rental Expired</SelectItem>
            <SelectItem value="payout_created">Payout Initiated</SelectItem>
            <SelectItem value="payout_completed">Payout Completed</SelectItem>
            <SelectItem value="payout_failed">Payout Failed</SelectItem>
            <SelectItem value="wallet_adjusted">Wallet Adjusted</SelectItem>
            <SelectItem value="reconciliation_run">Reconciliation Run</SelectItem>
            <SelectItem value="payout_status_updated">Payout Status Updated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Audit Logs ({logs.length} results)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Log ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No audit logs found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.audit_id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {getActionDescription(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium">{log.actor_name}</p>
                          <p className="text-xs text-muted-foreground">{log.actor_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.audit_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Details</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-2 max-w-sm max-h-64 overflow-auto text-xs">
                              <p className="mb-2">
                                <strong>Audit ID:</strong> {log.audit_id}
                              </p>
                              <p className="mb-2">
                                <strong>Action:</strong> {log.action}
                              </p>
                              <p className="mb-2">
                                <strong>Details:</strong>
                              </p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};