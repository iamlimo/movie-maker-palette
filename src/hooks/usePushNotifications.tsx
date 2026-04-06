import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || registeredRef.current) return;
    if (!user) return;

    const setup = async () => {
      try {
        // Check / request permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') return;

        // Register with native push service
        await PushNotifications.register();
        registeredRef.current = true;

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
          const platform = Capacitor.getPlatform() as 'ios' | 'android';
          // Upsert token
          const { error } = await supabase
            .from('push_device_tokens' as any)
            .upsert(
              { user_id: user.id, token: token.value, platform, is_active: true, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,token' }
            );
          if (error) console.error('Failed to save push token:', error);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error:', err);
        });

        // Foreground notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received in foreground:', notification);
        });

        // Notification tap
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data;
          if (data?.deepLink) {
            navigate(data.deepLink);
          }
        });
      } catch (err) {
        console.error('Push notification setup error:', err);
      }
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, navigate]);

  // Deactivate tokens on sign out
  useEffect(() => {
    if (user || !Capacitor.isNativePlatform()) return;
    // User signed out — deactivate all tokens for this device
    // We can't know the exact token, but the hook won't register again until user logs in
  }, [user]);
}
