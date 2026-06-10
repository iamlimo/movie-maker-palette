import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Loader2, Wallet, Trash2 } from 'lucide-react';
import { formatNaira } from '@/lib/priceUtils';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    name: string;
    email: string;
    wallet_balance: number;
  } | null;
  onUserDeleted: () => void;
}

export const DeleteUserDialog = ({ open, onOpenChange, user, onUserDeleted }: DeleteUserDialogProps) => {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  const handleDelete = async () => {
    if (!user || confirmEmail !== user.email || !acknowledged) {
      toast({
        variant: "destructive",
        title: "Confirmation Required",
        description: "Please confirm all requirements before deleting"
      });
      return;
    }

    if (!session?.access_token) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Your session has expired. Please sign in again."
      });
      return;
    }

    try {
      setIsDeleting(true);

      const supabaseUrl = (supabase as { supabaseUrl?: string }).supabaseUrl;
      if (!supabaseUrl) {
        throw new Error('Supabase URL is not available in the client');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'delete',
          user_id: user.user_id
        })
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // ignore json parse errors
      }

      if (!response.ok) {
        const errMsg =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error?: unknown }).error ?? `Edge function failed with status ${response.status}`)
            : `Edge function failed with status ${response.status}`;
        throw new Error(errMsg);
      }

      const data = payload as { success?: boolean; error?: unknown } | null;

      if (data?.success) {
        toast({
          title: "User Deleted",
          description: `${user.name} has been permanently removed from the system`
        });
        onUserDeleted();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(data?.error || 'Failed to delete user');
      }
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      const message = error instanceof Error ? error.message : "Failed to delete user";
      toast({
        variant: "destructive",
        title: "Error",
        description: message
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setConfirmEmail('');
    setAcknowledged(false);
  };

  if (!user) return null;

  const isValid = confirmEmail === user.email && acknowledged && !isDeleting;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete User Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-destructive">⚠️ This action is permanent and cannot be undone!</p>
              <p className="text-sm">The following will be deleted:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• User account and profile</li>
                <li>• All wallet data and transaction history</li>
                <li>• Active rentals and favorites</li>
                <li>• Watch history and preferences</li>
              </ul>
            </div>

            <div className="bg-card border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">User:</span>
                <span className="text-sm">{user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  Wallet Balance:
                </span>
                <span className="text-sm font-semibold text-destructive">
                  {formatNaira(user.wallet_balance)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="confirm-email" className="text-sm font-medium">
                  Type the user's email to confirm:
                </Label>
                <Input
                  id="confirm-email"
                  placeholder={user.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={isDeleting}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
                  disabled={isDeleting}
                />
                <label
                  htmlFor="acknowledge"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this action is permanent and cannot be reversed
                </label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isValid}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
