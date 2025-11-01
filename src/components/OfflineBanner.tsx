import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Alert className="fixed top-16 left-4 right-4 z-50 bg-destructive text-destructive-foreground border-destructive mobile-safe-padding">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        No internet connection. Some features may be limited.
      </AlertDescription>
    </Alert>
  );
};
