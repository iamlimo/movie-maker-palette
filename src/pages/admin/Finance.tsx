import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  RefreshCw,
  BarChart3,
  FileText,
  CreditCard,
  AlertTriangle 
} from 'lucide-react';
import { FinanceOverview } from '@/components/admin/finance/FinanceOverview';
import { TransactionsTable } from '@/components/admin/finance/TransactionsTable';
import { PayoutsManagement } from '@/components/admin/finance/PayoutsManagement';
import { ReconciliationTools } from '@/components/admin/finance/ReconciliationTools';
import { AuditTrail } from '@/components/admin/finance/AuditTrail';
import { useRole } from '@/hooks/useRole';
import { Navigate } from 'react-router-dom';

const Finance = () => {
  const { isSuperAdmin } = useRole();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isSuperAdmin()) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance Management</h1>
          <p className="text-muted-foreground">
            Comprehensive financial overview and management tools
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Super Admin Only
        </Badge>
      </div>

      {/* Finance Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconciliation
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinanceOverview />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTable />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutsManagement />
        </TabsContent>

        <TabsContent value="reconciliation">
          <ReconciliationTools />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrail />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Finance;