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
  ScrollView,
  Animated,
  Image,
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
  ChevronRight,
  Truck,
  MapPin,
  Navigation as NavIcon,
  ArrowUpRight,
  Check,
  CreditCard,
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
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';
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
import { MissionDetailsModalV2 } from '../components/MissionDetailsModalV2';
import { calculateRiderEarnings, getPickupAddress, getDeliveryAddress } from '../utils/logistics-utils';

type LogisticsTab = 'dashboard' | 'orders' | 'earnings' | 'verification' | 'settings';

interface TabItem {
  id: LogisticsTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'orders', label: 'Missions', icon: Package },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'verification', label: 'ID Verify', icon: ShieldCheck },
  { id: 'settings', label: 'Profile', icon: User },
];

const getMissionStageInfo = (status: string) => {
  const s = (status || '').toLowerCase();
  if (['delivered', 'completed'].includes(s)) {
    return { step: 4, label: 'Delivered', badgeBg: '#DCFCE7', badgeText: '#15803D' };
  }
  if (['in_transit', 'on_the_way'].includes(s)) {
    return { step: 3, label: 'In Transit', badgeBg: '#EFF6FF', badgeText: '#1D4ED8' };
  }
  if (['picked_up', 'pickup', 'arrived'].includes(s)) {
    return { step: 2, label: 'Picked Up', badgeBg: '#FAF5FF', badgeText: '#7E22CE' };
  }
  return { step: 1, label: 'Assigned', badgeBg: '#FFFBEB', badgeText: '#B45309' };
};

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
  const [riderVehicle, setRiderVehicle] = useState<string>('Car (Sedan)');
  const [riderCityName, setRiderCityName] = useState<string>('All Cities');
  const [riderBankName, setRiderBankName] = useState<string>((profile as any)?.payout_bank_name || '');
  const [initialLoading, setInitialLoading] = useState(true);

  // Home Screen active delivery snapshot state
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [availableMissionCount, setAvailableMissionCount] = useState<number>(0);
  const [completedMissionCount, setCompletedMissionCount] = useState<number>(0);
  const [selectedHomeMission, setSelectedHomeMission] = useState<any | null>(null);
  const [homeModalVisible, setHomeModalVisible] = useState(false);
  const [activeMissionIdx, setActiveMissionIdx] = useState<number>(0);

  // Scroll-reactive navigation & cool animated transition states
  const lastScrollY = useRef(0);
  const navTranslateY = useRef(new Animated.Value(0)).current;
  const isNavHiddenRef = useRef(false);

  const tabIndexMap: Record<LogisticsTab, number> = {
    dashboard: 0,
    orders: 1,
    earnings: 2,
    verification: 3,
    settings: 4,
  };

  const [tabBarWidth, setTabBarWidth] = useState(0);
  const containerWidth = tabBarWidth || (Dimensions.get('window').width - 28);
  const singleTabWidth = (containerWidth - 12) / 5;

  const tabIndicatorX = useRef(new Animated.Value(0)).current;

  // Icon bounce scales for each tab
  const iconScales = useRef({
    dashboard: new Animated.Value(1),
    orders: new Animated.Value(1),
    earnings: new Animated.Value(1),
    verification: new Animated.Value(1),
    settings: new Animated.Value(1),
  }).current;

  // Content transition animations (fade & subtle slide)
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const idx = tabIndexMap[activeTab];
    tabIndicatorX.setValue(idx * singleTabWidth);
  }, [singleTabWidth]);

  // Smooth scroll listener to auto-hide bottom bar on scroll down and reveal on scroll up
  const handleScroll = useCallback((e: any) => {
    const currentY = e.nativeEvent?.contentOffset?.y ?? 0;
    const diff = currentY - lastScrollY.current;
    const contentHeight = e.nativeEvent?.contentSize?.height || 0;
    const layoutHeight = e.nativeEvent?.layoutMeasurement?.height || 0;
    const isNearBottom = contentHeight > 0 && currentY + layoutHeight >= contentHeight - 50;

    // If near top or near bottom, always reveal
    if (currentY <= 35 || isNearBottom) {
      if (isNavHiddenRef.current) {
        isNavHiddenRef.current = false;
        Animated.spring(navTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff > 8 && currentY > 60) {
      // Scrolling DOWN -> smoothly glide bottom bar down offscreen
      if (!isNavHiddenRef.current) {
        isNavHiddenRef.current = true;
        Animated.spring(navTranslateY, {
          toValue: 100,
          damping: 22,
          stiffness: 200,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff < -6) {
      // Scrolling UP -> smoothly glide bottom bar back up
      if (isNavHiddenRef.current) {
        isNavHiddenRef.current = false;
        Animated.spring(navTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }
    }

    lastScrollY.current = currentY;
  }, [navTranslateY]);

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

      // 2. Fetch profile status & specs
      const { data: pData } = await supabase
        .from('profiles')
        .select('is_online, city_id, payout_bank_name, is_verified')
        .eq('id', user.id)
        .maybeSingle();

      if (pData) {
        setIsOnline(pData.is_online || false);
        if (pData.payout_bank_name) setRiderBankName(pData.payout_bank_name);
        if (pData.city_id) {
          const { data: cData } = await supabase
            .from('cities')
            .select('name')
            .eq('id', pData.city_id)
            .maybeSingle();
          if (cData?.name) setRiderCityName(cData.name);
        }
      }

      // 2b. Fetch logistics vehicle
      const { data: logDetails } = await (supabase as any)
        .from('logistics_details')
        .select('vehicle_type')
        .eq('user_id', user.id)
        .maybeSingle();

      if (logDetails?.vehicle_type) {
        setRiderVehicle(logDetails.vehicle_type);
      }

      // 3. Fetch active missions and available count
      const [shipmentsRes, sendOrdersRes, availOrdersRes, availSendRes, delShipmentsRes, delSendRes] = await Promise.all([
        supabase
          .from('shipments')
          .select(`
            *,
            order:orders (
              *,
              order_recipient (*),
              buyer:profiles!buyer_id (*),
              seller:profiles!seller_id (*)
            )
          `)
          .eq('rider_id', user.id)
          .in('status', ['assigned', 'picked_up', 'in_transit'])
          .order('created_at', { ascending: false }),
        supabase
          .from('send_orders')
          .select('*')
          .eq('rider_id', user.id)
          .in('status', ['assigned_rider', 'pickup', 'on_the_way', 'assigned', 'picked_up', 'in_transit'])
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'awaiting_agent'),
        supabase
          .from('send_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'finding_rider'),
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('rider_id', user.id)
          .eq('status', 'delivered'),
        supabase
          .from('send_orders')
          .select('id', { count: 'exact', head: true })
          .eq('rider_id', user.id)
          .eq('status', 'delivered'),
      ]);

      const formattedActive: any[] = [];
      if (shipmentsRes.data) {
        formattedActive.push(
          ...shipmentsRes.data.map((s: any) => ({
            ...s,
            rider_earnings: calculateRiderEarnings(s),
          }))
        );
      }
      if (sendOrdersRes.data) {
        formattedActive.push(
          ...sendOrdersRes.data.map((s: any) => ({
            id: s.id,
            order_id: s.id,
            is_send_order: true,
            status: s.status,
            pickup_address: s.pickup_address,
            pickup_address_text: s.pickup_address,
            pickup_directions: s.pickup_directions,
            delivery_address: s.dropoff_address,
            delivery_address_text: s.dropoff_address,
            dropoff_address: s.dropoff_address,
            dropoff_directions: s.dropoff_directions,
            delivery_fee: s.delivery_fee,
            rider_earnings: calculateRiderEarnings({ ...s, is_send_order: true }),
            created_at: s.created_at,
            sender_name: s.sender_name,
            sender_phone: s.sender_phone,
            recipient_name: s.dropoff_recipient_name,
            recipient_phone: s.dropoff_recipient_phone,
            seller: { name: s.sender_name, phone: s.sender_phone, address: s.pickup_address },
            buyer: { name: s.dropoff_recipient_name, phone: s.dropoff_recipient_phone, address: s.dropoff_address },
            package_details: s.package_details,
          }))
        );
      }

      setActiveMissions(formattedActive);
      setActiveMissionCount(formattedActive.length);
      setAvailableMissionCount((availOrdersRes.count || 0) + (availSendRes.count || 0));
      setCompletedMissionCount((delShipmentsRes.count || 0) + (delSendRes.count || 0));

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

      // 1. Reveal bottom bar if it was hidden
      if (isNavHiddenRef.current) {
        isNavHiddenRef.current = false;
        Animated.spring(navTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }

      // 2. Smooth spring slide for bottom tab indicator
      const targetIndex = tabIndexMap[tab];
      const targetX = targetIndex * singleTabWidth;
      Animated.spring(tabIndicatorX, {
        toValue: targetX,
        damping: 20,
        stiffness: 220,
        mass: 0.75,
        useNativeDriver: true,
      }).start();

      // 3. Icon bounce animation for selected tab
      const targetScale = iconScales[tab];
      if (targetScale) {
        targetScale.setValue(0.82);
        Animated.spring(targetScale, {
          toValue: 1,
          damping: 12,
          stiffness: 260,
          mass: 0.6,
          useNativeDriver: true,
        }).start();
      }

      // 4. Cool content transition
      contentFadeAnim.setValue(0.78);
      contentSlideAnim.setValue(8);
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(contentSlideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();

      setActiveTab(tab);
    }
  };

  const handleOpenHomeMission = (mission: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHomeMission(mission);
    setHomeModalVisible(true);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor="#FA7E2B"
      statusBarStyle="light-content"
      statusBarColor="#FA7E2B"
      contentBackgroundColor="#F8FAFC"
    >
      {/* 1. Big Hero Card in #FA7E2B with Curvy Bottom Edges */}
      <View style={styles.heroCard}>
        {activeTab === 'settings' ? (
          <View style={styles.profileHeroWrapper}>
            {/* Top Identity Row */}
            <View style={styles.profileHeroTopRow}>
              {/* Courier Avatar with Photo & Online Dot */}
              <View style={styles.profileHeroAvatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.profileHeroAvatarImg} />
                ) : (
                  <View style={styles.profileHeroAvatarFallback}>
                    <Text style={styles.profileHeroAvatarText}>
                      {String(profile?.full_name || profile?.display_name || user?.email || 'R').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.avatarOnlineDotLarge,
                    { backgroundColor: isOnline ? '#10B981' : '#94A3B8' },
                  ]}
                />
              </View>

              {/* Rider Identity Info */}
              <View style={styles.profileHeroTextCol}>
                <Text style={styles.profileHeroName} numberOfLines={1}>
                  {profile?.full_name || profile?.display_name || 'Courier Partner'}
                </Text>
                <Text style={styles.profileHeroPhone}>
                  {(profile?.phone || (profile as any)?.phone_number)
                    ? `+234 ${(profile?.phone || (profile as any)?.phone_number).replace(/^0/, '')}`
                    : 'No phone linked'}
                </Text>

                <View style={styles.profileHeroBadgesRow}>
                  <View style={styles.profileGlassBadge}>
                    <Text style={styles.profileGlassBadgeText}>
                      #{user?.id ? `RD-${user.id.slice(0, 6).toUpperCase()}` : 'RD-COURIER'}
                    </Text>
                  </View>
                  {kycStatus === 'verified' ? (
                    <View style={[styles.profileGlassBadge, styles.profileVerifiedGlassBadge]}>
                      <ShieldCheck size={11} color="#FFFFFF" strokeWidth={2.6} />
                      <Text style={styles.profileGlassBadgeText}>VERIFIED PARTNER</Text>
                    </View>
                  ) : (
                    <View style={styles.profileGlassBadge}>
                      <Text style={styles.profileGlassBadgeText}>KYC UNDER REVIEW</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Online / Offline Quick Toggle Pill */}
              <View style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillInactive]}>
                <View
                  style={[
                    styles.onlineIndicatorDot,
                    { backgroundColor: isOnline ? '#10B981' : 'rgba(255, 255, 255, 0.5)' },
                  ]}
                />
                <Text style={[styles.onlineText, isOnline ? styles.onlineTextActive : styles.onlineTextInactive]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.35)', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                  disabled={togglingOnline}
                  style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }] } : undefined}
                />
              </View>
            </View>

            {/* 3 Cockpit Cards in Top Banner: FLEET MODE, BASE ZONE, SETTLEMENT */}
            <View style={styles.statsThreeRow}>
              {/* Card 1: Fleet Mode */}
              <View style={styles.statCard}>
                <View style={styles.statCardTop}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={{ fontSize: 13 }}>
                      {riderVehicle.toLowerCase().includes('bike') || riderVehicle.toLowerCase().includes('motorcycle')
                        ? '🏍️'
                        : riderVehicle.toLowerCase().includes('bicycle')
                        ? '🚲'
                        : riderVehicle.toLowerCase().includes('truck')
                        ? '🚚'
                        : riderVehicle.toLowerCase().includes('van')
                        ? '🚐'
                        : '🚗'}
                    </Text>
                  </View>
                  <Text style={[styles.statCardSubLabel, { color: '#16A34A' }]}>FLEET</Text>
                </View>
                <Text style={styles.statCardLabel}>FLEET MODE</Text>
                <Text style={styles.statCardValueDark} numberOfLines={1}>
                  {riderVehicle}
                </Text>
              </View>

              {/* Card 2: Base Zone */}
              <View style={styles.statCard}>
                <View style={styles.statCardTop}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                    <MapPin size={13} color="#2563EB" strokeWidth={2.5} />
                  </View>
                  <Text style={[styles.statCardSubLabel, { color: '#2563EB' }]}>ZONE</Text>
                </View>
                <Text style={styles.statCardLabel}>BASE ZONE</Text>
                <Text style={styles.statCardValueDark} numberOfLines={1}>
                  {riderCityName}
                </Text>
              </View>

              {/* Card 3: Settlement Bank */}
              <View style={styles.statCard}>
                <View style={styles.statCardTop}>
                  <View
                    style={[
                      styles.statIconBadge,
                      { backgroundColor: riderBankName ? '#ECFDF5' : '#FFFBEB' },
                    ]}
                  >
                    <CreditCard
                      size={13}
                      color={riderBankName ? '#059669' : '#D97706'}
                      strokeWidth={2.5}
                    />
                  </View>
                  <Text
                    style={[
                      styles.statCardSubLabel,
                      { color: riderBankName ? '#059669' : '#D97706' },
                    ]}
                  >
                    PAYOUT
                  </Text>
                </View>
                <Text style={styles.statCardLabel}>SETTLEMENT</Text>
                <Text
                  style={[
                    styles.statCardValueDark,
                    riderBankName && { color: '#059669' },
                  ]}
                  numberOfLines={1}
                >
                  {riderBankName || 'Not Linked'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Header Profile Row */}
            <View style={styles.headerBar}>
              <TouchableOpacity
                style={styles.headerProfileBtn}
                onPress={() => handleTabSwitch('settings')}
                activeOpacity={0.75}
              >
                <View style={styles.avatarWrap}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImageSmall} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {String(profile?.full_name || profile?.display_name || user?.email || 'R').charAt(0).toUpperCase()}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.avatarOnlineDot,
                      { backgroundColor: isOnline ? '#10B981' : '#94A3B8' },
                    ]}
                  />
                </View>
                <View style={styles.profileTextWrap}>
                  <View style={styles.nameRow}>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {profile?.full_name || profile?.display_name || 'Rider Partner'}
                    </Text>
                    <ChevronRight size={14} color="rgba(255, 255, 255, 0.85)" />
                  </View>
                  <Text style={styles.driverRole}>LinkUp Courier • Tap for profile</Text>
                </View>
              </TouchableOpacity>

              {/* Online / Offline Quick Toggle Pill */}
              <View style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillInactive]}>
                <View
                  style={[
                    styles.onlineIndicatorDot,
                    { backgroundColor: isOnline ? '#10B981' : 'rgba(255, 255, 255, 0.5)' },
                  ]}
                />
                <Text style={[styles.onlineText, isOnline ? styles.onlineTextActive : styles.onlineTextInactive]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.35)', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                  disabled={togglingOnline}
                  style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }] } : undefined}
                />
              </View>
            </View>

            {/* Three Summary Cards Grouped Together Inside This #FA7E2B Card */}
            {activeTab === 'dashboard' && (
              <View style={styles.statsThreeRow}>
                {/* Card 1: Available Earnings */}
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => handleTabSwitch('earnings')}
                  activeOpacity={0.85}
                >
                  <View style={styles.statCardTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#ECFDF5' }]}>
                      <Wallet size={14} color="#059669" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.statCardSubLabel}>READY</Text>
                  </View>
                  <Text style={styles.statCardLabel}>AVAILABLE</Text>
                  <AnimatedCounter
                    value={balance}
                    duration={1200}
                    prefix="₦"
                    style={styles.statCardValueGreen}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  />
                </TouchableOpacity>

                {/* Card 2: Pending / Safety Hold */}
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => handleTabSwitch('earnings')}
                  activeOpacity={0.85}
                >
                  <View style={styles.statCardTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#FFFBEB' }]}>
                      <Clock size={14} color="#D97706" strokeWidth={2.5} />
                    </View>
                    <Text style={[styles.statCardSubLabel, { color: '#B45309' }]}>ESCROW</Text>
                  </View>
                  <Text style={styles.statCardLabel}>SAFETY HOLD</Text>
                  <AnimatedCounter
                    value={escrowBalance}
                    duration={1200}
                    prefix="₦"
                    style={styles.statCardValueAmber}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  />
                </TouchableOpacity>

                {/* Card 3: Active Jobs */}
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => handleTabSwitch('orders')}
                  activeOpacity={0.85}
                >
                  <View style={styles.statCardTop}>
                    <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                      <Package size={14} color="#2563EB" strokeWidth={2.5} />
                    </View>
                    <Text style={[styles.statCardSubLabel, { color: '#2563EB' }]}>LIVE</Text>
                  </View>
                  <Text style={styles.statCardLabel}>ACTIVE JOBS</Text>
                  <AnimatedCounter
                    value={activeMissionCount}
                    duration={1000}
                    prefix=""
                    style={styles.statCardValueBlue}
                    numberOfLines={1}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* 2. KYC Verification Alert Banners */}
      {kycStatus === 'none' && activeTab === 'dashboard' && (
        <View style={styles.kycNoticeBanner}>
          <View style={styles.kycNoticeIcon}>
            <ShieldAlert size={18} color="#EA580C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kycNoticeTitle}>ID Verification Required</Text>
            <Text style={styles.kycNoticeSub}>
              Verify your documents to unlock full delivery tiers and instant withdrawals.
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
            <Clock size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kycNoticeTitle, { color: '#92400E' }]}>Verification Under Review</Text>
            <Text style={[styles.kycNoticeSub, { color: '#B45309' }]}>
              Our dispatch team is reviewing your ID documents.
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
            <AlertTriangle size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kycNoticeTitle, { color: '#991B1B' }]}>Verification Needs Attention</Text>
            <Text style={[styles.kycNoticeSub, { color: '#B91C1C' }]}>
              Tap to review rejection notes and re-upload.
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

      {/* 3. Main Tab Content with Cool Screen Transition */}
      <Animated.View
        style={[
          styles.tabContentContainer,
          {
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          },
        ]}
      >
        {activeTab === 'dashboard' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.homeScrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Live Delivery Snapshot Card (Active Mission) */}
            {activeMissions.length > 0 ? (
              <View style={styles.liveDeliverySection}>
                {/* Multi-mission chip switcher if more than 1 active mission */}
                {activeMissions.length > 1 && (
                  <View style={styles.missionSwitcherRow}>
                    <Text style={styles.missionSwitcherCount}>
                      {activeMissions.length} ACTIVE DELIVERIES
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {activeMissions.map((m: any, idx: number) => {
                        const isSelected = idx === activeMissionIdx;
                        const refSnippet = String(m.order_id || m.id).slice(-6).toUpperCase();
                        return (
                          <TouchableOpacity
                            key={m.id || idx}
                            style={[styles.switcherChip, isSelected && styles.switcherChipActive]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setActiveMissionIdx(idx);
                            }}
                          >
                            <View style={[styles.switcherChipDot, isSelected && { backgroundColor: '#FA7E2B' }]} />
                            <Text style={[styles.switcherChipText, isSelected && styles.switcherChipTextActive]}>
                              #{refSnippet}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {(() => {
                  const mission = activeMissions[activeMissionIdx] || activeMissions[0];
                  const stageInfo = getMissionStageInfo(mission.status);
                  const orderSnippet = String(mission.order_id || mission.id || '').slice(-8).toUpperCase();
                  const pickup = getPickupAddress(mission);
                  const dropoff = getDeliveryAddress(mission);

                  return (
                    <TouchableOpacity
                      style={styles.compactDeliveryCard}
                      onPress={() => handleOpenHomeMission(mission)}
                      activeOpacity={0.92}
                    >
                      {/* Card Header */}
                      <View style={styles.compactCardHeader}>
                        <View style={[styles.compactStatusPill, { backgroundColor: stageInfo.badgeBg }]}>
                          <View style={[styles.pulseDotSmall, { backgroundColor: stageInfo.badgeText }]} />
                          <Text style={[styles.compactStatusText, { color: stageInfo.badgeText }]}>
                            {stageInfo.label.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.trackingRefPill}>
                          <Text style={styles.trackingRefText}>#{orderSnippet}</Text>
                        </View>
                      </View>

                      {/* Route Path Snippet */}
                      <View style={styles.compactRouteContainer}>
                        <View style={styles.compactRouteRow}>
                          <MapPin size={14} color="#EA580C" strokeWidth={2.5} />
                          <Text style={styles.compactRouteText} numberOfLines={1}>
                            <Text style={styles.routeBold}>Pickup: </Text>{pickup}
                          </Text>
                        </View>
                        <View style={styles.compactRouteRow}>
                          <NavIcon size={14} color="#16A34A" strokeWidth={2.5} />
                          <Text style={styles.compactRouteText} numberOfLines={1}>
                            <Text style={[styles.routeBold, { color: '#16A34A' }]}>Drop-off: </Text>{dropoff}
                          </Text>
                        </View>
                      </View>

                      {/* Milestone Progress Bar with Truck Icon */}
                      <View style={styles.trackContainer}>
                        <View style={styles.trackLineBg}>
                          <View
                            style={[
                              styles.trackLineFill,
                              {
                                width:
                                  stageInfo.step === 1 ? '16%' :
                                  stageInfo.step === 2 ? '50%' :
                                  stageInfo.step === 3 ? '83%' : '100%',
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.trackNodesRow}>
                          <View style={styles.trackNodeCol}>
                            <View style={[styles.trackNodeCircle, stageInfo.step >= 1 && styles.trackNodeCircleDone]}>
                              <Check size={10} color={stageInfo.step >= 1 ? '#FFFFFF' : '#94A3B8'} strokeWidth={3} />
                            </View>
                            <Text style={[styles.trackNodeText, stageInfo.step >= 1 && styles.trackNodeTextActive]}>
                              Assigned
                            </Text>
                          </View>

                          <View style={styles.trackNodeCol}>
                            <View style={[styles.trackNodeCircle, stageInfo.step >= 2 && styles.trackNodeCircleDone]}>
                              {stageInfo.step > 2 ? (
                                <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              ) : stageInfo.step === 2 ? (
                                <Truck size={12} color="#FFFFFF" strokeWidth={2.5} />
                              ) : (
                                <View style={styles.trackNodeDotPending} />
                              )}
                            </View>
                            <Text style={[styles.trackNodeText, stageInfo.step >= 2 && styles.trackNodeTextActive]}>
                              Picked Up
                            </Text>
                          </View>

                          <View style={styles.trackNodeCol}>
                            <View style={[styles.trackNodeCircle, stageInfo.step >= 3 && styles.trackNodeCircleDone]}>
                              {stageInfo.step > 3 ? (
                                <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              ) : stageInfo.step === 3 ? (
                                <Truck size={12} color="#FFFFFF" strokeWidth={2.5} />
                              ) : (
                                <View style={styles.trackNodeDotPending} />
                              )}
                            </View>
                            <Text style={[styles.trackNodeText, stageInfo.step >= 3 && styles.trackNodeTextActive]}>
                              In Transit
                            </Text>
                          </View>

                          <View style={styles.trackNodeCol}>
                            <View style={[styles.trackNodeCircle, stageInfo.step >= 4 && styles.trackNodeCircleDone]}>
                              {stageInfo.step >= 4 ? (
                                <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              ) : (
                                <CheckCircle2 size={12} color="#94A3B8" strokeWidth={2} />
                              )}
                            </View>
                            <Text style={[styles.trackNodeText, stageInfo.step >= 4 && styles.trackNodeTextActive]}>
                              Delivered
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Card Footer */}
                      <View style={styles.compactCardFooter}>
                        <View>
                          <View style={styles.payoutEscrowRow}>
                            <AnimatedCounter
                              value={mission.rider_earnings || 0}
                              duration={1000}
                              prefix="₦"
                              style={styles.compactPayoutValue}
                            />
                            <View style={styles.compactEscrowBadge}>
                              <ShieldCheck size={11} color="#059669" strokeWidth={2.5} />
                              <Text style={styles.compactEscrowBadgeText}>ESCROW SAFE</Text>
                            </View>
                          </View>
                          <Text style={styles.compactPayoutSub}>Guaranteed upon customer confirmation</Text>
                        </View>

                        <View style={styles.openControlPill}>
                          <Text style={styles.openControlText}>Manage</Text>
                          <View style={styles.openControlArrowWrap}>
                            <ArrowUpRight size={13} color="#FFFFFF" strokeWidth={2.8} />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            ) : (
              /* Clean Radar Standby Card */
              <View style={styles.radarStateCard}>
                <View
                  style={[
                    styles.radarIconWrap,
                    { backgroundColor: isOnline ? '#ECFDF5' : '#F1F5F9' },
                  ]}
                >
                  <Radio size={22} color={isOnline ? '#059669' : '#94A3B8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.radarTitle}>
                    {isOnline ? 'Radar Active & Ready' : 'Courier Offline'}
                  </Text>
                  <Text style={styles.radarSubtitle}>
                    {isOnline
                      ? 'No deliveries currently in transit. You will be alerted instantly when new orders drop.'
                      : 'Switch online at the top to receive instant mission dispatch alerts.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.radarCtaBtn, !isOnline && { backgroundColor: '#10B981' }]}
                  onPress={() => {
                    if (!isOnline) {
                      handleToggleOnline(true);
                    } else {
                      handleTabSwitch('orders');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.radarCtaBtnText}>
                    {isOnline ? `Available (${availableMissionCount})` : 'Go Online'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quick Performance Summary Hub */}
            <View style={styles.quickHubRow}>
              <TouchableOpacity
                style={styles.quickHubCard}
                onPress={() => handleTabSwitch('orders')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickHubIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Package size={16} color="#2563EB" strokeWidth={2.5} />
                </View>
                <Text style={styles.quickHubValue}>{availableMissionCount}</Text>
                <Text style={styles.quickHubLabel}>Available</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickHubCard}
                onPress={() => handleTabSwitch('earnings')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickHubIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <CheckCircle2 size={16} color="#059669" strokeWidth={2.5} />
                </View>
                <Text style={styles.quickHubValue}>{completedMissionCount}</Text>
                <Text style={styles.quickHubLabel}>Delivered</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickHubCard}
                onPress={() => handleTabSwitch('verification')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.quickHubIconWrap,
                    {
                      backgroundColor:
                        kycStatus === 'verified'
                          ? '#ECFDF5'
                          : kycStatus === 'pending'
                          ? '#FFFBEB'
                          : '#FEF2F2',
                    },
                  ]}
                >
                  <ShieldCheck
                    size={16}
                    color={
                      kycStatus === 'verified'
                        ? '#059669'
                        : kycStatus === 'pending'
                        ? '#D97706'
                        : '#DC2626'
                    }
                    strokeWidth={2.5}
                  />
                </View>
                <Text
                  style={[
                    styles.quickHubValue,
                    { fontSize: 13, textTransform: 'capitalize' },
                  ]}
                >
                  {kycStatus === 'verified' ? 'Verified' : kycStatus === 'pending' ? 'In Review' : 'Verify'}
                </Text>
                <Text style={styles.quickHubLabel}>Rider ID</Text>
              </TouchableOpacity>
            </View>

            {/* Jump to Missions Feed Banner */}
            <TouchableOpacity
              style={styles.feedJumpBanner}
              onPress={() => handleTabSwitch('orders')}
              activeOpacity={0.85}
            >
              <View style={styles.feedJumpLeft}>
                <View style={styles.feedJumpIconWrap}>
                  <TrendingUp size={18} color="#FA7E2B" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedJumpTitle}>Missions Dispatch Center</Text>
                  <Text style={styles.feedJumpSub}>
                    {availableMissionCount > 0
                      ? `${availableMissionCount} new orders waiting for pickup in your zone`
                      : 'View full shipment history, maps & order filters'}
                  </Text>
                </View>
              </View>
              <View style={styles.feedJumpArrowWrap}>
                <ChevronRight size={16} color="#FA7E2B" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            {/* Bottom spacer for floating bottom navigation bar */}
            <View style={{ height: 110 }} />
          </ScrollView>
        )}

        {activeTab === 'orders' && (
          <View style={{ flex: 1 }}>
            <ShipmentFeedV2
              defaultFilter="all"
              isOnline={isOnline}
              onToggleOnline={handleToggleOnline}
              onSwitchTab={handleTabSwitch}
              onScroll={handleScroll}
            />
          </View>
        )}

        {activeTab === 'earnings' && <LogisticsEarningsTabV2 onScroll={handleScroll} />}

        {activeTab === 'verification' && (
          <LogisticsKYCTabV2
            onScroll={handleScroll}
            onVerificationUpdated={fetchRiderOverview}
          />
        )}

        {activeTab === 'settings' && (
          <LogisticsSettingsTabV2
            onScroll={handleScroll}
            onSettingsUpdated={fetchRiderOverview}
          />
        )}
      </Animated.View>

      {/* 4. Glass Floating Bottom Navigation Bar with curvy edges (#FA7E2B) & Smooth Scrolling Effects */}
      <Animated.View
        style={[
          styles.bottomTabBarWrapper,
          { transform: [{ translateY: navTranslateY }] },
        ]}
      >
        <View
          style={styles.bottomTabBar}
          onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
        >
          {/* Smooth Sliding Active Glass Pill with Spring Physics */}
          <Animated.View
            style={[
              styles.slidingActivePill,
              {
                width: singleTabWidth,
                transform: [{ translateX: tabIndicatorX }],
              },
            ]}
          >
            {/* Top Indicator Line */}
            <View style={styles.activeIndicatorLine} />
          </Animated.View>

          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComp = tab.icon;
            const scaleAnim = iconScales[tab.id];

            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabButton}
                onPress={() => handleTabSwitch(tab.id)}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.tabIconWrapper,
                    { transform: [{ scale: scaleAnim }] },
                  ]}
                >
                  <IconComp
                    size={20}
                    color={isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
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
                </Animated.View>
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
      </Animated.View>

      {/* Polished Framer Motion Spring Modal for Home Tab Mission Management */}
      <MissionDetailsModalV2
        visible={homeModalVisible}
        onClose={() => setHomeModalVisible(false)}
        shipment={selectedHomeMission}
        onMissionUpdated={() => {
          fetchRiderOverview();
        }}
        userId={user?.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#FA7E2B',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  headerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarImageSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FA7E2B',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // Profile Hero Top Banner Styles
  profileHeroWrapper: {
    paddingTop: 2,
  },
  profileHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  profileHeroAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  profileHeroAvatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  profileHeroAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  profileHeroAvatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FA7E2B',
  },
  avatarOnlineDotLarge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#FA7E2B',
  },
  profileHeroTextCol: {
    flex: 1,
    marginRight: 8,
  },
  profileHeroName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  profileHeroPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 1,
  },
  profileHeroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  profileGlassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  profileVerifiedGlassBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.32)',
    borderColor: 'rgba(16, 185, 129, 0.65)',
  },
  profileGlassBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  profileTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  driverRole: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 1,
  },

  // Online / Offline Quick Toggle Pill inside #FA7E2B card
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 2,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  onlinePillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  onlinePillInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  onlineIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  onlineTextActive: {
    color: '#FFFFFF',
  },
  onlineTextInactive: {
    color: 'rgba(255, 255, 255, 0.75)',
  },

  // KYC Notice Banner
  kycNoticeBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: '#FFF7F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycNoticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycNoticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9A3412',
  },
  kycNoticeSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C2410C',
    marginTop: 1,
    lineHeight: 14,
  },
  kycNoticeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
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

  // 3 Consistent Financial & Operational Cards inside #FA7E2B card
  statsThreeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardSubLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.4,
  },
  statCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  statCardValueGreen: {
    fontSize: 14,
    fontWeight: '900',
    color: '#059669',
  },
  statCardValueAmber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D97706',
  },
  statCardValueBlue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2563EB',
  },
  statCardValueDark: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },

  // Active Deliveries Priority Banner
  activeDeliveriesPriorityBanner: {
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  priorityBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priorityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  priorityBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E40AF',
    letterSpacing: 0.5,
  },
  priorityActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityActionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  priorityBannerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3B82F6',
    lineHeight: 15,
  },

  homeScrollContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  liveDeliverySection: {
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  missionSwitcherRow: {
    marginBottom: 10,
    gap: 8,
  },
  missionSwitcherCount: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  switcherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  switcherChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FA7E2B',
  },
  switcherChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  switcherChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  switcherChipTextActive: {
    color: '#EA580C',
    fontWeight: '900',
  },

  // Compact Delivery Card (Reference Image 2 inspired)
  compactDeliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compactStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trackingRefPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trackingRefText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  compactRouteContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    gap: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  compactRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactRouteText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  routeBold: {
    fontWeight: '800',
    color: '#0F172A',
  },

  // Milestone Progress Bar with Truck Icon
  trackContainer: {
    position: 'relative',
    marginVertical: 4,
    paddingVertical: 4,
  },
  trackLineBg: {
    position: 'absolute',
    top: 14,
    left: '12%',
    right: '12%',
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
    zIndex: 1,
  },
  trackLineFill: {
    height: '100%',
    backgroundColor: '#FA7E2B',
    borderRadius: 1.5,
  },
  trackNodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  trackNodeCol: {
    alignItems: 'center',
    width: 64,
  },
  trackNodeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trackNodeCircleDone: {
    backgroundColor: '#FA7E2B',
    borderColor: '#FA7E2B',
  },
  trackNodeDotPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  trackNodeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  trackNodeTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },

  // Compact Card Footer
  compactCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  payoutEscrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPayoutValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  compactEscrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compactEscrowBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.3,
  },
  compactPayoutSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },
  openControlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FA7E2B',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  openControlText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  openControlArrowWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick Performance Hub Row
  quickHubRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 12,
  },
  quickHubCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  quickHubIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickHubValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  quickHubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },

  // Jump to Feed Banner
  feedJumpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  feedJumpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  feedJumpIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedJumpTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  feedJumpSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  feedJumpArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Radar scanning state card
  radarStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  radarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  radarSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
    lineHeight: 13,
  },
  radarCtaBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  radarCtaBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Curvy Floating Glass Navigator (#FA7E2B)
  bottomTabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
    zIndex: 99,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FA7E2B',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 7,
    paddingHorizontal: 6,
    position: 'relative',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 8,
  },
  slidingActivePill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: 'rgba(0, 0, 0, 0.14)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 3,
    minHeight: 50,
    zIndex: 2,
  },
  activeIndicatorLine: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  tabIconWrapper: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
  },
  tabIconWrapperActive: {
    backgroundColor: 'transparent',
  },
  tabBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FA7E2B',
  },
  tabBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FA7E2B',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tabLabelInactive: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontWeight: '700',
  },
});
