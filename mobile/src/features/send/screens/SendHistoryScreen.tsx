import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  ArrowRight,
  Plus,
  Copy,
  Check,
  Search,
  RefreshCw,
  Wallet,
  ArrowLeft,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import * as Haptics from 'expo-haptics';

interface SendOrder {
  id: string;
  created_at: string;
  status: string;
  sender_name?: string;
  sender_phone?: string;
  pickup_address?: string;
  dropoff_recipient_name?: string;
  dropoff_phone?: string;
  dropoff_address?: string;
  package_details?: {
    contents?: string;
    weight_kg?: number;
    category?: string;
  };
  delivery_fee?: number;
  total_amount?: number;
  rider_name?: string;
  rider_phone?: string;
}

export function SendHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [orders, setOrders] = useState<SendOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSendHistory = useCallback(async () => {
    try {
      let remoteOrders: SendOrder[] = [];

      if (user) {
        const { data, error } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .or(`user_id.eq.${user.id},sender_phone.eq.${user.phone || 'none'}`)
          .order('created_at', { ascending: false });

        if (!error && data) {
          remoteOrders = data as SendOrder[];
        }
      }

      // Merge with locally stored AsyncStorage orders
      const localOrders: SendOrder[] = [];
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const sendKeys = allKeys.filter((k) => k.startsWith('linkup_send_order_'));
        if (sendKeys.length > 0) {
          const items = await AsyncStorage.multiGet(sendKeys);
          for (const [_, val] of items) {
            if (val) {
              try {
                const parsed = JSON.parse(val);
                if (parsed?.id && !remoteOrders.some((ro) => ro.id === parsed.id)) {
                  localOrders.push(parsed);
                }
              } catch {}
            }
          }
        }
      } catch {}

      const merged = [...remoteOrders, ...localOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(merged);
    } catch (err: any) {
      console.warn('[SendHistoryScreen] Fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSendHistory();
  }, [fetchSendHistory]);

  // Realtime Postgres subscription
  useEffect(() => {
    const channel = supabase
      .channel('send_history_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders' },
        () => {
          fetchSendHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSendHistory]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchSendHistory();
  };

  const copyOrderId = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedId(id);
    toast.success(`Tracking ID ${id} copied!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'delivered':
        return (
          <View style={[styles.statusBadge, styles.statusDelivered]}>
            <Text style={[styles.statusText, styles.statusTextDelivered]}>
              Delivered 🎉
            </Text>
          </View>
        );
      case 'on_the_way':
      case 'in_transit':
        return (
          <View style={[styles.statusBadge, styles.statusOnTheWay]}>
            <Text style={[styles.statusText, styles.statusTextOnTheWay]}>
              On The Way 🛵
            </Text>
          </View>
        );
      case 'pickup':
      case 'assigned_rider':
        return (
          <View style={[styles.statusBadge, styles.statusPickup]}>
            <Text style={[styles.statusText, styles.statusTextPickup]}>
              Rider at Pickup 📦
            </Text>
          </View>
        );
      case 'finding_rider':
        return (
          <View style={[styles.statusBadge, styles.statusFinding]}>
            <Text style={[styles.statusText, styles.statusTextFinding]}>
              Finding Rider 📡
            </Text>
          </View>
        );
      case 'cancelled':
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <Text style={[styles.statusText, styles.statusTextCancelled]}>
              Cancelled
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, styles.statusPending]}>
            <Text style={[styles.statusText, styles.statusTextPending]}>
              Pending Payment
            </Text>
          </View>
        );
    }
  };

  // Filter calculations
  const activeCount = orders.filter(
    (o) => !['delivered', 'cancelled'].includes((o.status || '').toLowerCase())
  ).length;
  const deliveredCount = orders.filter(
    (o) => (o.status || '').toLowerCase() === 'delivered'
  ).length;
  const cancelledCount = orders.filter(
    (o) => (o.status || '').toLowerCase() === 'cancelled'
  ).length;

  const filteredOrders = orders.filter((order) => {
    const s = (order.status || '').toLowerCase();
    if (statusFilter === 'active') {
      if (['delivered', 'cancelled'].includes(s)) return false;
    } else if (statusFilter === 'delivered') {
      if (s !== 'delivered') return false;
    } else if (statusFilter === 'cancelled') {
      if (s !== 'cancelled') return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = order.id?.toLowerCase().includes(q);
      const matchSender = order.sender_name?.toLowerCase().includes(q);
      const matchRecipient = order.dropoff_recipient_name?.toLowerCase().includes(q);
      const matchPickup = order.pickup_address?.toLowerCase().includes(q);
      const matchDropoff = order.dropoff_address?.toLowerCase().includes(q);
      const matchContents = order.package_details?.contents?.toLowerCase().includes(q);
      return (
        matchId ||
        matchSender ||
        matchRecipient ||
        matchPickup ||
        matchDropoff ||
        matchContents
      );
    }
    return true;
  });

  const flatListRef = useRef<any>(null);

  return (
    <SafeView>
      {/* Top Header Row with Back Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Main Title & Subtitle */}
            <View style={styles.titleWrap}>
              <View style={styles.titleRow}>
                <View style={styles.iconCircle}>
                  <Package size={22} color={colors.primary} />
                </View>
                <Text style={styles.mainTitle}>Package Send History</Text>
              </View>
              <Text style={styles.subtitle}>
                View and track all packages you have sent with LinkUp Send
              </Text>
            </View>

            {/* Actions Row: Wallet, Refresh, + Send New Package */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.walletBtn}
                onPress={() => navigation.navigate('Wallet')}
                activeOpacity={0.8}
              >
                <Wallet size={14} color="#059669" />
                <Text style={styles.walletBtnText}>Wallet & Refunds</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                activeOpacity={0.8}
              >
                <RefreshCw
                  size={15}
                  color="#64748b"
                  style={refreshing ? { transform: [{ rotate: '45deg' }] } : {}}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendNewBtn}
                onPress={() =>
                  navigation.navigate('MainTabs', { screen: 'SendTab' })
                }
                activeOpacity={0.85}
              >
                <Plus size={15} color="#ffffff" />
                <Text style={styles.sendNewBtnText}>Send New Package</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchWrap}>
              <Search size={15} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by LSEND ID, recipient, address, or contents."
                placeholderTextColor="#94a3b8"
                value={searchTerm}
                onChangeText={setSearchTerm}
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  }, Platform.OS === 'ios' ? 70 : 120);
                }}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchTerm('')}
                  style={styles.clearBtn}
                >
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  statusFilter === 'all' && styles.filterPillActiveOrange,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStatusFilter('all');
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === 'all' && styles.filterPillTextActive,
                  ]}
                >
                  All Packages ({orders.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  statusFilter === 'active' && styles.filterPillActiveBlue,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStatusFilter('active');
                }}
              >
                <View
                  style={[
                    styles.dot,
                    statusFilter === 'active'
                      ? styles.dotActive
                      : styles.dotBlue,
                  ]}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === 'active' && styles.filterPillTextActive,
                  ]}
                >
                  In Progress ({activeCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  statusFilter === 'delivered' && styles.filterPillActiveGreen,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStatusFilter('delivered');
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === 'delivered' && styles.filterPillTextActive,
                  ]}
                >
                  Delivered ({deliveredCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  statusFilter === 'cancelled' && styles.filterPillActiveRed,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStatusFilter('cancelled');
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === 'cancelled' && styles.filterPillTextActive,
                  ]}
                >
                  Cancelled ({cancelledCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const formattedDate = new Date(item.created_at).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }
          );
          const price = item.delivery_fee || item.total_amount || 0;
          const contents = item.package_details?.contents || 'Package';

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('SendTracking', { orderId: item.id })
              }
            >
              {/* Card Top Row: Order ID + Copy Icon */}
              <View style={styles.cardTopRow}>
                <View style={styles.idGroup}>
                  <Text style={styles.orderIdText}>{item.id}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyOrderId(item.id)}
                    activeOpacity={0.7}
                  >
                    {copiedId === item.id ? (
                      <Check size={14} color="#16a34a" />
                    ) : (
                      <Copy size={14} color="#64748b" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time and Status Badge */}
              <View style={styles.metaRow}>
                <View style={styles.timeGroup}>
                  <Clock size={12} color="#94a3b8" />
                  <Text style={styles.timeText}>{formattedDate}</Text>
                </View>
                {renderStatusBadge(item.status)}
              </View>

              {/* Route Overview: Pickup & Dropoff */}
              <View style={styles.routeSection}>
                {/* Pickup Block (Light Peach/Orange) */}
                <View style={styles.pickupBlock}>
                  <View style={styles.routeHeaderRow}>
                    <MapPin size={11} color="#ea580c" />
                    <Text style={styles.pickupLabel}>
                      PICKUP (SENDER: {item.sender_name || 'YOU'})
                    </Text>
                  </View>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.pickup_address || 'Pickup location specified'}
                  </Text>
                </View>

                {/* Dropoff Block (Light Mint/Green) */}
                <View style={styles.dropoffBlock}>
                  <View style={styles.routeHeaderRow}>
                    <Navigation size={11} color="#16a34a" />
                    <Text style={styles.dropoffLabel}>
                      DROP-OFF (TO:{' '}
                      {item.dropoff_recipient_name || 'RECIPIENT'})
                    </Text>
                  </View>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.dropoff_address || 'Drop-off location specified'}
                  </Text>
                </View>
              </View>

              {/* Footer: Package Category, Amount, Live Tracking Action */}
              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <View style={styles.packageTag}>
                    <Package size={11} color="#64748b" />
                    <Text style={styles.packageTagText} numberOfLines={1}>
                      {contents}
                    </Text>
                  </View>
                  <Text style={styles.priceText}>
                    ₦{Math.round(price).toLocaleString('en-NG')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.trackingAction}
                  onPress={() =>
                    navigation.navigate('SendTracking', { orderId: item.id })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.trackingActionText}>Live Tracking</Text>
                  <ArrowRight size={13} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading your sent packages...</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Package size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchTerm ? 'No matching deliveries found' : 'No Packages Sent Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm
                  ? 'Try searching for another tracking number, name, or street name.'
                  : 'When you send parcels, documents, or items, you will be able to track every mission live from here.'}
              </Text>
              <TouchableOpacity
                style={styles.emptySendBtn}
                onPress={() => {
                  if (searchTerm) setSearchTerm('');
                  else navigation.navigate('MainTabs', { screen: 'SendTab' });
                }}
              >
                <Text style={styles.emptySendBtnText}>
                  {searchTerm ? 'Clear Search' : 'Send Your First Package 🚀'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  headerSection: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  titleWrap: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  walletBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendNewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  sendNewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    height: 42,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterPillActiveOrange: {
    backgroundColor: colors.primary,
  },
  filterPillActiveBlue: {
    backgroundColor: '#2563eb',
  },
  filterPillActiveGreen: {
    backgroundColor: '#059669',
  },
  filterPillActiveRed: {
    backgroundColor: '#dc2626',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotBlue: {
    backgroundColor: '#3b82f6',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  idGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  copyBtn: {
    padding: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPending: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  statusFinding: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  statusTextFinding: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
  statusPickup: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusTextPickup: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
  statusOnTheWay: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusTextOnTheWay: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },
  statusDelivered: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusTextDelivered: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  statusCancelled: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusTextCancelled: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  routeSection: {
    gap: 8,
    marginBottom: 12,
  },
  pickupBlock: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 12,
    padding: 10,
  },
  dropoffBlock: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 12,
    padding: 10,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  pickupLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.5,
  },
  dropoffLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 110,
  },
  packageTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  trackingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackingActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  emptySendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptySendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 8,
  },
});
