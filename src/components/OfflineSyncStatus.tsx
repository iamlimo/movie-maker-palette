import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { backgroundSync } from '@/lib/backgroundSync';
import { cn } from '@/lib/utils';

export const OfflineSyncStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      backgroundSync.processQueue().finally(() => {
        setIsSyncing(false);
        updatePendingCount();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const updatePendingCount = () => {
      setPendingCount(backgroundSync.getPendingCount());
    };

    // Initial check
    updatePendingCount();

    // Set up listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending count every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
      <Badge 
        variant={isOnline ? "default" : "destructive"}
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          isSyncing && "animate-pulse"
        )}
      >
        {isSyncing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : isOnline ? (
          <>
            <Cloud className="h-4 w-4" />
            Online
            {pendingCount > 0 && ` • ${pendingCount} pending`}
          </>
        ) : (
          <>
            <CloudOff className="h-4 w-4" />
            Offline
            {pendingCount > 0 && ` • ${pendingCount} queued`}
          </>
        )}
      </Badge>
    </div>
  );
};
