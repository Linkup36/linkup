import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { toast } from '../components/ui/GooeyToast';
import { playLinkUpNotificationSound } from './soundService';

// Configure foreground notification behavior on native devices
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export const AndroidImportance = Notifications.AndroidImportance;

export enum AndroidNotificationPriority {
  MAX = 'max',
  HIGH = 'high',
  DEFAULT = 'default',
  LOW = 'low',
  MIN = 'min',
}

export const setNotificationHandler = Notifications.setNotificationHandler;
export const setNotificationChannelAsync = Notifications.setNotificationChannelAsync;
export const getPermissionsAsync = Notifications.getPermissionsAsync;
export const requestPermissionsAsync = Notifications.requestPermissionsAsync;
export const getExpoPushTokenAsync = Notifications.getExpoPushTokenAsync;

export async function scheduleNotificationAsync(request: {
  content: {
    title: string;
    body: string;
    data?: any;
    priority?: string;
    sound?: boolean | string;
    vibrate?: number[];
    color?: string;
  };
  trigger?: any;
}): Promise<string> {
  const { title, body, data } = request.content;
  if (Platform.OS !== 'web') {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'linkup_notification.mp3',
          color: '#EB7D30',
          ...request.content,
        },
        trigger: request.trigger ?? null,
      });
    } catch (err) {
      console.warn('[Notifications] scheduleNotificationAsync error:', err);
    }
  }
  toast.info(title, { description: body });
  return 'notif-' + Date.now();
}

let activeNotificationChannel: any = null;

/**
 * Initializes a global real-time listener on the `notifications` table
 * for the authenticated user. Triggers the signature LinkUp sound ONLY
 * when a new record is inserted into the `notifications` table.
 */
export function setupGlobalNotificationsSubscription(
  userId: string,
  onNotification?: (notif: any) => void
): () => void {
  if (!userId) return () => {};

  if (activeNotificationChannel) {
    try {
      supabase.removeChannel(activeNotificationChannel);
    } catch {}
    activeNotificationChannel = null;
  }

  const channelName = `global-user-notifications-${userId}`;
  activeNotificationChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const notif = payload.new;
        if (notif) {
          // Play the professional LinkUp notification sound exclusively on database insertion
          playLinkUpNotificationSound().catch(() => {});

          toast.info(notif.title || 'New Notification', {
            description: notif.message,
          });

          // Trigger native Android heads-up notification banner
          if (Platform.OS !== 'web') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: notif.title || '🔔 LinkUp Alert',
                body: notif.message || '',
                sound: 'linkup_notification.mp3',
                channelId: 'linkup_notifications',
                color: '#EB7D30',
                vibrate: [0, 250, 250, 250],
                data: notif.data || {},
              },
              trigger: null,
            }).catch((err) => {
              console.warn('[Notifications] Failed to trigger heads-up banner:', err);
            });
          }

          if (onNotification) {
            onNotification(notif);
          }
        }
      }
    )
    .subscribe();

  return () => {
    if (activeNotificationChannel) {
      try {
        supabase.removeChannel(activeNotificationChannel);
      } catch {}
      activeNotificationChannel = null;
    }
  };
}

/**
 * Configures Android notification channel with custom LinkUp sound
 */
export async function setupNotificationChannelsAsync(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('linkup_notifications', {
        name: 'LinkUp Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EB7D30',
        sound: 'linkup_notification.mp3',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    } catch (err) {
      console.warn('[Notifications] Failed to setup notification channel:', err);
    }
  }
}

