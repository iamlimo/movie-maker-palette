import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Download,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import {
  ProgressCircle,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReconciliationStatus {
  totalPayments: number;
  totalRentals: number;
  matchedRecords: number;
  unmatchedPayments: number;
  unmatchedRentals: number;
  reconciliationRate: number;
  discrepancies: {
    amount: number;
    count: number;
  };
}

interface Discrepancy {
  id: string;
  type: 'payment_without_rental' | 'rental_without_payment' | 'amount_mismatch';
  paymentId?: string;
  rentalId?: string;
  paymentAmount?: number;
  rentalAmount?: number;
  userId?: string;
  createdAt: string;
}

export const ReconciliationTools = () => {
  const [status, setStatus] = useState<ReconciliationStatus>({
    totalPayments: 0,
    totalRentals: 0,
    matchedRecords: 0,
    unmatchedPayments: 0,
    unmatchedRentals: 0,
    reconciliationRate: 0,
    discrepancies: { amount: 0, count: 0 },
  });
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationHistory, setReconciliationHistory] = useState<any[]>([]);

  const runReconciliation = async () => {
    setIsReconciling(true);
    try {
      // Fetch all payments and rentals
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('purpose', 'rental');

      const { data: rentals, error: rentalsError } = await supabase
        .from('rentals')
        .select('*');

      if (paymentsError || rentalsError) {
        throw new Error('Failed to fetch data');
      }

      const paymentsList = payments || [];
      const rentalsList = rentals || [];

      // Try to match payments with rentals
      const matched = new Set<string>();
      const foundDiscrepancies: Discrepancy[] = [];
      let totalDiscrepancyAmount = 0;

      // Check for rentals with corresponding payments
      for (const rental of rentalsList) {
        const correspondingPayment = paymentsList.find(
          p =>
            p.user_id === rental.user_id &&
            Math.abs((p.amount || 0) - (rental.amount || 0)) < 1 &&
            new Date(p.created_at).getTime() <= new Date(rental.created_at).getTime() + 5000
        );

        if (correspondingPayment) {
          matched.add(correspondingPayment.id);
        } else {
          foundDiscrepancies.push({
            id: rental.id,
            type: 'rental_without_payment',
            rentalId: rental.id,
            rentalAmount: rental.amount,
            userId: rental.user_id,
            createdAt: rental.created_at,
          });
          totalDiscrepancyAmount += rental.amount || 0;
        }
      }

      // Check for payments without rentals
      for (const payment of paymentsList) {
        if (!matched.has(payment.id)) {
          foundDiscrepancies.push({
            id: payment.id,
            type: 'payment_without_rental',
            paymentId: payment.id,
            paymentAmount: payment.amount,
            userId: payment.user_id,
            createdAt: payment.created_at,
          });
          totalDiscrepancyAmount += payment.amount || 0;
        }
      }

      const reconciliationRate = paymentsList.length > 0 ? (matched.size / paymentsList.length) * 100 : 0;

      setStatus({
        totalPayments: paymentsList.length,
        totalRentals: rentalsList.length,
        matchedRecords: matched.size,
        unmatchedPayments: paymentsList.length - matched.size,
        unmatchedRentals: rentalsList.filter(
          r =>
            !paymentsList.find(
              p =>
                p.user_id === r.user_id &&
                Math.abs((p.amount || 0) - (r.amount || 0)) < 1 &&
                new Date(p.created_at).getTime() <= new Date(r.created_at).getTime() + 5000
            )
        ).length,
        reconciliationRate: Math.min(reconciliationRate, 100),
        discrepancies: {
          amount: totalDiscrepancyAmount,
          count: foundDiscrepancies.length,
        },
      });

      setDiscrepancies(foundDiscrepancies);

      // Save reconciliation report
      const { error: reportError } = await supabase.from('reconciliation_reports').insert({
        status: reconciliationRate > 95 ? 'passed' : 'failed',
        matched_records: matched.size,
        unmatched_count: foundDiscrepancies.length,
        discrepancy_amount: totalDiscrepancyAmount,
        reconciliation_rate: reconciliationRate,
        created_at: new Date().toISOString(),
      });

      if (!reportError) {
        toast({
          title: 'Reconciliation Complete',
          description: `${matched.size} payments matched with rentals`,
        });
      }
    } catch (error) {
      console.error('Reconciliation error:', error);
      toast({
        title: 'Reconciliation Failed',
        description: 'Error running reconciliation',
        variant: 'destructive',
      });
    } finally {
      setIsReconciling(false);
    }
  };

  const resolveDiscrepancy = async (discrepancy: Discrepancy) => {
    try {
      // Implementation depends on discrepancy type
      // For now, mark as reviewed in logs
      toast({
        title: 'Discrepancy noted',
        description: 'Please review manually for resolution',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve discrepancy',
        variant: 'destructive',
      });
    }
  };

  const exportReconciliationReport = () => {
    const csv = [
      ['Reconciliation Report', new Date().toLocaleDateString()],
      [],
      ['Summary'],
      ['Total Payments', status.totalPayments],
      ['Total Rentals', status.totalRentals],
      ['Matched Records', status.matchedRecords],
      ['Unmatched Payments', status.unmatchedPayments],
      ['Unmatched Rentals', status.unmatchedRentals],
      ['Reconciliation Rate', `${status.reconciliationRate.toFixed(2)}%`],
      ['Total Discrepancy Amount', `₦${status.discrepancies.amount.toFixed(2)}`],
      [],
      ['Discrepancies'],
      ['ID', 'Type', 'Amount', 'User ID', 'Date'],
      ...discrepancies.map(d => [
        d.id,
        d.type,
        d.paymentAmount || d.rentalAmount || 0,
        d.userId,
        d.createdAt,
      ]),
    ];

    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    runReconciliation();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reconciliation Tools</h2>
          <p className="text-muted-foreground">Match payments with rentals and identify discrepancies</p>
        </div>
        <Button
          onClick={runReconciliation}
          disabled={isReconciling}
          className="flex items-center gap-2"
        >
          {isReconciling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reconciling...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Reconciliation
            </>
          )}
        </Button>
      </div>

      {/* Status Alert */}
      {status.reconciliationRate >= 95 ? (
        <Alert className="border-green-600 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Reconciliation Status: Good</AlertTitle>
          <AlertDescription className="text-green-800">
            {status.reconciliationRate.toFixed(1)}% of payments matched with rentals. No critical issues detected.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-amber-600 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">Reconciliation Status: Review Needed</AlertTitle>
          <AlertDescription className="text-amber-800">
            {status.discrepancies.count} discrepancies found totaling ₦{status.discrepancies.amount.toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.totalPayments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.totalRentals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{status.matchedRecords}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Discrepancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{status.discrepancies.count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reconciliation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${status.reconciliationRate >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
              {status.reconciliationRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies Table */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Identified Discrepancies ({status.discrepancies.count})
          </CardTitle>
          <Button
            onClick={exportReconciliationReport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </CardHeader>
        <CardContent>
          {discrepancies.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <p className="text-muted-foreground">No discrepancies found. Perfect reconciliation!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.slice(0, 20).map(discrepancy => (
                    <TableRow key={discrepancy.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {discrepancy.type === 'payment_without_rental'
                            ? 'Payment Only'
                            : discrepancy.type === 'rental_without_payment'
                            ? 'Rental Only'
                            : 'Amount Mismatch'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        ₦{((discrepancy.paymentAmount || discrepancy.rentalAmount) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs">{discrepancy.userId?.substring(0, 8)}...</TableCell>
                      <TableCell className="text-sm">
                        {new Date(discrepancy.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => resolveDiscrepancy(discrepancy)}
                          variant="outline"
                          size="sm"
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {discrepancies.length > 20 && (
                <p className="text-sm text-muted-foreground mt-4">
                  Showing 20 of {discrepancies.length} discrepancies
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};