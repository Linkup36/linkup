import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import {
  LayoutDashboard,
  Package,
  Wallet,
  ShieldCheck,
  User,
  ArrowLeft,
  Clock,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Radio,
  CheckCircle2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from '../../../navigation/types';
import { SafeAreaView, SafeView } from '../../../components/ui/SafeView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  setupNotificationChannelsAsync,
  registerForPushNotificationsAsync,
  triggerRiderMissionAlertAsync,
  triggerRiderEarningsAlertAsync,
} from '../../../services/notifications';

import { ShipmentFeedV2 } from '../components/ShipmentFeedV2';
import { LogisticsEarningsTabV2 } from '../components/LogisticsEarningsTabV2';
import { LogisticsKYCTabV2 } from '../components/LogisticsKYCTabV2';
import { LogisticsSettingsTabV2 } from '../components/LogisticsSettingsTabV2';

type LogisticsTab = 'dashboard' | 'orders' | 'earnings' | 'verification' | 'settings';

interface TabItem {
  id: LogisticsTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'My Home', icon: LayoutDashboard },
  { id: 'orders', label: 'Missions', icon: Package },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'verification', label: 'Verify ID', icon: ShieldCheck },
  { id: 'settings', label: 'Profile', icon: User },
];

export function LogisticsDashboardV2Screen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<LogisticsTab>('dashboard');
  const [isOnline, setIsOnline] = useState((profile as any)?.is_online || false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Rider Wallet & Stats
  const [balance, setBalance] = useState<number>(0);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [activeMissionCount, setActiveMissionCount] = useState<number>(0);
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [initialLoading, setInitialLoading] = useState(true);

  // Tracking refs for earnings and online status
  const prevBalanceRef = useRef<number>(0);
  const prevEscrowRef = useRef<number>(0);
  const isOnlineRef = useRef<boolean>((profile as any)?.is_online || false);
  const initialLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const fetchRiderOverview = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch wallet balances
      const { data: walletData } = await (supabase as any)
        .from('wallets')
        .select('balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletData) {
        const bal = walletData.balance || 0;
        const esc = walletData.escrow_balance || 0;
        setBalance(bal);
        setEscrowBalance(esc);

        if (!initialLoadedRef.current) {
          prevBalanceRef.current = Number(bal);
          prevEscrowRef.current = Number(esc);
          initialLoadedRef.current = true;
        }
      }

      // 2. Fetch profile status
      const { data: pData } = await supabase
        .from('profiles')
        .select('is_online')
        .eq('id', user.id)
        .maybeSingle();

      if (pData) {
        setIsOnline(pData.is_online || false);
      }

      // 3. Fetch active missions count (claimed by this rider and in transit)
      const [shipmentsRes, sendOrdersRes] = await Promise.all([
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('rider_id', user.id)
          .in('status', ['assigned', 'picked_up', 'in_transit']),
        supabase
          .from('send_orders')
          .select('id', { count: 'exact', head: true })
          .eq('rider_id', user.id)
          .in('status', ['assigned_rider', 'pickup', 'on_the_way', 'assigned', 'picked_up', 'in_transit']),
      ]);

      const totalActive = (shipmentsRes.count || 0) + (sendOrdersRes.count || 0);
      setActiveMissionCount(totalActive);

      // 4. Fetch KYC Status
      const { data: kycData } = await (supabase as any)
        .from('logistics_kyc')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (kycData?.status) {
        setKycStatus(kycData.status.toLowerCase());
      } else {
        setKycStatus('none');
      }
    } catch (e) {
      console.warn('[LogisticsDashboardV2] fetchOverview error:', e);
    } finally {
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRiderOverview();

    if (!user) return;

    // Initialize notification channels and register device push token
    setupNotificationChannelsAsync();
    registerForPushNotificationsAsync(user.id);

    // Realtime listeners for wallet, profile, missions & earnings
    const channel = supabase
      .channel(`rider-dashboard-v2-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const newBal = Number(payload.new?.balance ?? prevBalanceRef.current);
          const newEscrow = Number(payload.new?.escrow_balance ?? prevEscrowRef.current);

          if (initialLoadedRef.current) {
            // 1. Check if escrow increased (safety hold funded)
            if (newEscrow > prevEscrowRef.current) {
              const diff = newEscrow - prevEscrowRef.current;
              triggerRiderEarningsAlertAsync({
                type: 'escrow',
                amount: diff,
              });
              toast.success('🛡️ Escrow Funded!', {
                description: `₦${Math.round(diff).toLocaleString('en-NG')} placed in Escrow Safety Hold.`,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // 2. Check if ready balance increased (payout release)
            if (newBal > prevBalanceRef.current) {
              const diff = newBal - prevBalanceRef.current;
              triggerRiderEarningsAlertAsync({
                type: 'balance',
                amount: diff,
              });
              toast.success('💰 Payout Credited!', {
                description: `₦${Math.round(diff).toLocaleString('en-NG')} added to your Ready Balance for withdrawal!`,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }

          prevBalanceRef.current = newBal;
          prevEscrowRef.current = newEscrow;
          fetchRiderOverview();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => fetchRiderOverview()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments', filter: `rider_id=eq.${user.id}` },
        () => fetchRiderOverview()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders', filter: `rider_id=eq.${user.id}` },
        () => fetchRiderOverview()
      )
      // Broadcast listener for NEW available marketplace orders
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload: any) => {
          const order = payload.new;
          if (isOnlineRef.current && order?.status === 'awaiting_agent') {
            const payout = Math.round(Number(order?.shipping_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: order?.id || 'NEW',
              payout,
              pickupAddress: order?.pickup_address,
              isSendOrder: false,
            });
            toast.success('⚡ New Mission Alert!', {
              description: `Marketplace mission available! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
          fetchRiderOverview();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: any) => {
          const order = payload.new;
          if (isOnlineRef.current && order?.status === 'awaiting_agent' && payload.old?.status !== 'awaiting_agent') {
            const payout = Math.round(Number(order?.shipping_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: order?.id || 'NEW',
              payout,
              pickupAddress: order?.pickup_address,
              isSendOrder: false,
            });
            toast.success('⚡ New Mission Alert!', {
              description: `Marketplace mission available! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
          fetchRiderOverview();
        }
      )
      // Broadcast listener for NEW available SEND package orders
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'send_orders' },
        (payload: any) => {
          const sendOrder = payload.new;
          if (isOnlineRef.current && sendOrder?.status === 'finding_rider') {
            const payout = Math.round(Number(sendOrder?.delivery_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: sendOrder?.id || 'NEW',
              payout,
              pickupAddress: sendOrder?.pickup_address,
              isSendOrder: true,
            });
            toast.success('⚡ Send Package Mission!', {
              description: `New Package ready for pickup! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
          fetchRiderOverview();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'send_orders' },
        (payload: any) => {
          const sendOrder = payload.new;
          if (isOnlineRef.current && sendOrder?.status === 'finding_rider' && payload.old?.status !== 'finding_rider') {
            const payout = Math.round(Number(sendOrder?.delivery_fee || 1500) * 0.8);
            triggerRiderMissionAlertAsync({
              orderId: sendOrder?.id || 'NEW',
              payout,
              pickupAddress: sendOrder?.pickup_address,
              isSendOrder: true,
            });
            toast.success('⚡ Send Package Mission!', {
              description: `New Package ready for pickup! Payout: ₦${payout.toLocaleString('en-NG')}`,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
          fetchRiderOverview();
        }
      )
      // Real-time listener on notifications table
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          const notif = payload.new;
          if (notif) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notif.title || 'LinkUp Dispatch Notification',
                body: notif.message,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 250, 250, 250],
                color: '#E96F28',
              },
              trigger: null,
            });
            toast.info(notif.title || 'Dispatch Alert', {
              description: notif.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRiderOverview]);

  const handleToggleOnline = async (val: boolean) => {
    if (!user) return;
    try {
      setTogglingOnline(true);
      setIsOnline(val);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await (supabase as any)
        .from('profiles')
        .update({ is_online: val, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(val ? 'ONLINE FOR MISSIONS' : 'OFFLINE MODE', {
        description: val
          ? 'Radar is actively listening for dispatch missions nearby.'
          : 'Mission radar is paused. You will not receive alerts.',
      });
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      setIsOnline(!val);
      toast.error('Radar Error', { description: e?.message || 'Could not change online status.' });
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleTabSwitch = (tab: LogisticsTab) => {
    if (activeTab !== tab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor="#FFFFFF"
      statusBarStyle="dark-content"
      statusBarColor="#FFFFFF"
      contentBackgroundColor="#F8FAFC"
    >
      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color="#0F172A" />
            </TouchableOpacity>
          )}

          <View style={styles.brandContainer}>
            <View style={styles.logoPill}>
              <Text style={styles.logoPillText}>L</Text>
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerTitle}>LOGISTICS</Text>

              </View>
              <Text style={styles.headerSubtitle}>
                {profile?.full_name || profile?.display_name || user?.email || 'Rider Partner'}
              </Text>
            </View>
          </View>
        </View>

        {/* Online / Offline Quick Toggle Pill */}
        <View style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillInactive]}>
          <View
            style={[
              styles.onlineIndicatorDot,
              { backgroundColor: isOnline ? '#10B981' : '#94A3B8' },
            ]}
          />
          <Text style={[styles.onlineText, isOnline ? styles.onlineTextActive : styles.onlineTextInactive]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            thumbColor="#FFFFFF"
            disabled={togglingOnline}
            style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] } : undefined}
          />
        </View>
      </View>

      {/* 2. KYC Verification Alert Banners */}
      {kycStatus === 'none' && activeTab === 'dashboard' && (
        <View style={styles.kycNoticeBanner}>
          <View style={styles.kycNoticeIcon}>
            <ShieldAlert size={20} color="#EA580C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kycNoticeTitle}>ID Verification Required</Text>
            <Text style={styles.kycNoticeSub}>
              Complete your rider verification to unlock higher payouts and dispatch tiers.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.kycNoticeBtn}
            onPress={() => handleTabSwitch('verification')}
          >
            <Text style={styles.kycNoticeBtnText}>VERIFY</Text>
          </TouchableOpacity>
        </View>
      )}

      {kycStatus === 'pending' && activeTab === 'dashboard' && (
        <View style={[styles.kycNoticeBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
          <View style={[styles.kycNoticeIcon, { backgroundColor: '#FEF3C7' }]}>
            <Clock size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kycNoticeTitle, { color: '#92400E' }]}>Verification Under Review</Text>
            <Text style={[styles.kycNoticeSub, { color: '#B45309' }]}>
              Our dispatch team is reviewing your documents. Usually takes 2-4 hours.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.kycNoticeBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => handleTabSwitch('verification')}
          >
            <Text style={styles.kycNoticeBtnText}>STATUS</Text>
          </TouchableOpacity>
        </View>
      )}

      {kycStatus === 'rejected' && activeTab === 'dashboard' && (
        <View style={[styles.kycNoticeBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <View style={[styles.kycNoticeIcon, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={20} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kycNoticeTitle, { color: '#991B1B' }]}>Verification Needs Attention</Text>
            <Text style={[styles.kycNoticeSub, { color: '#B91C1C' }]}>
              Your documents need correction. Tap below to review rejection notes and re-upload.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.kycNoticeBtn, { backgroundColor: '#DC2626' }]}
            onPress={() => handleTabSwitch('verification')}
          >
            <Text style={styles.kycNoticeBtnText}>FIX NOW</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Main Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'dashboard' && (
          <View style={{ flex: 1 }}>
            {/* Quick Stats Strip */}
            <View style={styles.statsStripContainer}>
              <View style={styles.statMiniCard}>
                <View style={[styles.statMiniIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Package size={16} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.statMiniLabel}>ACTIVE JOBS</Text>
                  <Text style={styles.statMiniValue}>{activeMissionCount}</Text>
                </View>
              </View>

              <View style={styles.statMiniCard}>
                <View style={[styles.statMiniIcon, { backgroundColor: '#ECFDF5' }]}>
                  <TrendingUp size={16} color="#059669" />
                </View>
                <View>
                  <Text style={styles.statMiniLabel}>READY PAYOUT</Text>
                  <Text style={styles.statMiniValue}>₦ {balance.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.statMiniCard}>
                <View style={[styles.statMiniIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Clock size={16} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.statMiniLabel}>SAFETY HOLD</Text>
                  <Text style={styles.statMiniValue}>₦ {escrowBalance.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeadingRow}>
              <Radio size={14} color={colors.primary} />
              <Text style={styles.sectionHeadingText}>MY ACTIVE MISSIONS IN TRANSIT</Text>
            </View>

            <ShipmentFeedV2 defaultFilter="active" />
          </View>
        )}

        {activeTab === 'orders' && (
          <View style={{ flex: 1 }}>
            <View style={styles.sectionHeadingRow}>
              <Package size={14} color={colors.primary} />
              <Text style={styles.sectionHeadingText}>AVAILABLE DISPATCH MISSIONS</Text>
            </View>
            <ShipmentFeedV2 defaultFilter="all" />
          </View>
        )}

        {activeTab === 'earnings' && <LogisticsEarningsTabV2 />}

        {activeTab === 'verification' && <LogisticsKYCTabV2 />}

        {activeTab === 'settings' && <LogisticsSettingsTabV2 />}
      </View>

      {/* 4. Modern Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleTabSwitch(tab.id)}
              activeOpacity={0.7}
            >
              {isActive && <View style={styles.activeIndicatorLine} />}
              <View style={styles.tabIconWrapper}>
                <IconComp
                  size={20}
                  color={isActive ? colors.primary : '#94A3B8'}
                  strokeWidth={isActive ? 2.6 : 2}
                />
                {tab.id === 'orders' && activeMissionCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{activeMissionCount}</Text>
                  </View>
                )}
                {tab.id === 'verification' && kycStatus === 'verified' && (
                  <View style={styles.verifiedDot}>
                    <CheckCircle2 size={10} color="#10B981" />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoPill: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  logoPillText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  v2Badge: {
    backgroundColor: '#FFF7F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  v2BadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
    maxWidth: 160,
  },

  // Online pill
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  onlinePillActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  onlinePillInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  onlineIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  onlineTextActive: {
    color: '#15803D',
  },
  onlineTextInactive: {
    color: '#64748B',
  },

  // KYC Notice Banner
  kycNoticeBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFF7F2',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycNoticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycNoticeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#9A3412',
  },
  kycNoticeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C',
    marginTop: 2,
    lineHeight: 15,
  },
  kycNoticeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  kycNoticeBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Tab Content
  tabContentContainer: {
    flex: 1,
  },

  // Stats Strip
  statsStripContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statMiniLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  statMiniValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionHeadingText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },

  // Bottom Tab Bar
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  tabButtonActive: {},
  activeIndicatorLine: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  tabIconWrapper: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  tabLabelInactive: {
    color: '#94A3B8',
  },
});
