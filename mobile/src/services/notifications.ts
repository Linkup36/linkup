import { Platform } from 'react-native';
import { supabase } from './supabase';
import { toast } from '../components/ui/GooeyToast';

export enum AndroidImportance {
  MAX = 5,
  HIGH = 4,
  DEFAULT = 3,
  LOW = 2,
  MIN = 1,
  NONE = 0,
  UNSPECIFIED = -1000,
  UNKNOWN = 0,
}

export enum AndroidNotificationPriority {
  MAX = 'max',
  HIGH = 'high',
  DEFAULT = 'default',
  LOW = 'low',
  MIN = 'min',
}

export const setNotificationHandler = (_handler: any) => {};
export const setNotificationChannelAsync = async (_channelId: string, _channel: any) => Promise.resolve();
export const getPermissionsAsync = async () => Promise.resolve({ status: 'granted' });
export const requestPermissionsAsync = async () => Promise.resolve({ status: 'granted' });
export const getExpoPushTokenAsync = async (_options?: any) => Promise.resolve({ data: 'mock-expo-push-token' });

export async function scheduleNotificationAsync(request: {
  content: {
    title: string;
    body: string;
    data?: any;
    priority?: string;
    sound?: boolean;
    vibrate?: number[];
    color?: string;
  };
  trigger?: any;
}): Promise<string> {
  const { title, body } = request.content;
  toast.info(title, { description: body });
  return 'notif-' + Date.now();
}

/**
 * Configure notification channels stub
 */
export async function setupNotificationChannelsAsync() {
  // Graceful no-op on client
}

/**
 * Registers the device for in-app notifications
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  const dummyToken = 'linkup-client-push-token';
  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({ push_token: dummyToken, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (e) {
      // Ignored
    }
  }
  return dummyToken;
}

export async function triggerLocalTestNotificationAsync(
  arg1?: string | { userId?: string; title?: string; body?: string; delaySeconds?: number },
  arg2?: string
): Promise<void> {
  const title = typeof arg1 === 'string' ? arg1 : arg1?.title || 'Test Notification';
  const body = typeof arg1 === 'string' ? arg2 : arg1?.body || 'LinkUp test notification payload received successfully.';
  toast.info(title, {
    description: body,
  });
}

export async function getDevicePushTokenDirectAsync(): Promise<string> {
  return 'linkup-local-push-token';
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
  const ok = await sendPushNotification(token, t || '', b || '', d);
  return { success: ok, error: ok ? undefined : 'Push dispatch simulated' };
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
      sound: 'default',
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
