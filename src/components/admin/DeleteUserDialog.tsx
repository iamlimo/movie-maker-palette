import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Wallet, Trash2 } from 'lucide-react';

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

  const handleDelete = async () => {
    if (!user || confirmEmail !== user.email || !acknowledged) {
      toast({
        variant: "destructive",
        title: "Confirmation Required",
        description: "Please confirm all requirements before deleting"
      });
      return;
    }

    try {
      setIsDeleting(true);

      const { data, error } = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'delete',
          user_id: user.user_id
        }
      });

      if (error) throw error;

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
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user"
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
                  ₦{user.wallet_balance.toFixed(2)}
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
