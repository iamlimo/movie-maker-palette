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
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || registeredRef.current) return;
    if (!user) return;

    const setup = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') return;

        await PushNotifications.register();
        registeredRef.current = true;

        PushNotifications.addListener('registration', async (token) => {
          // Skip if same token already saved
          if (lastTokenRef.current === token.value) return;
          lastTokenRef.current = token.value;

          const platform = Capacitor.getPlatform() as 'ios' | 'android';
          const { error } = await supabase
            .from('push_device_tokens' as any)
            .upsert(
              { user_id: user.id, token: token.value, platform, is_active: true, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,token' }
            );
          if (error) console.error('Failed to save push token:', error);
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error:', err);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received in foreground:', notification);
        });

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

  // Deactivate token on sign-out
  useEffect(() => {
    if (user || !Capacitor.isNativePlatform()) return;
    if (!lastTokenRef.current) return;

    const token = lastTokenRef.current;
    supabase
      .from('push_device_tokens' as any)
      .update({ is_active: false } as any)
      .eq('token', token)
      .then(({ error }) => {
        if (error) console.error('Failed to deactivate push token:', error);
      });

    lastTokenRef.current = null;
    registeredRef.current = false;
  }, [user]);
}
