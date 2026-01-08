import React, { useState } from 'react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface DeleteAccountDialogProps {
  walletBalance?: number;
  children?: React.ReactNode;
}

const DELETION_REASONS = [
  { value: 'not_using', label: 'I no longer use this service' },
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'found_alternative', label: 'Found a better alternative' },
  { value: 'privacy_concerns', label: 'Privacy concerns' },
  { value: 'technical_issues', label: 'Technical issues' },
  { value: 'other', label: 'Other' },
];

export function DeleteAccountDialog({ walletBalance = 0, children }: DeleteAccountDialogProps) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const triggerHaptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        // Haptics not available
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!password || !confirmed) {
      setError('Please enter your password and confirm deletion');
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await triggerHaptic();

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError('You must be logged in to delete your account');
        setIsDeleting(false);
        return;
      }

      const response = await fetch(
        `https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/delete-own-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            password,
            deletion_reason: deletionReason || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to delete account');
        setIsDeleting(false);
        return;
      }

      toast.success('Your account has been permanently deleted');
      setOpen(false);
      
      // Sign out and redirect
      await signOut();
      window.location.href = '/';
      
    } catch (err) {
      console.error('Delete account error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsDeleting(false);
    }
  };

  const resetState = () => {
    setPassword('');
    setConfirmed(false);
    setDeletionReason('');
    setError('');
    setIsDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="destructive" className="w-full">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Your Account
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p className="text-muted-foreground">
                This action is <strong>permanent</strong> and cannot be undone. The following data will be deleted:
              </p>
              
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Your profile and personal information</li>
                <li>All preferences and settings</li>
                <li>Watch history and progress</li>
                <li>Favorites and watchlist</li>
                <li>Rental history and purchases</li>
                <li>Payment records</li>
              </ul>

              {walletBalance > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm font-medium text-destructive">
                    ⚠️ Warning: You have ₦{walletBalance.toLocaleString()} in your wallet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This balance will be forfeited and cannot be recovered.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Enter your password to confirm</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDeleting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Why are you leaving? (Optional)</Label>
                  <Select value={deletionReason} onValueChange={setDeletionReason} disabled={isDeleting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELETION_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="confirm"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                    disabled={isDeleting}
                  />
                  <Label htmlFor="confirm" className="text-sm leading-tight cursor-pointer">
                    I understand this action is permanent and all my data will be deleted forever.
                  </Label>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isDeleting} className="mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={!password || !confirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete My Account
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
