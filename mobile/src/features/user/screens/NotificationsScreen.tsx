import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  Package,
  Wallet,
  MessageSquare,
  Clock,
  Send,
  Sparkles,
  Smartphone,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  triggerLocalTestNotificationAsync,
  sendRemoteExpoPushNotificationAsync,
  getDevicePushTokenDirectAsync,
  setupNotificationChannelsAsync,
} from '../../../services/notifications';

interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  type?: string;
  read: boolean;
  created_at: string;
}

export function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Test Lab state
  const [isFiringInstant, setIsFiringInstant] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isSendingRemote, setIsSendingRemote] = useState(false);
  const [lastTestStatus, setLastTestStatus] = useState<string | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  const fetchNotifications = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data) {
        setNotifications(data as NotificationItem[]);
      }
    } catch (err) {
      console.warn('[NotificationsScreen] Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    setupNotificationChannelsAsync().catch(() => {});

    // Attempt fetching push token for physical device inspector
    getDevicePushTokenDirectAsync().then((tok) => {
      if (tok) setPushToken(tok);
    });

    if (!user?.id) return;
    const channel = supabase
      .channel(`mobile-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationItem;
          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, 40));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
    getDevicePushTokenDirectAsync().then((tok) => {
      if (tok) setPushToken(tok);
    });
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.warn('Mark as read error', e);
    }
  };

  // 1. Instant Test: Drops down heads-up notification right now
  const handleTestInstantPopup = async () => {
    setIsFiringInstant(true);
    setLastTestStatus('Firing instant notification...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await triggerLocalTestNotificationAsync({
        userId: user?.id,
        title: '🔔 LinkUp Real-Time Alert',
        body: 'Courier #ORD-7749 has picked up your package and is on the way!',
        delaySeconds: 0,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLastTestStatus('Instant popup fired! Watch the top of your screen.');
      // Refresh list to show newly logged notification
      setTimeout(() => fetchNotifications(), 600);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Notification Notice', err?.message || 'Could not trigger notification.');
      setLastTestStatus('Failed to fire instant notification.');
    } finally {
      setIsFiringInstant(false);
    }
  };

  // 2. Delayed 5s Test: Allows minimizing the app or locking the phone to see it pop up in background
  const handleTestBackgroundDelay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setCountdown(5);
    setLastTestStatus('Scheduled for 5s! Minimize or lock phone now.');

    try {
      await triggerLocalTestNotificationAsync({
        userId: user?.id,
        title: '📦 LinkUp Courier Arrived',
        body: 'Rider is now outside your dropoff gate with your order!',
        delaySeconds: 5,
      });

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let remaining = 5;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownIntervalRef.current);
          setCountdown(null);
          setLastTestStatus('Pop up fired! Check notification tray / lock screen.');
          fetchNotifications();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not schedule notification.');
      setCountdown(null);
      setLastTestStatus(null);
    }
  };

  // 3. Remote Cloud Push Test: Uses Expo push servers
  const handleTestRemoteExpoPush = async () => {
    if (!pushToken) {
      const tok = await getDevicePushTokenDirectAsync();
      if (!tok) {
        Alert.alert(
          'Push Token Needed',
          'Could not retrieve ExponentPushToken. Make sure the app is running on a physical Android device connected to Expo.'
        );
        return;
      }
      setPushToken(tok);
    }

    const tokenToSend = pushToken;
    if (!tokenToSend) return;

    setIsSendingRemote(true);
    setLastTestStatus('Sending remote push to Expo servers...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const res = await sendRemoteExpoPushNotificationAsync(tokenToSend, {
        title: '🚀 LinkUp Remote Push Received',
        body: 'Delivered securely across the web via Expo Cloud to your Android phone!',
      });

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setLastTestStatus('Remote push sent! Expo ticket received successfully.');
        setTimeout(() => fetchNotifications(), 1000);
      } else {
        Alert.alert('Remote Push Notice', res.error || 'Failed to dispatch remote push.');
        setLastTestStatus('Expo Cloud push failed.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Remote push encountered an issue.');
      setLastTestStatus('Remote push failed.');
    } finally {
      setIsSendingRemote(false);
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'wallet':
        return <Wallet size={18} color="#16a34a" />;
      case 'delivery':
        return <Package size={18} color="#2563eb" />;
      case 'chat':
        return <MessageSquare size={18} color="#4f46e5" />;
      default:
        return <Bell size={18} color="#E96F28" />;
    }
  };

  const getNotificationTitle = (type?: string) => {
    switch (type) {
      case 'order':
        return 'New Order';
      case 'wallet':
      case 'payment':
        return 'Payment Update';
      case 'delivery':
        return 'Delivery Update';
      case 'chat':
        return 'New Message';
      default:
        return 'LinkUp Notification';
    }
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Real-Time Dispatch & Alerts</Text>
        </View>
        <TouchableOpacity
          style={styles.markReadBtn}
          onPress={handleMarkAllAsRead}
          activeOpacity={0.7}
        >
          <CheckCheck size={18} color="#E96F28" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E96F28']}
          />
        }
        ListHeaderComponent={
          <View style={styles.labCard}>
            {/* Lab Card Header */}
            <View style={styles.labHeader}>
              <View style={styles.labIconWrap}>
                <Bell size={20} color="#E96F28" />
              </View>
              <View style={styles.labHeaderTextWrap}>
                <View style={styles.labTitleRow}>
                  <Text style={styles.labTitle}>Android Push Notification Lab</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>READY</Text>
                  </View>
                </View>
                <Text style={styles.labSubtitle}>
                  Trigger instant heads-up banners, vibration, & sound to verify real-time alerts.
                </Text>
              </View>
            </View>

            {/* Test Trigger Buttons Grid */}
            <View style={styles.testBtnGrid}>
              {/* Button 1: Instant Heads-Up */}
              <TouchableOpacity
                style={[styles.testBtn, styles.testBtnPrimary]}
                onPress={handleTestInstantPopup}
                disabled={isFiringInstant}
                activeOpacity={0.8}
              >
                {isFiringInstant ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Sparkles size={16} color="#ffffff" />
                    <Text style={styles.testBtnPrimaryText}>Instant Popup</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Button 2: 5s Background Delay */}
              <TouchableOpacity
                style={[
                  styles.testBtn,
                  styles.testBtnSecondary,
                  countdown !== null && styles.testBtnActive,
                ]}
                onPress={handleTestBackgroundDelay}
                disabled={countdown !== null}
                activeOpacity={0.8}
              >
                <Clock
                  size={16}
                  color={countdown !== null ? '#ffffff' : '#0f172a'}
                />
                <Text
                  style={[
                    styles.testBtnSecondaryText,
                    countdown !== null && styles.testBtnActiveText,
                  ]}
                >
                  {countdown !== null ? `Lock/Min (${countdown}s)` : '5s Background'}
                </Text>
              </TouchableOpacity>

              {/* Button 3: Remote Cloud Push */}
              <TouchableOpacity
                style={[styles.testBtn, styles.testBtnOutline]}
                onPress={handleTestRemoteExpoPush}
                disabled={isSendingRemote}
                activeOpacity={0.8}
              >
                {isSendingRemote ? (
                  <ActivityIndicator size="small" color="#E96F28" />
                ) : (
                  <>
                    <Send size={15} color="#E96F28" />
                    <Text style={styles.testBtnOutlineText}>Remote Push</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Status Toast Banner */}
            {lastTestStatus && (
              <View style={styles.statusToast}>
                <CheckCircle2 size={14} color="#16a34a" />
                <Text style={styles.statusToastText} numberOfLines={2}>
                  {lastTestStatus}
                </Text>
              </View>
            )}

            {/* Device Token Inspector */}
            <View style={styles.tokenBox}>
              <View style={styles.tokenHeader}>
                <Smartphone size={13} color="#64748b" />
                <Text style={styles.tokenLabel}>Android Device Push Token:</Text>
              </View>
              <TextInput
                value={pushToken || 'Fetching ExponentPushToken...'}
                editable={false}
                selectTextOnFocus
                style={styles.tokenInput}
              />
            </View>

            {/* Section Divider */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Notifications</Text>
              <Text style={styles.sectionCount}>
                {notifications.length} message{notifications.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.notifCard, !item.read && styles.unreadCard]}>
            <View style={styles.iconBox}>{getNotificationIcon(item.type)}</View>
            <View style={styles.notifContent}>
              <View style={styles.titleRow}>
                <Text style={styles.notifTitle}>{item.title || getNotificationTitle(item.type)}</Text>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMessage}>{item.message}</Text>
              <Text style={styles.notifDate}>
                {new Date(item.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#E96F28" />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Bell size={42} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap "Instant Popup" above to test your first real-time notification!
              </Text>
            </View>
          )
        }
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  markReadBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  labCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#E96F28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  labHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  labIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
    marginRight: 12,
  },
  labHeaderTextWrap: {
    flex: 1,
  },
  labTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  labTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginLeft: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  labSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  testBtnGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  testBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  testBtnPrimary: {
    backgroundColor: '#E96F28',
    shadowColor: '#E96F28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  testBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  testBtnSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  testBtnSecondaryText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  testBtnActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  testBtnActiveText: {
    color: '#ffffff',
  },
  testBtnOutline: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  testBtnOutlineText: {
    color: '#E96F28',
    fontSize: 11,
    fontWeight: '700',
  },
  statusToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 10,
  },
  statusToastText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },
  tokenBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  tokenInput: {
    fontSize: 10,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
    margin: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#fffaf5',
    borderColor: '#ffedd5',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E96F28',
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 16,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
