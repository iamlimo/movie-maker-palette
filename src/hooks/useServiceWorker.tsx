import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export const useServiceWorker = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const hasShownUpdateToast = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, swRegistration) {
      setRegistration(swRegistration ?? null);
    },
    onRegisterError(error) {
      console.error('Service worker registration error:', error);
    },
  });

  useEffect(() => {
    if (!registration) return;

    const intervalId = window.setInterval(() => {
      registration.update().catch((error) => {
        console.error('Service worker update check failed:', error);
      });
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [registration]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (offlineReady) {
      toast({
        title: 'App ready for offline use',
        description: 'Key assets are now cached for offline access.',
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) {
      hasShownUpdateToast.current = false;
      return;
    }

    if (hasShownUpdateToast.current) return;
    hasShownUpdateToast.current = true;

    toast({
      title: 'Update available',
      description: 'A newer version is ready. Refresh now to load the latest UI and assets.',
      action: (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            hasShownUpdateToast.current = false;
            setNeedRefresh(false);
            updateServiceWorker(true);
          }}
        >
          Refresh
        </Button>
      ),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return {
    isOnline,
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
  };
};
