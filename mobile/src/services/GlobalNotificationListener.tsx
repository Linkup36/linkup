import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { supabase } from './supabase';
import {
  setupNotificationChannelsAsync,
  registerForPushNotificationsAsync,
  triggerRiderMissionAlertAsync,
} from './notifications';
import { toast } from '../components/ui/GooeyToast';

/**
 * GlobalNotificationListener
 * 
 * Provides steady, real-time push and heads-up notifications across the entire mobile app:
 * 1. For Buyers:
 *    - Order accepted by seller
 *    - Rider assigned to shipment
 *    - Order picked up & out for delivery
 *    - Order delivered
 * 2. For Couriers (Logistics riders):
 *    - New available marketplace delivery mission in zone
 *    - New available LinkUp Send package mission in zone
 *    - Instant heads-up sound & vibration banner
 * 3. General In-App Notification Alerts:
 *    - Any insert into public.notifications triggers instant native heads-up popup
 */
export function GlobalNotificationListener() {
  const { user, roles, activeRole } = useAuth();
  const userId = user?.id;
  const processedNotifs = useRef<Set<string>>(new Set());

  // 1. Initial Push Registration & Channels Setup
  useEffect(() => {
    if (!userId) return;

    setupNotificationChannelsAsync().catch((err) => {
      console.warn('[GlobalNotifications] Channel setup error:', err);
    });

    registerForPushNotificationsAsync(userId).catch((err) => {
      console.warn('[GlobalNotifications] Push registration error:', err);
    });
  }, [userId]);

  // 2. Global Realtime Subscriptions
  useEffect(() => {
    if (!userId) return;

    const isLogisticsUser =
      activeRole === 'logistics' ||
      (Array.isArray(roles) && roles.includes('logistics'));

    const channel = supabase
      .channel(`global-push-listener-${userId}`)
      // --- (A) Listen for any new row in notifications for this user ---
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload: any) => {
          const notif = payload.new;
          if (!notif || processedNotifs.current.has(notif.id)) return;
          processedNotifs.current.add(notif.id);

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notif.title || 'LinkUp Notification',
                body: notif.message,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 250, 250, 250],
                color: '#E96F28',
                data: {
                  url: notif.url,
                  type: notif.type,
                  orderId: notif.order_id,
                },
              },
              trigger: null,
            });

            toast.info(notif.title || 'LinkUp Alert', {
              description: notif.message,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (err) {
            console.warn('[GlobalNotifications] Local schedule error:', err);
          }
        }
      )
      // --- (B) Listen for Buyer Order status updates ---
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${userId}`,
        },
        async (payload: any) => {
          const order = payload.new;
          const oldStatus = payload.old?.status;
          const newStatus = order?.status;

          if (!newStatus || newStatus === oldStatus) return;

          const snippet = String(order.id).slice(-8).toUpperCase();
          let title = '';
          let body = '';

          if (newStatus === 'accepted' || newStatus === 'awaiting_agent') {
            title = 'Order Accepted! 🛍️';
            body = `Your order #${snippet} has been accepted by the seller and is ready for courier dispatch!`;
          } else if (newStatus === 'picked_up') {
            title = 'Order Picked Up! 📦';
            body = `Your order #${snippet} has been picked up by the courier!`;
          } else if (newStatus === 'out_for_delivery') {
            title = 'Out for Delivery! 🚚';
            body = `Your order #${snippet} is on the way! Track your courier live.`;
          } else if (newStatus === 'delivered') {
            title = 'Order Delivered! 🎉';
            body = `Your order #${snippet} has been delivered! Please inspect and confirm delivery.`;
          }

          if (title && body) {
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title,
                  body,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  vibrate: [0, 250, 250, 250],
                  color: '#E96F28',
                  data: { orderId: order.id, type: 'order' },
                },
                trigger: null,
              });

              toast.success(title, { description: body });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err) {
              console.warn('[GlobalNotifications] Order alert error:', err);
            }
          }
        }
      );

    // --- (C) For Logistics Couriers: Listen for NEW Available Missions in Zone ---
    if (isLogisticsUser) {
      // 1. Marketplace orders broadcasted
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          const order = payload.new;
          const isNewBroadcast =
            order?.status === 'awaiting_agent' &&
            payload.old?.status !== 'awaiting_agent';

          if (isNewBroadcast) {
            const payout = Math.round(Number(order?.shipping_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: order?.id || 'NEW',
              payout,
              pickupAddress: order?.pickup_address,
              isSendOrder: false,
            }).catch(() => {});

            toast.info('⚡ New Mission Alert!', {
              description: `Marketplace mission available! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }
        }
      );

      // 2. LinkUp Send package missions
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'send_orders',
        },
        (payload: any) => {
          const sendOrder = payload.new;
          const isNewSend =
            sendOrder?.status === 'finding_rider' &&
            payload.old?.status !== 'finding_rider';

          if (isNewSend) {
            const payout = Math.round(Number(sendOrder?.delivery_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: sendOrder?.id || 'NEW',
              payout,
              pickupAddress: sendOrder?.pickup_address,
              isSendOrder: true,
            }).catch(() => {});

            toast.info('⚡ Send Package Mission!', {
              description: `New Package ready for pickup! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }
        }
      );
    }

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[GlobalNotifications] Realtime push listeners active.');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, roles, activeRole]);

  return null;
}
