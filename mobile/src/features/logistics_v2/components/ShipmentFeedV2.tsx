import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Search,
  Filter,
  X,
  Package,
  TrendingUp,
  PackageX,
  RefreshCw,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { ShipmentCardV2 } from './ShipmentCardV2';
import { MissionDetailsModalV2 } from './MissionDetailsModalV2';
import { calculateRiderEarnings } from '../utils/logistics-utils';
import { logisticsCache } from '../../../services/logisticsCache';

interface ShipmentFeedV2Props {
  defaultFilter?: 'all' | 'pending' | 'active' | 'delivered';
  isOnline?: boolean;
  onToggleOnline?: (val: boolean) => void;
  onSwitchTab?: (tab: 'dashboard' | 'orders' | 'earnings' | 'verification' | 'settings') => void;
  onScroll?: (e: any) => void;
}

export function ShipmentFeedV2({
  defaultFilter = 'all',
  isOnline = true,
  onToggleOnline,
  onSwitchTab,
  onScroll,
}: ShipmentFeedV2Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(defaultFilter);
  const [shipments, setShipments] = useState<any[]>([]);
  const [walletTotal, setWalletTotal] = useState<number>(0);
  const [escrowTotal, setEscrowTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const fetchShipments = useCallback(async () => {
    if (!user) return;
    try {
      // Fee config from metadata cache or DB
      let riderPayoutRate = 0.80;
      let riderMinPayout = 0;
      const cachedMeta = await logisticsCache.getMetadata();
      if (cachedMeta?.data?.feeConfigs) {
        riderPayoutRate = cachedMeta.data.feeConfigs.riderPayoutRate || 0.80;
        riderMinPayout = cachedMeta.data.feeConfigs.riderMinPayout ?? 0;
      } else {
        try {
          const { data: feeConfigs } = await (supabase as any)
            .from('fee_config')
            .select('fee_type, rate, flat_fee')
            .in('fee_type', ['send_rider_payout_rate', 'send_rider_min_payout'])
            .eq('is_active', true);

          if (feeConfigs) {
            for (const fc of feeConfigs) {
              if (fc.fee_type === 'send_rider_payout_rate' && Number(fc.rate) > 0) {
                riderPayoutRate = Number(fc.rate);
              } else if (fc.fee_type === 'send_rider_min_payout') {
                riderMinPayout = Number(fc.flat_fee || 0);
              }
            }
            logisticsCache.setMetadata({
              cities: cachedMeta?.data?.cities || [],
              zones: cachedMeta?.data?.zones || [],
              feeConfigs: { riderPayoutRate, riderMinPayout },
            });
          }
        } catch (err) {
          console.warn('[ShipmentFeedV2] fee_config error:', err);
        }
      }

      // 1. Fetch wallet total
      const { data: wData } = await (supabase as any)
        .from('wallets')
        .select('balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (wData) {
        setWalletTotal(wData.balance || 0);
        setEscrowTotal(wData.escrow_balance || 0);
      }

      // 2. Fetch All Assigned Marketplace Shipments for this Rider
      const { data: myDataRaw } = await (supabase as any)
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
        .eq('rider_id', user.id);

      const myData = (myDataRaw || []).map((s: any) => ({
        ...s,
        rider_earnings: calculateRiderEarnings(s, {
          payoutRate: riderPayoutRate,
          minPayout: riderMinPayout,
        }),
      }));

      // 3. Fetch Broadcast Unassigned Marketplace Missions
      let broadcastData: any[] = [];
      const { data: orderMissions } = await (supabase as any)
        .from('orders')
        .select(`
          *,
          order_recipient (*),
          buyer:profiles!buyer_id (*),
          seller:profiles!seller_id (*),
          shipments (*)
        `)
        .eq('status', 'awaiting_agent')
        .order('created_at', { ascending: false });

      if (orderMissions) {
        broadcastData = orderMissions.map((o: any) => {
          const shipment = o.shipments?.[0];
          const earnings = calculateRiderEarnings(shipment || o, {
            payoutRate: riderPayoutRate,
            minPayout: riderMinPayout,
          });
          return {
            ...(shipment || {}),
            id: shipment?.id || o.id,
            order_id: o.id,
            order: o,
            seller: o.seller,
            buyer: o.buyer,
            pickup_address: shipment?.pickup_address || o.seller?.address,
            delivery_address:
              shipment?.delivery_address ||
              o.order_recipient?.[0]?.address_line ||
              o.buyer?.address,
            rider_earnings: earnings,
          };
        });
      }

      // 4. Fetch Unassigned Broadcast SEND Packages
      try {
        const { data: sendOrders } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .eq('status', 'finding_rider')
          .order('created_at', { ascending: false });

        if (sendOrders && sendOrders.length > 0) {
          const sendMissions = sendOrders.map((s: any) => {
            const earnings = calculateRiderEarnings(
              { ...s, is_send_order: true },
              { payoutRate: riderPayoutRate, minPayout: riderMinPayout }
            );
            return {
              id: s.id,
              order_id: s.id,
              is_send_order: true,
              status: 'pending',
              pickup_address: s.pickup_address,
              pickup_address_text: s.pickup_address,
              pickup_directions: s.pickup_directions,
              delivery_address: s.dropoff_address,
              delivery_address_text: s.dropoff_address,
              dropoff_address: s.dropoff_address,
              pickup_lat: s.pickup_lat,
              pickup_lng: s.pickup_lng,
              delivery_lat: s.dropoff_lat,
              delivery_lng: s.dropoff_lng,
              dropoff_lat: s.dropoff_lat,
              dropoff_lng: s.dropoff_lng,
              dropoff_directions: s.dropoff_directions,
              delivery_fee: s.delivery_fee,
              rider_earnings: earnings,
              created_at: s.created_at,
              sender_name: s.sender_name,
              sender_phone: s.sender_phone,
              recipient_name: s.dropoff_recipient_name,
              recipient_phone: s.dropoff_recipient_phone,
              seller: { name: s.sender_name, phone: s.sender_phone, address: s.pickup_address },
              buyer: { name: s.dropoff_recipient_name, phone: s.dropoff_recipient_phone, address: s.dropoff_address },
              package_details: s.package_details,
            };
          });
          broadcastData.push(...sendMissions);
        }
      } catch (sendErr) {
        console.warn('[ShipmentFeedV2] send_orders broadcast error:', sendErr);
      }

      // 5. Fetch All Assigned SEND Packages for this Rider
      let mySendAssignments: any[] = [];
      try {
        const { data: assignedSend } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .eq('rider_id', user.id);

        if (assignedSend && assignedSend.length > 0) {
          mySendAssignments = assignedSend.map((s: any) => {
            const earnings = calculateRiderEarnings(
              { ...s, is_send_order: true },
              { payoutRate: riderPayoutRate, minPayout: riderMinPayout }
            );
            return {
              id: s.id,
              order_id: s.id,
              is_send_order: true,
              rider_id: s.rider_id,
              status:
                s.status === 'assigned_rider'
                  ? 'assigned'
                  : s.status === 'pickup'
                  ? 'picked_up'
                  : s.status === 'on_the_way'
                  ? 'in_transit'
                  : s.status,
              pickup_address: s.pickup_address,
              pickup_address_text: s.pickup_address,
              pickup_directions: s.pickup_directions,
              delivery_address: s.dropoff_address,
              delivery_address_text: s.dropoff_address,
              dropoff_address: s.dropoff_address,
              pickup_lat: s.pickup_lat,
              pickup_lng: s.pickup_lng,
              delivery_lat: s.dropoff_lat,
              delivery_lng: s.dropoff_lng,
              dropoff_lat: s.dropoff_lat,
              dropoff_lng: s.dropoff_lng,
              dropoff_directions: s.dropoff_directions,
              delivery_fee: s.delivery_fee,
              rider_earnings: earnings,
              created_at: s.created_at,
              sender_name: s.sender_name,
              sender_phone: s.sender_phone,
              recipient_name: s.dropoff_recipient_name,
              recipient_phone: s.dropoff_recipient_phone,
              seller: { name: s.sender_name, phone: s.sender_phone, address: s.pickup_address },
              buyer: { name: s.dropoff_recipient_name, phone: s.dropoff_recipient_phone, address: s.dropoff_address },
              package_details: s.package_details,
            };
          });
        }
      } catch (err) {
        console.warn('[ShipmentFeedV2] assigned send error:', err);
      }

      const combined = [...(myData || []), ...mySendAssignments, ...broadcastData];
      combined.sort(
        (a: any, b: any) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setShipments(combined);

      // Save to feed cache
      logisticsCache.setFeed(user.id, {
        myAssignedShipments: myData || [],
        broadcastMarketplace: broadcastData || [],
        broadcastSendOrders: mySendAssignments || [],
      });
    } catch (err) {
      console.error('[ShipmentFeedV2] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Debounced fetch for rapid realtime Postgres updates
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchShipments = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchShipments();
    }, 500);
  }, [fetchShipments]);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    // SWR Cache Fast-Path: restore cached feed in 0ms!
    logisticsCache.getFeed(user.id).then((cached) => {
      if (!isMounted || !cached?.data) {
        fetchShipments();
        return;
      }

      const { data, isStale } = cached;
      const combined = [
        ...(data.myAssignedShipments || []),
        ...(data.broadcastSendOrders || []),
        ...(data.broadcastMarketplace || []),
      ];
      combined.sort(
        (a: any, b: any) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setShipments(combined);
      setLoading(false);

      if (isStale) {
        fetchShipments();
      }
    });

    // Real-time listener with debouncing
    const channel = supabase
      .channel(`rider-feed-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        debouncedFetchShipments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'send_orders' }, () => {
        debouncedFetchShipments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        debouncedFetchShipments();
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchShipments, debouncedFetchShipments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShipments();
  };

  // Accurate Status Bucket Counts across all loaded missions
  const allCount = shipments.length;
  const activeCount = shipments.filter((s: any) =>
    ['assigned', 'picked_up', 'in_transit', 'assigned_rider', 'pickup', 'on_the_way'].includes(s.status) &&
    (s.rider_id === user?.id || s.driver_id === user?.id)
  ).length;
  const pendingCount = shipments.filter((s: any) =>
    !s.rider_id ||
    ['pending', 'finding_rider', 'awaiting_agent', 'ready_for_pickup'].includes(s.status)
  ).length;
  const deliveredCount = shipments.filter((s: any) =>
    ['delivered', 'completed'].includes(s.status)
  ).length;

  const statusFilters = [
    { label: 'All', value: 'all', count: allCount },
    { label: 'Active', value: 'active', count: activeCount },
    { label: 'Available', value: 'pending', count: pendingCount },
    { label: 'Delivered', value: 'delivered', count: deliveredCount },
  ];

  // Client-side Filtered Shipments: filters instantly without network roundtrip
  const filteredShipments = shipments.filter((s: any) => {
    if (filterStatus === 'active') {
      const isAct =
        ['assigned', 'picked_up', 'in_transit', 'assigned_rider', 'pickup', 'on_the_way'].includes(s.status) &&
        (s.rider_id === user?.id || s.driver_id === user?.id);
      if (!isAct) return false;
    } else if (filterStatus === 'pending') {
      const isPend =
        !s.rider_id ||
        ['pending', 'finding_rider', 'awaiting_agent', 'ready_for_pickup'].includes(s.status);
      if (!isPend) return false;
    } else if (filterStatus === 'delivered') {
      const isDeliv = ['delivered', 'completed'].includes(s.status);
      if (!isDeliv) return false;
    }

    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      String(s.id || '').toLowerCase().includes(q) ||
      String(s.order_id || '').toLowerCase().includes(q) ||
      String(s.pickup_address || '').toLowerCase().includes(q) ||
      String(s.delivery_address || '').toLowerCase().includes(q) ||
      String(s.sender_name || s.seller?.name || '').toLowerCase().includes(q) ||
      String(s.recipient_name || s.buyer?.name || '').toLowerCase().includes(q)
    );
  });

  // Safe bottom padding ensuring fixed bottom navigation never overlaps the last card
  const listBottomPadding = Math.max(insets.bottom, 16) + 85;

  return (
    <View style={styles.container}>
      {/* Prominent Search Bar */}
      <View style={styles.searchBarWrap}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference, recipient, or address..."
          placeholderTextColor="#94a3b8"
          value={searchTerm}
          onChangeText={setSearchTerm}
          clearButtonMode="while-editing"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Compact Horizontally Aligned Status Filter Pills */}
      <View style={styles.filterPillsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          keyboardShouldPersistTaps="handled"
        >
          {statusFilters.map((f) => {
            const isActive = filterStatus === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterStatus(f.value);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <View
                    style={[
                      styles.filterPillBadge,
                      isActive && styles.filterPillBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillBadgeText,
                        isActive && styles.filterPillBadgeTextActive,
                      ]}
                    >
                      {f.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Shipments */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching available missions...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredShipments}
          keyExtractor={(item) => String(item.id || item.order_id)}
          renderItem={({ item }) => (
            <ShipmentCardV2
              shipment={item}
              userId={user?.id}
              onPress={() => {
                setSelectedShipment(item);
                setDetailsModalVisible(true);
              }}
              onMissionUpdated={fetchShipments}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {!isOnline ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: '#F1F5F9' }]}>
                    <Radio size={32} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>You're Currently Offline</Text>
                  <Text style={styles.emptySubtitle}>
                    Switch your radar to Online to view available missions and receive instant order alerts.
                  </Text>
                  {onToggleOnline && (
                    <TouchableOpacity
                      style={[styles.emptyActionBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onToggleOnline(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Radio size={14} color="#FFFFFF" />
                      <Text style={styles.emptyActionBtnText}>Go Online Now</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : searchTerm ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <Search size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No Missions Found</Text>
                  <Text style={styles.emptySubtitle}>
                    No deliveries match "{searchTerm}". Try a different reference ID or address.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setSearchTerm('')}
                    activeOpacity={0.8}
                  >
                    <X size={14} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Clear Search</Text>
                  </TouchableOpacity>
                </>
              ) : filterStatus === 'active' ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Package size={32} color="#2563EB" />
                  </View>
                  <Text style={styles.emptyTitle}>No Deliveries in Transit</Text>
                  <Text style={styles.emptySubtitle}>
                    You have no active deliveries in progress. Check available orders to claim your next mission.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilterStatus('pending');
                    }}
                    activeOpacity={0.8}
                  >
                    <Package size={14} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Browse Available Missions</Text>
                  </TouchableOpacity>
                </>
              ) : filterStatus === 'delivered' ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <CheckCircle2 size={32} color="#10B981" />
                  </View>
                  <Text style={styles.emptyTitle}>No Completed Deliveries Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Missions you finish will be listed here along with your escrow payouts and delivery logs.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilterStatus('all');
                    }}
                    activeOpacity={0.8}
                  >
                    <Package size={14} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Browse Missions</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <RefreshCw size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>Radar is Scanning...</Text>
                  <Text style={styles.emptySubtitle}>
                    No dispatch missions available in your zone right now. Pull down to refresh or stay online for instant alerts.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={onRefresh}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Refresh Feed</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      )}

      {/* Mission Control Modal */}
      <MissionDetailsModalV2
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        shipment={selectedShipment}
        userId={user?.id}
        onMissionUpdated={fetchShipments}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  filterPillsRow: {
    marginBottom: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  filterPillBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterPillBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
  },
  filterPillBadgeTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 24,
    padding: 28,
    marginVertical: 14,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
