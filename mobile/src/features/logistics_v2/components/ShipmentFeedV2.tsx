import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { ShipmentCardV2 } from './ShipmentCardV2';
import { MissionDetailsModalV2 } from './MissionDetailsModalV2';
import { calculateRiderEarnings } from '../utils/logistics-utils';

interface ShipmentFeedV2Props {
  defaultFilter?: 'all' | 'pending' | 'active' | 'delivered';
}

export function ShipmentFeedV2({ defaultFilter = 'all' }: ShipmentFeedV2Props) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(defaultFilter);
  const [shipments, setShipments] = useState<any[]>([]);

  useEffect(() => {
    setFilterStatus(defaultFilter);
  }, [defaultFilter]);
  const [walletTotal, setWalletTotal] = useState<number>(0);
  const [escrowTotal, setEscrowTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const statusFilters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Active', value: 'active' },
    { label: 'Delivered', value: 'delivered' },
  ];

  const fetchShipments = useCallback(async () => {
    if (!user) return;
    try {
      // Fee config
      let riderPayoutRate = 0.80;
      let riderMinPayout = 1000;
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
            } else if (fc.fee_type === 'send_rider_min_payout' && Number(fc.flat_fee) > 0) {
              riderMinPayout = Number(fc.flat_fee);
            }
          }
        }
      } catch (err) {
        console.warn('[ShipmentFeedV2] fee_config error:', err);
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

      // 2. Fetch My Active Assignments
      let myAssignmentsQuery = (supabase as any)
        .from('shipments')
        .select(`
          *,
          order:orders (
            *,
            order_recipient (*)
          )
        `)
        .eq('rider_id', user.id);

      if (filterStatus !== 'all') {
        if (filterStatus === 'active') {
          myAssignmentsQuery = myAssignmentsQuery.in('status', ['assigned', 'picked_up', 'in_transit']);
        } else if (filterStatus === 'pending') {
          myAssignmentsQuery = myAssignmentsQuery.eq('status', 'assigned');
        } else {
          myAssignmentsQuery = myAssignmentsQuery.eq('status', filterStatus);
        }
      }

      const { data: myDataRaw } = await myAssignmentsQuery;

      const myData = (myDataRaw || []).map((s: any) => ({
        ...s,
        rider_earnings: calculateRiderEarnings(s, {
          payoutRate: riderPayoutRate,
          minPayout: riderMinPayout,
        }),
      }));

      // 3. Fetch Broadcast Unassigned Missions (from Orders and Shipments)
      let broadcastData: any[] = [];
      if (filterStatus === 'all' || filterStatus === 'pending') {
        let orderMissions: any[] = [];
        const { data: oData, error: orderMissionsError } = await (supabase as any)
          .from('orders')
          .select(`
            *,
            order_recipient (*),
            shipments (*)
          `)
          .eq('status', 'awaiting_agent')
          .order('created_at', { ascending: false });

        if (orderMissionsError) {
          console.warn('[ShipmentFeedV2] orderMissions error:', orderMissionsError);
        } else if (oData) {
          orderMissions = oData;
        }

        // Fetch seller details for these orders without relying on fragile PostgREST foreign key hints
        const sellerIds = Array.from(
          new Set(orderMissions.map((o: any) => o.seller_id).filter(Boolean))
        );
        let sellerMap = new Map();
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase
            .from('profiles')
            .select('id, display_name, phone, address, avatar_url')
            .in('id', sellerIds);
          if (sellers) {
            sellerMap = new Map(sellers.map((s) => [s.id, s]));
          }
        }

        if (orderMissions && orderMissions.length > 0) {
          broadcastData = orderMissions.map((o: any) => {
            const shipment = o.shipments?.[0];
            const earnings = calculateRiderEarnings(shipment || o, {
              payoutRate: riderPayoutRate,
              minPayout: riderMinPayout,
            });
            const recipient = Array.isArray(o.order_recipient)
              ? o.order_recipient[0]
              : o.order_recipient;
            const sellerProf = sellerMap.get(o.seller_id) || {};

            return {
              ...(shipment || {}),
              id: shipment?.id || o.id,
              order_id: o.id,
              status: shipment?.status || 'awaiting_agent',
              order: o,
              seller: sellerProf,
              buyer: recipient || {},
              pickup_address:
                shipment?.pickup_address ||
                o.pickup_address ||
                sellerProf.address ||
                'Merchant Store / Pickup',
              delivery_address:
                shipment?.delivery_address ||
                recipient?.address_line ||
                o.delivery_address ||
                'Customer Delivery Point',
              delivery_fee: shipment?.delivery_fee || o.shipping_fee || 1500,
              rider_earnings: earnings,
            };
          });
        }

        // Also query pending unassigned shipments directly (guarantees coverage if order status differs)
        try {
          const { data: pendingShipments, error: pendingShipmentsError } = await (supabase as any)
            .from('shipments')
            .select(`
              *,
              order:orders (
                *,
                order_recipient (*)
              )
            `)
            .is('rider_id', null)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (!pendingShipmentsError && pendingShipments && pendingShipments.length > 0) {
            const directMissions = pendingShipments
              .filter(
                (s: any) =>
                  !broadcastData.some(
                    (b: any) => b.order_id === s.order_id || b.id === s.id
                  )
              )
              .map((s: any) => {
                const o = s.order || {};
                const earnings = calculateRiderEarnings(s, {
                  payoutRate: riderPayoutRate,
                  minPayout: riderMinPayout,
                });
                const recipient = Array.isArray(o.order_recipient)
                  ? o.order_recipient[0]
                  : o.order_recipient;
                const sellerProf = sellerMap.get(s.seller_id || o.seller_id) || s.seller || {};
                return {
                  ...s,
                  id: s.id,
                  order_id: s.order_id || o.id,
                  status: s.status || 'pending',
                  order: o,
                  seller: sellerProf,
                  buyer: recipient || s.buyer || {},
                  pickup_address:
                    s.pickup_address ||
                    sellerProf.address ||
                    'Merchant Store / Pickup',
                  delivery_address:
                    s.delivery_address ||
                    recipient?.address_line ||
                    'Customer Delivery Point',
                  delivery_fee: s.delivery_fee || o.shipping_fee || 1500,
                  rider_earnings: earnings,
                };
              });
            broadcastData.push(...directMissions);
          }
        } catch (directShipErr) {
          console.warn('[ShipmentFeedV2] direct pending shipments error:', directShipErr);
        }

        // Unassigned SEND Package Orders
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
      }

      // 4. Assigned SEND packages
      let mySendAssignments: any[] = [];
      try {
        let sendQuery = (supabase as any)
          .from('send_orders')
          .select('*')
          .eq('rider_id', user.id);

        if (filterStatus === 'active') {
          sendQuery = sendQuery.in('status', ['assigned_rider', 'pickup', 'on_the_way']);
        } else if (filterStatus === 'delivered') {
          sendQuery = sendQuery.eq('status', 'delivered');
        }

        const { data: assignedSend } = await sendQuery;
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
    } catch (err) {
      console.error('[ShipmentFeedV2] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filterStatus]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Real-time listener
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`rider-feed-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchShipments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'send_orders' }, () => {
        fetchShipments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchShipments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchShipments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShipments();
  };

  const filteredShipments = shipments.filter((s: any) => {
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

  const activeCount = shipments.filter(
    (s: any) => s.status !== 'delivered' && s.status !== 'completed'
  ).length;

  return (
    <View style={styles.container}>
      {/* Search Bar - Keyboard safe */}
      <View style={styles.searchBarWrap}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Mission Ref or Address..."
          placeholderTextColor="#94a3b8"
          value={searchTerm}
          onChangeText={setSearchTerm}
          clearButtonMode="while-editing"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm('')} activeOpacity={0.7}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Horizontal Status Filter Pills */}
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Quick Stats Banners (Mobile) */}
      <View style={styles.statsRow}>
        <View style={styles.statMiniCard}>
          <View style={styles.statMiniHeader}>
            <Text style={styles.statMiniLabel}>READY PAYOUT</Text>
            <View style={[styles.statMiniIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <TrendingUp size={12} color="#059669" />
            </View>
          </View>
          <Text style={styles.statMiniValue}>
            ₦{walletTotal.toLocaleString('en-NG')}
          </Text>
        </View>

        <View style={styles.statMiniCard}>
          <View style={styles.statMiniHeader}>
            <Text style={styles.statMiniLabel}>SAFETY HOLD</Text>
            <View style={[styles.statMiniIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <Clock size={12} color="#D97706" />
            </View>
          </View>
          <Text style={[styles.statMiniValue, { color: '#B45309' }]}>
            ₦{escrowTotal.toLocaleString('en-NG')}
          </Text>
        </View>

        <View style={styles.statMiniCard}>
          <View style={styles.statMiniHeader}>
            <Text style={styles.statMiniLabel}>ACTIVE JOBS</Text>
            <View style={[styles.statMiniIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Package size={12} color="#2563EB" />
            </View>
          </View>
          <Text style={styles.statMiniValue}>{activeCount}</Text>
        </View>
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              <PackageX size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Deliveries Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm
                  ? 'No missions match your search query.'
                  : 'Check back shortly or pull down to refresh available orders.'}
              </Text>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                activeOpacity={0.8}
              >
                <RefreshCw size={14} color={colors.primary} />
                <Text style={styles.refreshBtnText}>Refresh Feed</Text>
              </TouchableOpacity>
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
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
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statMiniLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  statMiniIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statMiniValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.2,
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
    borderStyle: 'dashed',
    borderRadius: 24,
    padding: 32,
    marginVertical: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 8,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
});
