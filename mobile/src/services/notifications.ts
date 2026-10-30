import * as Notifications from 'expo-notifications';
import {
  scheduleNotificationAsync,
  AndroidNotificationPriority,
  AndroidImportance,
  setNotificationChannelAsync,
  setNotificationHandler,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
} from 'expo-notifications';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Helper to reliably detect if the app is running inside the Expo Go client.
 * Expo Go on Android (SDK 53+) omits `NotificationsChannelsProvider` and remote FCM token registration.
 */
export function isRunningInExpoGoClient(): boolean {
  try {
    if (typeof isRunningInExpoGo === 'function' && isRunningInExpoGo()) {
      return true;
    }
  } catch {
    // ignore
  }
  return (
    (Constants as any)?.appOwnership === 'expo' ||
    (Constants as any)?.executionEnvironment === 'storeClient'
  );
}

// Configure notification presentation behavior when app is in foreground
try {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('[PushNotifications] Handler registration skipped:', e);
}

let channelsConfigured = false;
let channelsConfiguringPromise: Promise<void> | null = null;

/**
 * Configure high-importance Android notification channels so notifications
 * slide down as heads-up popups with sound & vibration.
 */
export async function setupNotificationChannelsAsync() {
  if (Platform.OS !== 'android' || channelsConfigured) {
    return;
  }

  // Expo Go on Android does not register NotificationsChannelsProvider and uses a built-in default channel
  if (isRunningInExpoGoClient()) {
    channelsConfigured = true;
    return;
  }

  if (channelsConfiguringPromise) {
    return channelsConfiguringPromise;
  }

  channelsConfiguringPromise = (async () => {
    try {
      await setNotificationChannelAsync('default', {
        name: 'Order & Dispatch Updates',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E96F28',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
      });

      await setNotificationChannelAsync('orders', {
        name: 'Orders & Deliveries',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E96F28',
        enableVibrate: true,
        showBadge: true,
      });

      await setNotificationChannelAsync('missions', {
        name: 'New Missions & Payouts',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 350, 150, 350],
        lightColor: '#E96F28',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
      });

      channelsConfigured = true;
    } catch (channelErr: any) {
      const msg = String(channelErr?.message || channelErr || '');
      if (
        msg.includes('NotificationsChannelsProvider') ||
        msg.includes('NullPointerException') ||
        msg.includes('Expo Go')
      ) {
        // Running in an environment without custom channel provider (e.g., Expo Go)
        channelsConfigured = true;
      } else {
        console.warn('[PushNotifications] Notification channel setup notice:', channelErr);
      }
    } finally {
      channelsConfiguringPromise = null;
    }
  })();

  return channelsConfiguringPromise;
}

/**
 * Registers the device for push notifications (APNs / FCM / Expo) and saves the token to Supabase.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  try {
    await setupNotificationChannelsAsync();

    if (Device.isDevice) {
      const { status: existingStatus } = await getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PushNotifications] Push permission was denied by the user.');
        return null;
      }

      try {
        let projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        // Strip dummy placeholder project id to avoid UUID parsing errors
        if (typeof projectId !== 'string' || projectId.includes('your-eas-project-id') || projectId.length < 10) {
          projectId = undefined;
        }

        const pushTokenData = await getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = pushTokenData.data;

        // Save token to Supabase
        if (userId && token) {
          // 1. Primary: Save to push_subscriptions table (which exists in public schema)
          try {
            await supabase.from('push_subscriptions').upsert(
              {
                user_id: userId,
                endpoint: token,
                p256dh: '',
                auth: '',
                user_agent: 'LinkUp Mobile (Expo)',
              },
              { onConflict: 'user_id, endpoint' }
            );
          } catch (subErr) {
            console.warn('[PushNotifications] Notice saving to push_subscriptions:', subErr);
          }

          // 2. Secondary: Update profiles.push_token if the column exists in database
          try {
            await supabase
              .from('profiles')
              .update({ push_token: token, updated_at: new Date().toISOString() })
              .eq('id', userId);
          } catch {
            // quiet fallback if column does not exist on profiles
          }
        }
      } catch (e: any) {
        if (!isRunningInExpoGoClient() && !e?.message?.includes('Expo Go')) {
          console.warn('[PushNotifications] Notice fetching push token:', e);
        }
      }
    } else {
      console.log('[PushNotifications] Physical device recommended for remote push notifications.');
    }
  } catch (outerErr) {
    console.warn('[PushNotifications] Push registration notice:', outerErr);
  }

  return token;
}

/**
 * Helper to fetch the current Expo Push Token for this physical device
 */
export async function getDevicePushTokenDirectAsync(): Promise<string | null> {
  try {
    let projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (typeof projectId !== 'string' || projectId.includes('your-eas-project-id') || projectId.length < 10) {
      projectId = undefined;
    }

    const pushTokenData = await getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return pushTokenData.data;
  } catch (e: any) {
    if (!isRunningInExpoGoClient() && !e?.message?.includes('Expo Go')) {
      console.warn('[PushNotifications] Could not get push token:', e);
    }
    return null;
  }
}

/**
 * Triggers an instant popup push notification on the rider's phone
 * when a new dispatch mission is broadcasted.
 */
