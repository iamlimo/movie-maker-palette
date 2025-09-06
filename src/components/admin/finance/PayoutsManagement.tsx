import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  User,
  Download
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Payout {
  payout_id: string;
  producer_id: string;
  amount: number;
  status: string;
  payout_date: string | null;
  created_at: string;
  metadata: any;
  profiles?: {
    name: string;
    email: string;
  };
}

export const PayoutsManagement = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);

  const fetchPayouts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('payouts')
        .select(`
          *,
          profiles:producer_id (name, email)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payouts:', error);
        toast({
          title: "Error",
          description: "Failed to fetch payouts",
          variant: "destructive",
        });
        return;
      }

      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  const updatePayoutStatus = async (payoutId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('payouts')
        .update({ 
          status: newStatus,
          payout_date: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('payout_id', payoutId);

      if (error) {
        throw new Error(error.message);
      }

      // Log the action
      await supabase.rpc('log_finance_action', {
        p_action: 'payout_status_updated',
        p_details: {
          payout_id: payoutId,
          new_status: newStatus
        }
      });

      toast({
        title: "Payout Updated",
        description: `Payout status changed to ${newStatus}`,
      });

      fetchPayouts();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update payout status",
        variant: "destructive",
      });
    }
  };

  const processBulkPayouts = async () => {
    if (selectedPayouts.length === 0) {
      toast({
        title: "No Payouts Selected",
        description: "Please select payouts to process",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('payouts')
        .update({ status: 'processing' })
        .in('payout_id', selectedPayouts);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Bulk Processing Started",
        description: `${selectedPayouts.length} payouts are being processed`,
      });

      setSelectedPayouts([]);
      fetchPayouts();
    } catch (error: any) {
      toast({
        title: "Bulk Processing Failed",
        description: error.message || "Failed to process payouts",
        variant: "destructive",
      });
    }
  };

  const exportPayouts = () => {
    const csvData = payouts.map(payout => [
      payout.payout_id,
      payout.profiles?.email || 'Unknown',
      payout.amount,
      payout.status,
      payout.created_at,
      payout.payout_date || 'N/A'
    ]).map(row => row.join(',')).join('\n');

    const headers = 'Payout ID,Producer Email,Amount,Status,Created,Paid Date\n';
    const blob = new Blob([headers + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'payouts.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalQueuedAmount = payouts
    .filter(p => p.status === 'queued')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalProcessingAmount = payouts
    .filter(p => p.status === 'processing')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payout Management</h2>
        <div className="flex gap-2">
          <Button onClick={exportPayouts} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchPayouts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queued Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalQueuedAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {payouts.filter(p => p.status === 'queued').length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalProcessingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {payouts.filter(p => p.status === 'processing').length} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payouts.filter(p => p.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              {selectedPayouts.length > 0 && (
                <Badge variant="secondary">
                  {selectedPayouts.length} selected
                </Badge>
              )}
            </div>

            {selectedPayouts.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Process Payouts</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to process {selectedPayouts.length} selected payouts?
                      This action will mark them as processing and they will be queued for payment.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={processBulkPayouts}>
                      Process Payouts
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payouts ({payouts.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPayouts(payouts.map(p => p.payout_id));
                        } else {
                          setSelectedPayouts([]);
                        }
                      }}
                      checked={selectedPayouts.length === payouts.length && payouts.length > 0}
                    />
                  </TableHead>
                  <TableHead>Producer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.payout_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedPayouts.includes(payout.payout_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPayouts([...selectedPayouts, payout.payout_id]);
                          } else {
                            setSelectedPayouts(selectedPayouts.filter(id => id !== payout.payout_id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{payout.profiles?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{payout.profiles?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">₦{payout.amount.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payout.status)}>
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(payout.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {payout.payout_date 
                        ? new Date(payout.payout_date).toLocaleDateString()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {payout.status === 'queued' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePayoutStatus(payout.payout_id, 'processing')}
                          >
                            Process
                          </Button>
                        )}
                        {payout.status === 'processing' && (
                          <Button
                            size="sm"
                            onClick={() => updatePayoutStatus(payout.payout_id, 'completed')}
                          >
                            Complete
                          </Button>
                        )}
                        {payout.status === 'processing' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updatePayoutStatus(payout.payout_id, 'failed')}
                          >
                            Mark Failed
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};