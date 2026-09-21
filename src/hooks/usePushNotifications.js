import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = typeof __VAPID_PUBLIC_KEY__ !== 'undefined'
  ? __VAPID_PUBLIC_KEY__
  : 'BATxs7rXeFG9CkF9CSIfq7OQGTYGY51s5c3bRBUI85a7iQtEHlS5ZRbhJxdg0WgcnOks9FnxQqHxZ_M84ZD7YHw';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * usePushNotifications
 * Manages the full Web Push lifecycle:
 *   1. Check browser support
 *   2. Request Notification permission
 *   3. Subscribe to push via service worker
 *   4. Save subscription to server (/api/push/subscribe)
 *   5. Return { isSupported, permission, isSubscribed, subscribe, unsubscribe }
 */
export function usePushNotifications(user) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState(Notification?.permission ?? 'default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      // Check existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setIsSubscribed(true);
            setSubscription(sub);
          }
        });
      }).catch(() => {});
    }
  }, []);

  // Listen for service worker messages (notification click → navigate)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        // Emit a custom event that FarmerApp listens to for navigation
        window.dispatchEvent(new CustomEvent('kisan_nav', {
          detail: { screen: event.data.screen, targetUrl: event.data.targetUrl }
        }));
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  const saveSubscriptionToServer = useCallback(async (sub, userId) => {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          farmer_id: userId || user?.id,
          farmer_name: user?.name,
          phone: user?.phone,
        }),
      });
    } catch (err) {
      console.warn('Could not save push subscription to server:', err);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!isSupported || loading) return false;
    setLoading(true);
    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      // 2. Get SW registration
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // 4. Save to server
      await saveSubscriptionToServer(sub, user?.id);

      return true;
    } catch (err) {
      console.warn('Push subscription failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, loading, saveSubscriptionToServer, user]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await subscription.unsubscribe();
      setIsSubscribed(false);
      setSubscription(null);
      // Notify server to remove
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmer_id: user?.id }),
      });
    } catch (err) {
      console.warn('Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [subscription, user]);

  return { isSupported, permission, isSubscribed, subscription, loading, subscribe, unsubscribe };
}
