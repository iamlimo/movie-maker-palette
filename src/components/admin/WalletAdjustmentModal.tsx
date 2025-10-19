import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import NairaInput from '@/components/admin/NairaInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WalletAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentBalance: number;
  onSuccess: () => void;
}

export default function WalletAdjustmentModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentBalance,
  onSuccess
}: WalletAdjustmentModalProps) {
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Amount must be greater than zero',
        variant: 'destructive'
      });
      return;
    }

    if (reason.length < 10) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a detailed reason (minimum 10 characters)',
        variant: 'destructive'
      });
      return;
    }

    if (type === 'debit' && amount > currentBalance) {
      toast({
        title: 'Insufficient Balance',
        description: 'Cannot debit more than the current balance',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-wallet-adjustment', {
        body: {
          targetUserId: userId,
          amount,
          type,
          reason
        }
      });

      if (error) throw error;

      if (data.success) {
        console.log('Wallet updated successfully. New balance:', data.new_balance);
        toast({
          title: 'Adjustment Successful',
          description: `Wallet ${type === 'credit' ? 'credited' : 'debited'} with ₦${(amount / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}. New balance: ₦${(data.new_balance / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
        });
        onSuccess();
      }
    } catch (error: any) {
      console.error('Wallet adjustment error:', error);
      toast({
        title: 'Adjustment Failed',
        description: error.message || 'Failed to adjust wallet',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const newBalance = type === 'credit' 
    ? currentBalance + amount 
    : currentBalance - amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Adjust Wallet Balance</DialogTitle>
          <DialogDescription>
            Manually adjust wallet balance for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Balance */}
          <div className="p-4 rounded-lg border border-border bg-muted/20">
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className="text-2xl font-bold">
              ₦{currentBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Transaction Type</label>
            <Select value={type} onValueChange={(value: 'credit' | 'debit') => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit (Add Funds)</SelectItem>
                <SelectItem value="debit">Debit (Remove Funds)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <NairaInput
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            required
          />

          {/* Reason */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a detailed reason for this adjustment..."
              className="min-h-[100px]"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 10 characters ({reason.length}/10)
            </p>
          </div>

          {/* New Balance Preview */}
          {amount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                New balance will be: <strong className={newBalance < 0 ? 'text-destructive' : ''}>
                  ₦{newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || amount <= 0 || reason.length < 10}
            className="gradient-accent text-primary-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `${type === 'credit' ? 'Credit' : 'Debit'} Wallet`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
