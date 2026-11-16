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
  PackageX,
  RefreshCw,
  ChevronDown,
  Check,
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

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
                  ) &&
                  ['awaiting_agent', 'broadcast'].includes(s.order?.status)
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

  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedShipments = filteredShipments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activeFilterLabel =
    statusFilters.find((f) => f.value === filterStatus)?.label || 'All';

  return (
    <View style={styles.container}>
      {/* Unified Search + Filter Dropdown Toolbar */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbarRow}>
          <View style={styles.searchBarWrap}>
            <Search size={17} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search ref, area, or name..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              clearButtonMode="while-editing"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} activeOpacity={0.7}>
                <X size={15} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              (filterOpen || filterStatus !== 'all') && styles.dropdownTriggerActive,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setFilterOpen((prev) => !prev);
            }}
          >
            <Filter
              size={14}
              color={filterStatus !== 'all' ? colors.primary : '#64748b'}
            />
            <Text
              style={[
                styles.dropdownTriggerText,
                filterStatus !== 'all' && styles.dropdownTriggerTextActive,
              ]}
            >
              {activeFilterLabel}
            </Text>
            <ChevronDown
              size={14}
              color={filterStatus !== 'all' ? colors.primary : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {filterOpen && (
          <View style={styles.dropdownMenu}>
            {statusFilters.map((f, idx) => {
              const isSelected = filterStatus === f.value;
              return (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.dropdownItem,
                    idx < statusFilters.length - 1 && styles.dropdownItemBorder,
                    isSelected && styles.dropdownItemActive,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setFilterStatus(f.value);
                    setFilterOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      isSelected && styles.dropdownItemTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                  {isSelected && <Check size={14} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* List of Shipments */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching available missions...</Text>
        </View>
      ) : (
        <FlatList
          data={paginatedShipments}
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
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
                  disabled={safePage <= 1}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCurrentPage(Math.max(1, safePage - 1));
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pageBtnText, safePage <= 1 && styles.pageBtnTextDisabled]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfo}>
                  Page {safePage} of {totalPages} ({filteredShipments.length})
                </Text>

                <TouchableOpacity
                  style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
                  disabled={safePage >= totalPages}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCurrentPage(Math.min(totalPages, safePage + 1));
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      safePage >= totalPages && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
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
  toolbarWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    zIndex: 20,
    position: 'relative',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dropdownTriggerActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  dropdownTriggerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  dropdownTriggerTextActive: {
    color: colors.primary,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 170,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
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
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageBtnDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.55,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageInfo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
});