/**
 * Registers device for remote push notifications and persists real token to Supabase profile
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    await setupNotificationChannelsAsync();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Push notification permission not granted.');
      return 'Permission denied: Please enable notification permission in Android Settings';
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      'f6307ce8-c125-449e-80d6-894c5a8bddf9';

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData?.data;

      if (userId && token) {
        await supabase
          .from('profiles')
          .update({ push_token: token, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }
      return token || null;
    } catch (tokenErr: any) {
      console.warn('[Notifications] getExpoPushTokenAsync error:', tokenErr);

      // Fallback: Check if user profile already has a push_token saved in DB
      if (userId) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', userId)
            .single();
          if (data?.push_token) {
            return data.push_token;
          }
        } catch {}
      }
      return `Push Token Error: ${tokenErr?.message || 'FCM credential setup required in EAS'}`;
    }
  } catch (err: any) {
    console.warn('[Notifications] Error registering for push notifications:', err);
    return `Error: ${err?.message || 'Failed to initialize notifications'}`;
  }
}

export async function triggerLocalTestNotificationAsync(
  arg1?: string | { userId?: string; title?: string; body?: string; delaySeconds?: number },
  arg2?: string
): Promise<void> {
  const title = typeof arg1 === 'string' ? arg1 : arg1?.title || '🔔 LinkUp Alert';
  const body = typeof arg1 === 'string' ? arg2 : arg1?.body || 'Test notification received.';
  const delaySeconds = typeof arg1 === 'object' ? (arg1.delaySeconds ?? 0) : 0;
  const userId = typeof arg1 === 'object' ? arg1.userId : undefined;

  await setupNotificationChannelsAsync();

  if (Platform.OS !== 'web') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'linkup_notification.mp3',
          channelId: 'linkup_notifications',
          color: '#EB7D30',
          vibrate: [0, 250, 250, 250],
          data: { test: true },
        },
        trigger:
          delaySeconds > 0
            ? ({
                type: 'timeInterval',
                seconds: delaySeconds,
                channelId: 'linkup_notifications',
                repeats: false,
              } as any)
            : null,
      });
    } catch (err) {
      console.warn('[Notifications] Native schedule notification error:', err);
    }
  }

  // If firing immediately in foreground, also play sound & show toast
  if (delaySeconds === 0) {
    playLinkUpNotificationSound().catch(() => {});
    toast.info(title, { description: body });
  }

  if (userId) {
    supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message: body,
        type: 'system',
        is_read: false,
      })
      .then(() => {});
  }
}

export async function getDevicePushTokenDirectAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return await registerForPushNotificationsAsync(userId);
}

export async function sendRemoteExpoPushNotificationAsync(
  token: string,
  titleOrPayload: string | { title?: string; body?: string; data?: any },
  body?: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const t = typeof titleOrPayload === 'string' ? titleOrPayload : titleOrPayload?.title;
  const b = typeof titleOrPayload === 'string' ? body : titleOrPayload?.body;
  const d = typeof titleOrPayload === 'string' ? data : titleOrPayload?.data;

  if (!token || !token.startsWith('ExponentPushToken[')) {
    return {
      success: false,
      error: `Invalid push token. A real ExponentPushToken[...] is required.`,
    };
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: t || '🔔 LinkUp Alert',
        body: b || 'Remote push received.',
        sound: 'linkup_notification.mp3',
        channelId: 'linkup_notifications',
        priority: 'high',
        data: d || {},
      }),
    });

    const json = await res.json();
    if (res.ok && json?.data?.status !== 'error') {
      return { success: true };
    } else {
      const errDetail = json?.data?.message || json?.errors?.[0]?.message || 'Expo push rejected';
      return { success: false, error: errDetail };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error sending to Expo' };
  }
}

/**
 * Trigger an in-app heads-up alert for couriers when an urgent mission is available
 */
export async function triggerRiderMissionAlertAsync(order: any): Promise<void> {
  const fee = order?.payout ?? order?.deliveryFee ?? 2500;
  const feeFormatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(fee);

  const address = order?.pickupAddress || order?.dropoffAddress || 'Nearby LinkUp Station';
  toast.info(`🚨 New Mission: ${feeFormatted}`, {
    description: `Pickup: ${address.slice(0, 32)}...`,
  });
}

/**
 * Trigger an instant earnings popup notification for couriers
 */
export async function triggerRiderEarningsAlertAsync(arg: number | any, orderId?: string): Promise<void> {
  const amount = typeof arg === 'number' ? arg : (arg?.amount ?? 0);
  const resolvedOrderId = typeof arg === 'object' ? arg?.orderId : orderId;

  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);

  toast.success(`💰 Payout Settled: ${formatted}`, {
    description: resolvedOrderId ? `Order #${resolvedOrderId.slice(0, 8)} finalized.` : 'Funds credited to Linkup wallet.',
  });
}

/**
 * Fire an immediate local heads-up notification for user order updates
 */
export async function sendLocalOrderUpdateNotification(
  title: string,
  body: string,
  orderId?: string,
  userId?: string
): Promise<void> {
  toast.info(title, { description: body });

  if (userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message: body,
        type: 'order_status',
        data: orderId ? { order_id: orderId } : {},
        is_read: false,
      });
    } catch (e) {
      // Ignored
    }
  }
}

/**
 * Standard interface for sending server-side push messages
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
    return false;
  }

  try {
    const message = {
      to: pushToken,
      sound: 'linkup_notification.mp3',
      channelId: 'linkup_notifications',
      priority: 'high',
      title,
      body,
      data,
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return res.ok;
  } catch (err) {
    return false;
  }
}
