import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/card';

const NativePlayerSetup = () => {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [pluginAvailable, setPluginAvailable] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    const checkSetup = async () => {
      // Check if on native platform
      if (!Capacitor.isNativePlatform()) {
        setPlatform('web');
        return;
      }

      const currentPlatform = Capacitor.getPlatform();
      setPlatform(currentPlatform);

      // Check network status
      try {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        // Listen to network changes
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
          if (!status.connected) {
            toast({
              title: 'No Connection',
              description: 'You are offline. Playback may be interrupted.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Connected',
              description: 'Connection restored.',
            });
          }
        });
      } catch (err) {
        console.warn('Network plugin not available');
      }

      // Check if Video Player plugin is available
      try {
        const module = await import('@capacitor-community/video-player');
        if (module.VideoPlayer) {
          setPluginAvailable(true);
        }
      } catch {
        console.warn('Video Player plugin not available');
        setPluginAvailable(false);
      }
    };

    checkSetup();
  }, [toast]);

  // This is a utility function - not meant to render UI
  // Usage: Check plugin availability in parent components
  return {
    isOnline,
    pluginAvailable,
    platform,
    isNative: Capacitor.isNativePlatform(),
  };
};

export default NativePlayerSetup;
