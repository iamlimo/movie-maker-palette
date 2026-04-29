import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, __resetPasswordUtils } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';

import { validatePasswordStrength } from '@/lib/security';

type Phase =
  | 'verifying'
  | 'form'
  | 'expired'
  | 'sending'
  | 'success'
  | 'resend_error';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword, resetPassword } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('verifying');
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const autoResentRef = useRef(false);

  const rp = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('rp');
    } catch {
      return null;
    }
  }, []);

  const inferredEmail = useMemo(() => {
    if (!rp) return null;
    return __resetPasswordUtils.getLocalResetNonceEmail(rp);
  }, [rp]);

  const [resendEmail, setResendEmail] = useState<string>(inferredEmail ?? '');

  useEffect(() => {
    // Keep resendEmail in sync if inferredEmail arrives later.
    setResendEmail(inferredEmail ?? '');
  }, [inferredEmail]);

  // ✅ Initialize recovery session properly + detect expired links
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (sessionError || !data.session) {
          setPhase('expired');
          setSuccess(false);
        } else {
          setPhase('form');
          setSuccess(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setPhase('expired');
        setError('Something went wrong. Please try again.');
        setSuccess(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Listen for recovery event too (helps if the token redemption happens after mount)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          setPhase('form');
          setError(null);
          setLoading(false);
        }
      },
    );

    init();

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  // ✅ Password strength
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength(0);
      return;
    }

    const { score } = validatePasswordStrength(newPassword);
    setPasswordStrength(score);
  }, [newPassword]);

  const getStrengthColor = () => {
    if (passwordStrength < 25) return 'bg-red-500';
    if (passwordStrength < 50) return 'bg-orange-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
  };

  const triggerResend = async (emailToUse: string) => {
    const emailTrimmed = emailToUse.trim().toLowerCase();
    if (!emailTrimmed) {
      setPhase('resend_error');
      setError('Please enter your email address.');
      return;
    }

    setPhase('sending');
    setLoading(true);
    setError(null);

    try {
      const { error: sendError } = await resetPassword(emailTrimmed);

      if (sendError) {
        setPhase('resend_error');
        setError(
          sendError?.message ||
            'Could not send reset email right now. Please try again.',
        );
        return;
      }

      setSuccess(true);
      setPhase('success');

      toast({
        title: 'Reset link sent',
        description: 'Check your email for the new password reset link.',
      });
    } catch (err: any) {
      setPhase('resend_error');
      setError(err?.message || 'Unexpected error while sending reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Instant re-request on expired links (auto once, never dead-end)
  useEffect(() => {
    if (phase !== 'expired') return;
    if (!rp) return;
    if (autoResentRef.current) return;

    if (inferredEmail) {
      autoResentRef.current = true;
      void triggerResend(inferredEmail);
    }
  }, [phase, rp, inferredEmail]);

  // ✅ Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    const { isValid, feedback } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return setError(feedback.join(' '));
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(newPassword);

      if (updateError) {
        const msg = updateError.message || '';
        if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('token')) {
          setPhase('expired');
          setSuccess(false);
          setError('Your reset session has expired. We can send you a new link.');
          return;
        }

        setError(msg || 'Unable to update password.');
      } else {
        setSuccess(true);

        toast({
          title: 'Password updated',
          description: 'You can now log in with your new password.',
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  // ⏳ Loading state
  if (loading && phase === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifying reset link...</p>
      </div>
    );
  }

  // ❌ Expired link / no usable session
  if (phase === 'expired' || phase === 'resend_error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Reset link expired</CardTitle>
            <CardDescription>
              {phase === 'resend_error'
                ? 'We couldn’t complete that reset session.'
                : 'This link has expired or is invalid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert variant="destructive" className="border-border">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                For your security, password reset links can only be used once.
                We can send you a new one instantly.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="resend-email">Email address</Label>
              <Input
                id="resend-email"
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                disabled={Boolean(inferredEmail)} // if we inferred it from rp, lock it
                className={inferredEmail ? 'bg-muted/50' : undefined}
              />
              {inferredEmail && (
                <p className="text-xs text-muted-foreground">
                  Using email from this device.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button
                className="w-full gradient-accent text-primary-foreground font-semibold"
                onClick={() => triggerResend(resendEmail)}
                disabled={!resendEmail || loading}
              >
                {loading && phase === 'resend_error' ? 'Sending...' : 'Send new reset link'}
              </Button>

              <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'sending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sending a new link...</CardTitle>
            <CardDescription>One moment—this should be instant.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">
                We’re re-requesting the password reset email.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Success state after resend
  if (phase === 'success' && success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>

            <p className="text-center text-muted-foreground">
              We sent a new password reset link{resendEmail ? ` to ${resendEmail}` : ''}.
              <br />
              Open the latest email to set your new password.
            </p>

            <Button className="w-full" onClick={() => navigate('/auth')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Success state after password update
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Password Reset Successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>

            <p className="text-center">
              Your password has been updated successfully.
            </p>

            <Button className="w-full" onClick={() => navigate('/auth')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Main form (valid session)
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Create New Password</CardTitle>
          <CardDescription>
            Enter a strong new password for your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Password */}
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>

              {/* Strength */}
              {newPassword && (
                <div className="mt-2">
                  <div className="text-xs">Strength: {getStrengthText()}</div>
                  <div className="h-2 bg-gray-200 rounded">
                    <div
                      className={`h-2 ${getStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !newPassword || newPassword !== confirmPassword}
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-muted-foreground underline"
                onClick={() => {
                  setPhase('expired');
                  setError(null);
                }}
              >
                I need a new link
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
