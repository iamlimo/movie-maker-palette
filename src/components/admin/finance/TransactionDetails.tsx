import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  Check,
  DollarSign,
  User,
  Calendar,
  CreditCard,
  LinkIcon,
  Loader2
} from 'lucide-react';
import { formatNaira } from '@/lib/priceUtils';
import { supabase } from '@/integrations/supabase/client';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  purpose: string;
  enhanced_status: string;
  provider: string;
  provider_reference: string;
  created_at: string;
  metadata: any;
  user_name?: string;
  user_email?: string;
}

interface TransactionDetailsProps {
  paymentId?: string;
  payment?: Payment;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionDetails = ({ 
  paymentId, 
  payment: initialPayment, 
  isOpen, 
  onClose 
}: TransactionDetailsProps) => {
  const [payment, setPayment] = useState<Payment | null>(initialPayment || null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && paymentId && !initialPayment) {
      fetchPaymentDetails();
    } else if (initialPayment) {
      setPayment(initialPayment);
    }
  }, [isOpen, paymentId, initialPayment]);

  const fetchPaymentDetails = async () => {
    if (!paymentId) return;
    setIsLoading(true);
    try {
      const { data: paymentData, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) {
        console.error('Error fetching payment details:', error);
        return;
      }

      // Fetch user info
      if (paymentData?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('user_id', paymentData.user_id)
          .single();

        setPayment({
          ...paymentData,
          user_name: profile?.name || 'Unknown',
          user_email: profile?.email || 'Unknown',
        });
      } else {
        setPayment(paymentData);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            Complete information about this transaction
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading details...</p>
            </div>
          </div>
        ) : payment ? (
          <div className="space-y-6">
            {/* Payment Status Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={`capitalize ${getStatusColor(payment.enhanced_status)}`}>
                      {payment.enhanced_status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-2xl font-bold">{formatNaira(payment.amount)}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Currency</p>
                    <p className="font-medium">{payment.currency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Purpose</p>
                    <Badge variant="outline" className="capitalize">
                      {payment.purpose.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Information Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{payment.user_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{payment.user_email || 'Unknown'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">User ID</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="text-xs font-mono flex-1 truncate">{payment.user_id}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(payment.user_id, 'user_id')}
                    >
                      {copiedField === 'user_id' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Provider Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Payment Provider
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium capitalize">{payment.provider}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment ID</p>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <code className="text-xs font-mono flex-1 truncate">{payment.id}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(payment.id, 'id')}
                      >
                        {copiedField === 'id' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Provider Reference</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <code className="text-xs font-mono flex-1 truncate">
                      {payment.provider_reference || 'N/A'}
                    </code>
                    {payment.provider_reference && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(payment.provider_reference, 'provider_reference')}
                      >
                        {copiedField === 'provider_reference' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timestamp Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Created At</p>
                  <div className="p-2 bg-muted rounded">
                    <p className="font-medium">{new Date(payment.created_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(payment.created_at).toISOString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata Section */}
            {payment.metadata && Object.keys(payment.metadata).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(payment.metadata, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Actions Section */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payment.enhanced_status === 'success' && (
                  <Button variant="destructive" className="w-full">
                    Process Refund
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">No transaction data available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
