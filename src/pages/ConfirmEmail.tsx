import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, MailWarning } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

type Phase = 'verifying' | 'confirmed' | 'error';

const REDIRECT_DELAY_MS = 2500;

/**
 * Email confirmation status page.
 *
 * Supabase confirmation links land here (either with a `token_hash` query for
 * the PKCE/verify-otp flow, or with tokens already exchanged in the URL hash).
 * Once confirmed, we clear the temporary session and route the user to the
 * log-in page so they explicitly sign in with the credentials they just made.
 */
const ConfirmEmail = () => {
  const navigate = useNavigate();
  const { isNative } = usePlatform();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  const params = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash,
    );
    const get = (key: string) => search.get(key) ?? hash.get(key);
    return {
      tokenHash: get('token_hash') ?? get('confirmation_token'),
      type: get('type'),
      errorDescription: get('error_description') ?? get('error'),
    };
  }, []);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      if (params.errorDescription) {
        setPhase('error');
        setMessage(
          decodeURIComponent(params.errorDescription).replace(/\+/g, ' '),
        );
        return;
      }

      try {
        if (params.tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.tokenHash,
            type: (params.type as 'signup' | 'email_change') || 'signup',
          });
          if (error) throw error;
        } else {
          // Tokens may already have been exchanged into a session by the
          // Supabase client when it parsed the URL hash.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setPhase('error');
            setMessage(
              'This confirmation link is invalid or has already been used.',
            );
            return;
          }
        }

        // Confirmed. Drop the temporary session so the user logs in explicitly.
        await supabase.auth.signOut();
        setPhase('confirmed');
      } catch (err) {
        console.error('Email confirmation failed:', err);
        setPhase('error');
        setMessage(
          (err as { message?: string })?.message ??
            'We could not confirm your email. The link may have expired.',
        );
      }
    };

    void run();
  }, [params]);

  // Auto-route to log in once confirmed.
  useEffect(() => {
    if (phase !== 'confirmed') return;
    const timer = window.setTimeout(() => {
      navigate('/auth?confirmed=1', { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, navigate]);

  return (
    <div
      className="min-h-screen gradient-hero flex items-center justify-center p-4"
      style={
        isNative
          ? {
              paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            }
          : undefined
      }
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/signature-tv-logo.png"
            alt="Signature TV"
            className="mx-auto h-10 w-auto"
          />
        </div>

        <Card className="gradient-card border-border/50 shadow-premium">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              {phase === 'verifying' && (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              )}
              {phase === 'confirmed' && (
                <CheckCircle2 className="h-8 w-8 text-primary animate-in zoom-in duration-300" />
              )}
              {phase === 'error' && (
                <MailWarning className="h-8 w-8 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {phase === 'verifying' && 'Confirming your email'}
              {phase === 'confirmed' && 'Email confirmed'}
              {phase === 'error' && 'Confirmation failed'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {phase === 'verifying' &&
                'Hang tight while we verify your confirmation link.'}
              {phase === 'confirmed' &&
                'Your account is ready. Taking you to log in…'}
              {phase === 'error' &&
                (message ?? 'Please request a new confirmation email.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {phase === 'confirmed' && (
              <Button
                className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow"
                onClick={() => navigate('/auth?confirmed=1', { replace: true })}
              >
                Log In now
              </Button>
            )}
            {phase === 'error' && (
              <>
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Confirmation links expire after a short while and can only
                    be used once.
                  </span>
                </div>
                <Button
                  className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow"
                  onClick={() => navigate('/auth?mode=signup', { replace: true })}
                >
                  Try signing up again
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => navigate('/auth', { replace: true })}
                >
                  Go to Log In
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmEmail;