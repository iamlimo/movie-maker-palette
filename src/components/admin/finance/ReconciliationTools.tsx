import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export const ReconciliationTools = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Reconciliation tools coming soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};