export async function triggerRiderMissionAlertAsync(options: {
  orderId: string;
  payout?: number;
  pickupAddress?: string;
  isSendOrder?: boolean;
}): Promise<string | null> {
  try {
    await setupNotificationChannelsAsync();

    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const payoutText = options.payout && options.payout > 0
      ? ` (₦${options.payout.toLocaleString('en-NG')} Payout)`
      : '';
    const title = `⚡ New Dispatch Mission!${payoutText}`;
    const pickupSnippet = options.pickupAddress ? ` at ${options.pickupAddress}` : '';
    const body = options.isSendOrder
      ? `New Send Package waiting for pickup${pickupSnippet}. Tap to view route and claim!`
      : `New order #${String(options.orderId).slice(-8).toUpperCase()} ready for pickup${pickupSnippet}. Tap to claim mission!`;

    const notificationId = await scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'new_mission',
          orderId: options.orderId,
          isSendOrder: !!options.isSendOrder,
          timestamp: Date.now(),
        },
        sound: true,
        priority: AndroidNotificationPriority.MAX,
        vibrate: [0, 350, 150, 350],
        color: '#E96F28',
      },
      trigger: null,
    });

    return notificationId;
  } catch (err) {
    console.warn('[PushNotifications] triggerRiderMissionAlertAsync notice:', err);
    return null;
  }
}

/**
 * Triggers an instant popup push notification on the rider's phone
 * when earnings are credited (either into Escrow Safety Hold or released to Wallet Balance).
 */
export async function triggerRiderEarningsAlertAsync(options: {
  type: 'escrow' | 'balance';
  amount: number;
  orderId?: string;
  newTotal?: number;
}): Promise<string | null> {
  try {
    await setupNotificationChannelsAsync();

    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const formattedAmount = `₦${Math.abs(Math.round(options.amount)).toLocaleString('en-NG')}`;
    let title = '';
    let body = '';

    if (options.type === 'escrow') {
      title = `🛡️ ${formattedAmount} Added to Escrow Safety Hold`;
      body = options.orderId
        ? `Guaranteed payout for mission #${String(options.orderId).slice(-8).toUpperCase()} is locked in your Escrow Safety Hold.`
        : `Your delivery cut has been secured in Escrow Safety Hold.`;
    } else {
      title = `💰 ${formattedAmount} Credited to Your Wallet!`;
      body = options.orderId
        ? `Delivery verified for #${String(options.orderId).slice(-8).toUpperCase()}! ${formattedAmount} released to your Ready Balance for withdrawal.`
        : `Buyer confirmed delivery! ${formattedAmount} is now ready for withdrawal in your wallet.`;
    }

    const notificationId = await scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: options.type === 'escrow' ? 'escrow_credited' : 'wallet_credited',
          amount: options.amount,
          timestamp: Date.now(),
        },
        sound: true,
        priority: AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        color: options.type === 'escrow' ? '#D97706' : '#10B981',
      },
      trigger: null,
    });

    return notificationId;
  } catch (err) {
    console.warn('[PushNotifications] triggerRiderEarningsAlertAsync notice:', err);
    return null;
  }
}

/**
 * Triggers an instant or delayed local push notification.
 * On Android, this triggers a heads-up floating banner, vibration, and alert sound!
 */
export async function triggerLocalTestNotificationAsync(options?: {
  title?: string;
  body?: string;
  delaySeconds?: number;
  userId?: string;
}): Promise<{ id: string; scheduledTime: number }> {
  await setupNotificationChannelsAsync();

  // Check and request permissions
  const { status: existingStatus } = await getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Notification permission denied. Please allow notifications in Android settings.');
  }

  const title = options?.title || '🚀 LinkUp Real-Time Alert';
  const body =
    options?.body ||
    'Your courier order #ORD-8821 has been picked up by rider and is on the way!';
  const delaySeconds = options?.delaySeconds ?? 0;

  const notificationId = await scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: 'test_notification',
        timestamp: Date.now(),
        screen: 'Notifications',
      },
      sound: true,
      priority: AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
      color: '#E96F28',
    },
    trigger:
      delaySeconds > 0
        ? ({
          type: (Notifications as any).SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval',
          seconds: delaySeconds,
        } as any)
        : null,
  });

  // Also insert into Supabase notifications table if userId provided so inbox gets it
  if (options?.userId) {
    try {
      await supabase.from('notifications').insert({
        user_id: options.userId,
        title,
        message: body,
        type: 'delivery',
        is_read: false,
      });
    } catch (dbErr) {
      console.warn('[PushNotifications] Supabase notification insert notice:', dbErr);
    }
  }

  return { id: notificationId, scheduledTime: Date.now() + delaySeconds * 1000 };
}

/**
 * Sends a remote push notification across the internet to this device using Expo's push service.
 */
export async function sendRemoteExpoPushNotificationAsync(
  expoPushToken: string,
  options?: {
    title?: string;
    body?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: options?.title || '🚀 LinkUp Remote Push Test',
      body:
        options?.body ||
        'Real-time push delivered over the internet via Expo Cloud to your Android phone!',
      data: { type: 'remote_test', timestamp: Date.now() },
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return { success: true, data: result };
  } catch (err: any) {
    console.error('[PushNotifications] Remote push error:', err);
    return { success: false, error: err?.message || 'Failed to send remote push' };
  }
}
