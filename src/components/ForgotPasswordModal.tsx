import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal = ({ isOpen, onClose }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        // Don't expose whether email exists (security best practice)
        // but handle specific errors
        if (error.message?.includes('rate')) {
          toast({
            title: 'Too Many Attempts',
            description: 'Please wait a few minutes before trying again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to send reset email. Please try again.',
            variant: 'destructive',
          });
        }
      } else {
        // Show success state
        setSubmitted(true);
        
        // Auto-close after 4 seconds
        const timer = setTimeout(() => {
          handleClose();
        }, 4000);

        return () => clearTimeout(timer);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] gradient-card border-border/50">
        {!submitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Reset Password
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We'll send you an email with a link to reset your password.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-background/50 border-border focus:border-primary"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={handleClose}
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gradient-accent text-primary-foreground font-semibold"
                  disabled={loading || !email}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-6 py-8 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/20 p-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold text-foreground">
                Check Your Email
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We've sent a password reset link to <br />
                <span className="font-semibold text-foreground">{email}</span>
              </DialogDescription>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-muted-foreground">
              The reset link will expire in 24 hours. If you don't see the email, check your spam folder.
            </div>

            <Button
              onClick={handleClose}
              className="w-full gradient-accent text-primary-foreground font-semibold"
            >
              Back to Login
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
