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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Check if user has valid session (came from reset email)
  useEffect(() => {
    if (!session) {
      // User not authenticated from reset link
      setError('Invalid or expired reset link. Please try again.');
      const timer = setTimeout(() => {
        navigate('/auth');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [session, navigate]);

  // Calculate password strength
  useEffect(() => {
    if (newPassword.length === 0) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (newPassword.length >= 8) strength += 25;
    if (newPassword.length >= 12) strength += 25;
    if (/[A-Z]/.test(newPassword)) strength += 25;
    if (/[0-9]/.test(newPassword)) strength += 25;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength += 25;

    setPasswordStrength(Math.min(strength, 100));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    if (passwordStrength < 50) {
      setError('Please create a stronger password.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(newPassword);

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
      } else {
        setSuccess(true);
        toast({
          title: 'Success!',
          description: 'Your password has been reset. Redirecting to login...',
        });

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="gradient-card border-border/50 shadow-premium max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Invalid Reset Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This reset link has expired or is invalid. Please request a new one.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/auth')}
              className="w-full mt-6 gradient-accent text-primary-foreground font-semibold"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="gradient-card border-border/50 shadow-premium">
          {success ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-foreground">
                  Password Reset Successful
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-500/20 p-4">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                <p className="text-center text-muted-foreground">
                  Your password has been reset successfully. You'll be redirected to the login page shortly.
                </p>
                <Button
                  onClick={() => navigate('/auth')}
                  className="w-full gradient-accent text-primary-foreground font-semibold"
                >
                  Go to Login
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Create New Password
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Choose a strong password to secure your Signature TV account.
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

                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                        required
                        disabled={loading}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-smooth"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Strength:</span>
                          <span className={`font-semibold ${
                            passwordStrength < 25 ? 'text-red-500' :
                            passwordStrength < 50 ? 'text-orange-500' :
                            passwordStrength < 75 ? 'text-yellow-500' :
                            'text-green-500'
                          }`}>
                            {getStrengthText()}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getStrengthColor()} transition-all duration-300`}
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <ul className="text-xs text-muted-foreground space-y-1 mt-3">
                      <li className={newPassword.length >= 8 ? 'text-green-500' : ''}>
                        {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                      </li>
                      <li className={/[A-Z]/.test(newPassword) ? 'text-green-500' : ''}>
                        {/[A-Z]/.test(newPassword) ? '✓' : '○'} One uppercase letter
                      </li>
                      <li className={/[0-9]/.test(newPassword) ? 'text-green-500' : ''}>
                        {/[0-9]/.test(newPassword) ? '✓' : '○'} One number
                      </li>
                      <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-500' : ''}>
                        {/[^A-Za-z0-9]/.test(newPassword) ? '✓' : '○'} One special character
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-foreground">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                        required
                        disabled={loading}
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <p className="text-xs text-green-500">Passwords match ✓</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-bounce"
                    disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  >
                    {loading ? 'Resetting Password...' : 'Reset Password'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
