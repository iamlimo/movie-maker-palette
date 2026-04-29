import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword, supabase } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [validSession, setValidSession] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ✅ Initialize recovery session properly
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          setValidSession(false);
          setError('Invalid or expired reset link.');
        } else {
          setValidSession(true);
        }
      } catch (err) {
        setValidSession(false);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Also listen for recovery event
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          setValidSession(true);
          setError(null);
          setLoading(false);
        }
      }
    );

    init();

    return () => {
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
      const { error } = await updatePassword(newPassword);

      if (error) {
        if (
          error.message.includes('session') ||
          error.message.includes('token')
        ) {
          setError('Session expired. Request a new reset link.');
        } else {
          setError(error.message);
        }
      } else {
        setSuccess(true);

        toast({
          title: 'Password updated',
          description: 'You can now log in with your new password.',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  // ⏳ Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verifying reset link...</p>
      </div>
    );
  }

  // ❌ Invalid link
  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This link has expired or is invalid.
              </AlertDescription>
            </Alert>

            <Button
              className="w-full mt-4"
              onClick={() => navigate('/auth')}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Success state
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

            <Button
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ Main form
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
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>

              {/* Strength */}
              {newPassword && (
                <div className="mt-2">
                  <div className="text-xs">
                    Strength: {getStrengthText()}
                  </div>
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
                <p className="text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                !newPassword ||
                newPassword !== confirmPassword
              }
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;