import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  User,
  MapPin,
  Clock,
  Phone,
  Bike,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  Package,
  X,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import { AdminPagination } from '../AdminPagination';
import * as Haptics from 'expo-haptics';

export function AdminOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:buyer_id(display_name, id),
          order_recipient(full_name, phone, address_line, city_id, zone_id),
          shipments(*),
          order_settlements(*)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Extract rider IDs if present
      const riderIds = new Set<string>();
      data?.forEach((o: any) => {
        const ships = Array.isArray(o.shipments) ? o.shipments : (o.shipments ? [o.shipments] : []);
        ships.forEach((s: any) => {
          if (s.rider_id) riderIds.add(s.rider_id);
        });
      });

      if (riderIds.size > 0) {
        const { data: riders } = await supabase
          .from('profiles')
          .select('id, display_name, phone, avatar_url')
          .in('id', Array.from(riderIds));
        const riderMap = new Map(riders?.map((r) => [r.id, r]) || []);

        data?.forEach((o: any) => {
          const ships = Array.isArray(o.shipments) ? o.shipments : (o.shipments ? [o.shipments] : []);
          ships.forEach((s: any) => {
            if (s.rider_id) {
              s.rider = riderMap.get(s.rider_id);
            }
          });
        });
      }

      setOrders(data || []);
    } catch (err: any) {
      console.warn('[AdminOrdersTab] Error loading orders:', err);
      toast.error('Failed to load orders', { description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleReleaseOrderFunds = async (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Release Escrow Funds',
      'Are you sure you want to release these funds immediately? This will bypass the 48h hold and credit the merchant balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release Now',
          onPress: async () => {
            setIsReleasing(true);
            try {
              const { data, error } = await (supabase as any).rpc(
                'admin_release_order_funds',
                { p_order_id: orderId }
              );
              if (error) throw error;

              const res = data as any;
              if (res?.success) {
                toast.success('Funds Released', {
                  description: 'Escrow released directly to merchant account.',
                });
                setSelectedOrder(null);
                fetchOrders();
              } else {
                toast.warning('Release Notice', {
                  description: res?.message || 'Order could not be released.',
                });
              }
            } catch (err: any) {
              toast.error('Release Failed', {
                description: err.message || 'Error occurred while releasing funds.',
              });
            } finally {
              setIsReleasing(false);
            }
          },
        },
      ]
    );
  };

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.profiles?.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.order_recipient?.[0]?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !['delivered', 'completed', 'cancelled'].includes(o.status)) ||
      o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
      case 'in_transit':
      case 'shipped':
        return { text: colors.primary, bg: '#FFF7ED', border: '#FED7AA' };
      case 'processing':
      case 'confirmed':
        return { text: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
      case 'cancelled':
        return { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
      default:
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    }
  };

  const statuses = [
    { key: 'all', label: 'All Orders' },
    { key: 'active', label: 'Active In-Flight' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <View style={styles.container}>
      {/* Search & Filter Header */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          placeholder="Search by Order ID or buyer name..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Status Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusChipsScroll}
      >
        {statuses.map((s) => {
          const active = statusFilter === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.statusChip, active && styles.statusChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setStatusFilter(s.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading live marketplace orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingBag size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No matching orders</Text>
          <Text style={styles.emptyDesc}>Try adjusting your filter or search query</Text>
        </View>
      ) : (
        <>
          <View style={styles.ordersList}>
            {paginatedOrders.map((order) => {
              const sc = getStatusColor(order.status);
              const recipient = Array.isArray(order.order_recipient)
                ? order.order_recipient[0]
                : order.order_recipient;
              const items = (order.items as any[]) || [];
              const shipment = Array.isArray(order.shipments)
                ? order.shipments[0]
                : order.shipments;

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedOrder(order);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderIdWrap}>
                      <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                      <Text style={styles.orderDate}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: sc.bg, borderColor: sc.border },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {order.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Buyer & Recipient Info */}
                  <View style={styles.orderBuyerRow}>
                    <View style={styles.iconCircle}>
                      <User size={14} color="#64748B" />
                    </View>
                    <Text style={styles.orderBuyerName} numberOfLines={1}>
                      Buyer: {order.profiles?.display_name || 'Guest User'}
                    </Text>
                  </View>

                  {recipient?.address_line && (
                    <View style={styles.orderAddressRow}>
                      <MapPin size={13} color="#94A3B8" />
                      <Text style={styles.orderAddress} numberOfLines={1}>
                        {recipient.address_line}
                      </Text>
                    </View>
                  )}

                  {/* Footer with Amount & Items Count */}
                  <View style={styles.orderCardFooter}>
                    <Text style={styles.itemsCount}>
                      {items.length > 0 ? `${items.length} item(s)` : 'Marketplace package'}
                    </Text>
                    <Text style={styles.orderAmount}>{formatNaira(order.total_amount)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            onPageChange={setCurrentPage}
            label="orders"
          />
        </>
      )}

      {/* Order Details Bottom-Sheet Modal */}
      {(() => {
        if (!selectedOrder) return null;

        const shipment = Array.isArray(selectedOrder.shipments)
          ? selectedOrder.shipments[0]
          : selectedOrder.shipments;

        const shipping = Array.isArray(selectedOrder.order_recipient)
          ? selectedOrder.order_recipient[0]
          : selectedOrder.order_recipient;

        const settlement = Array.isArray(selectedOrder.order_settlements)
          ? selectedOrder.order_settlements[0]
          : selectedOrder.order_settlements;

        const rider = shipment?.rider;
        const items: any[] = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];

        const riderAmount = Number(
          settlement?.rider_amount ?? selectedOrder.delivery_fee ?? 0
        );
        const sellerAmount = Number(
          settlement?.seller_amount ??
            (selectedOrder.total_amount ? selectedOrder.total_amount - (selectedOrder.delivery_fee || 0) : 0)
        );
        const platformAmount = Number(settlement?.platform_amount ?? 0);
        const promoterAmount = Number(settlement?.promoter_amount ?? 0);
        const totalDistribution = Number(selectedOrder.total_amount ?? 0);

        const logisticsStatus = (shipment?.status || selectedOrder.status || 'PENDING').toUpperCase();
        const orderCode = `ST-OR-${(selectedOrder.id || '').slice(0, 5).toUpperCase()}`;
        const distanceText = shipment?.distance_km
          ? `${Number(shipment.distance_km).toFixed(1)} KM`
          : '---';

        const isSettled = selectedOrder.settlement_status === 'settled';
        const isDeliveredOrCompleted =
          selectedOrder.status === 'completed' || selectedOrder.status === 'delivered';

        return (
          <AppModal
            visible={selectedOrder !== null}
            onClose={() => setSelectedOrder(null)}
            showCloseButton={false}
            noPadding={true}
            maxHeight="92%"
          >
            <View style={styles.modalContentRoot}>
              {/* 1. Header with Orange Brand Badge and Order Code */}
              <View style={styles.modalHeaderBox}>
                <View style={styles.modalBadgeRow}>
                  <View style={styles.orderSummaryBadge}>
                    <Text style={styles.orderSummaryBadgeText}>ORDER SUMMARY</Text>
                  </View>
                  <View style={styles.modalHeaderRight}>
                    <View style={styles.orderCodeBadge}>
                      <Text style={styles.orderCodeBadgeText}>{orderCode}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setSelectedOrder(null)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel="Close order details"
                    >
                      <X size={15} color="#64748B" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.modalHeadingTitle}>Order Details</Text>
                <Text style={styles.modalHeadingSubtitle}>
                  Full list of items, shipping location, and customer details.
                </Text>
              </View>

              {/* 2. Modal Body Content */}
              <View style={styles.modalBodyInner}>
                {/* Distance & Logistics Status Card */}
                <View style={styles.logisticsCard}>
                  <View style={styles.logisticsCol}>
                    <Text style={styles.logisticsColLabel}>DISTANCE</Text>
                    <Text style={styles.logisticsColValue}>{distanceText}</Text>
                  </View>
                  <View style={styles.logisticsDivider} />
                  <View style={[styles.logisticsCol, { flex: 1.2 }]}>
                    <Text style={styles.logisticsColLabel}>LOGISTICS STATUS</Text>
                    <Text style={styles.logisticsStatusText}>{logisticsStatus}</Text>
                  </View>
                </View>

                {/* Mission Verification PINs & Tracking (if available) */}
                {shipment && (shipment.pickup_code || shipment.delivery_code || shipment.tracking_code) ? (
                  <View style={styles.missionCard}>
                    {shipment.tracking_code ? (
                      <View style={styles.trackingRow}>
                        <Text style={styles.missionLabel}>TRACKING CODE</Text>
                        <View style={styles.trackingPill}>
                          <Text style={styles.trackingPillText}>{shipment.tracking_code}</Text>
                        </View>
                      </View>
                    ) : null}
                    {(shipment.pickup_code || shipment.delivery_code) ? (
                      <View style={styles.pinsRow}>
                        <View style={styles.pinBadgePickup}>
                          <Text style={styles.pinBadgePickupText}>
                            PICK: {shipment.pickup_code || '----'}
                          </Text>
                        </View>
                        <View style={styles.pinBadgeDrop}>
                          <Text style={styles.pinBadgeDropText}>
                            DROP: {shipment.delivery_code || '----'}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* 3. Financial Payout Ledger Section */}
                <View style={styles.sectionHeaderWrap}>
                  <CreditCard size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderOverline}>FINANCIAL PAYOUT LEDGER</Text>
                </View>

                <View style={styles.ledgerCard}>
                  <View style={styles.ledgerGrid}>
                    {/* Rider Payout */}
                    <View style={[styles.ledgerCell, styles.cellBorderRight, styles.cellBorderBottom]}>
                      <View style={styles.ledgerCellHeader}>
                        <Bike size={11} color="#6366F1" strokeWidth={2.2} />
                        <Text style={styles.ledgerCellLabel}>RIDER PAYOUT</Text>
                      </View>
                      <Text style={[styles.ledgerCellValue, { color: '#4F46E5' }]}>
                        {formatNaira(riderAmount)}
                      </Text>
                    </View>

                    {/* Seller Payout */}
                    <View style={[styles.ledgerCell, styles.cellBorderBottom]}>
                      <View style={styles.ledgerCellHeader}>
                        <User size={11} color="#059669" strokeWidth={2.2} />
                        <Text style={styles.ledgerCellLabel}>SELLER PAYOUT</Text>
                      </View>
                      <Text style={[styles.ledgerCellValue, { color: '#059669' }]}>
                        {formatNaira(sellerAmount)}
                      </Text>
                    </View>

                    {/* Platform Rev */}
                    <View style={[styles.ledgerCell, styles.cellBorderRight]}>
                      <View style={styles.ledgerCellHeader}>
                        <ShieldCheck size={11} color="#2563EB" strokeWidth={2.2} />
                        <Text style={styles.ledgerCellLabel}>PLATFORM REV</Text>
                      </View>
                      <Text style={[styles.ledgerCellValue, { color: '#2563EB' }]}>
                        {formatNaira(platformAmount)}
                      </Text>
                    </View>

                    {/* Promoter */}
                    <View style={styles.ledgerCell}>
                      <View style={styles.ledgerCellHeader}>
                        <ArrowUpRight size={11} color="#EA580C" strokeWidth={2.4} />
                        <Text style={styles.ledgerCellLabel}>PROMOTER</Text>
                      </View>
                      <Text style={[styles.ledgerCellValue, { color: '#EA580C' }]}>
                        {formatNaira(promoterAmount)}
                      </Text>
                    </View>
                  </View>

                  {/* Total Distribution Footer */}
                  <View style={styles.ledgerTotalBar}>
                    <Text style={styles.ledgerTotalLabel}>TOTAL DISTRIBUTION</Text>
                    <Text style={styles.ledgerTotalValue}>{formatNaira(totalDistribution)}</Text>
                  </View>
                </View>

                {/* 4. Settlement Status Banner / Release Actions */}
                {!isDeliveredOrCompleted ? (
                  <View style={styles.settlementHoldCard}>
                    <View style={styles.settlementHoldIconBox}>
                      <AlertTriangle size={16} color="#D97706" strokeWidth={2.4} />
                    </View>
                    <View style={styles.settlementTextWrap}>
                      <Text style={styles.settlementHoldTitle}>SETTLEMENT ON HOLD</Text>
                      <Text style={styles.settlementHoldSubtitle}>
                        Funds can only be released after delivery.
                      </Text>
                    </View>
                  </View>
                ) : isSettled ? (
                  <View style={styles.settlementFinalizedCard}>
                    <View style={styles.settlementFinalizedIconBox}>
                      <ShieldCheck size={16} color="#059669" strokeWidth={2.4} />
                    </View>
                    <View style={styles.settlementTextWrap}>
                      <Text style={styles.settlementFinalizedTitle}>SETTLEMENT FINALIZED</Text>
                      <Text style={styles.settlementFinalizedSubtitle}>
                        Funds have been successfully moved to main balances.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Button
                    title={isReleasing ? 'Releasing Payouts...' : 'Release Payouts Now'}
                    onPress={() => handleReleaseOrderFunds(selectedOrder.id)}
                    loading={isReleasing}
                    icon={ShieldCheck}
                    style={styles.releasePayoutsBtn}
                  />
                )}

                {/* 5. Shipping Address */}
                <View style={styles.sectionHeaderWrap}>
                  <MapPin size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderOverline}>SHIPPING ADDRESS</Text>
                </View>
                <View style={styles.shippingCard}>
                  <Text style={styles.shippingAddressText}>
                    {shipping?.address_line || shipment?.delivery_address || 'Test address'}
                  </Text>
                  {(shipping?.full_name || shipping?.phone) ? (
                    <View style={styles.shippingRecipientRow}>
                      <Text style={styles.shippingRecipientText}>
                        {shipping.full_name || 'Customer'}
                        {shipping.phone ? ` • ${shipping.phone}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 6. Package Items */}
                <View style={styles.sectionHeaderWrap}>
                  <Package size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderOverline}>
                    PACKAGE ITEMS ({items.length})
                  </Text>
                </View>
                <View style={styles.itemsCard}>
                  {items.length === 0 ? (
                    <View style={styles.emptyItemsBox}>
                      <Text style={styles.emptyItemsText}>No specific item lines recorded</Text>
                    </View>
                  ) : (
                    items.map((it: any, i: number) => {
                      const itemTitle = it.title || it.name || 'Product Item';
                      const itemQty = it.quantity || 1;
                      const itemPrice = Number(it.price || it.unit_price || 0);
                      const itemImage = it.image || it.images?.[0];

                      return (
                        <View
                          key={i}
                          style={[
                            styles.itemRowNew,
                            i < items.length - 1 && styles.itemRowBorder,
                          ]}
                        >
                          {itemImage ? (
                            <Image
                              source={{ uri: itemImage }}
                              style={styles.itemThumb}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.itemThumbPlaceholder}>
                              <Package size={18} color="#94A3B8" strokeWidth={2} />
                            </View>
                          )}
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitleNew} numberOfLines={2}>
                              {itemTitle}
                            </Text>
                            <Text style={styles.itemQtyNew}>Qty: {itemQty}</Text>
                          </View>
                          <Text style={styles.itemPriceNew}>
                            {formatNaira(itemPrice * itemQty)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                  <View style={styles.itemsTotalBar}>
                    <Text style={styles.itemsTotalLabel}>TOTAL ITEMS VALUE</Text>
                    <Text style={styles.itemsTotalValue}>{formatNaira(totalDistribution)}</Text>
                  </View>
                </View>

                {/* 7. Delivery Agent Info */}
                <View style={styles.sectionHeaderWrap}>
                  <Bike size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderOverline}>DELIVERY AGENT INFO</Text>
                </View>
                {rider ? (
                  <View style={styles.riderCard}>
                    <View style={styles.riderAvatarBox}>
                      <Text style={styles.riderAvatarText}>
                        {rider.display_name?.charAt(0).toUpperCase() || 'R'}
                      </Text>
                    </View>
                    <View style={styles.riderInfoWrap}>
                      <Text style={styles.riderName}>{rider.display_name || 'Assigned Rider'}</Text>
                      {rider.phone ? (
                        <View style={styles.riderPhoneRow}>
                          <Phone size={10} color="#EA580C" />
                          <Text style={styles.riderPhoneText}>{rider.phone}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.riderBadge}>
                      <Text style={styles.riderBadgeText}>DELIVERY PARTNER</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noRiderCard}>
                    <Text style={styles.noRiderTitle}>No Agent Assigned Yet</Text>
                    <Text style={styles.noRiderSub}>Waiting for a driver to take the order.</Text>
                  </View>
                )}

                {/* 8. Customer Info & Timeline */}
                <View style={styles.sectionHeaderWrap}>
                  <User size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderOverline}>CUSTOMER & TIMELINE</Text>
                </View>
                <View style={styles.customerCard}>
                  <View style={styles.customerRow}>
                    <Text style={styles.customerLabel}>Customer</Text>
                    <Text style={styles.customerValue}>
                      {selectedOrder.profiles?.display_name || 'Registered Customer'}
                    </Text>
                  </View>
                  <View style={styles.customerRow}>
                    <Text style={styles.customerLabel}>Buyer ID</Text>
                    <Text style={styles.customerValueMono}>
                      {selectedOrder.buyer_id ? `${selectedOrder.buyer_id.slice(0, 12)}...` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.customerRow}>
                    <Text style={styles.customerLabel}>Placed On</Text>
                    <Text style={styles.customerValue}>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Admin Force Escrow Release Override */}
                {!isSettled && !isDeliveredOrCompleted ? (
                  <TouchableOpacity
                    style={styles.forceReleaseLink}
                    onPress={() => handleReleaseOrderFunds(selectedOrder.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forceReleaseLinkText}>
                      Force Escrow Release (Admin Override) &rarr;
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </AppModal>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  clearSearch: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statusChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  loaderWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  ordersList: {
    gap: 10,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  orderDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderBuyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBuyerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  orderAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  orderAddress: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemsCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalContentRoot: {
    backgroundColor: '#FFFFFF',
  },
  modalHeaderBox: {
    backgroundColor: '#FFF8F1',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderSummaryBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 20,
  },
  orderSummaryBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderCodeBadge: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  orderCodeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.4,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeadingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  modalHeadingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },
  modalBodyInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  logisticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logisticsCol: {
    flex: 1,
  },
  logisticsColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  logisticsColValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  logisticsDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  logisticsStatusText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#4F46E5',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  missionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  trackingPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackingPillText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#4F46E5',
  },
  pinsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinBadgePickup: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinBadgePickupText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    fontFamily: 'monospace',
  },
  pinBadgeDrop: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinBadgeDropText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
    fontFamily: 'monospace',
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sectionHeaderOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ledgerCell: {
    width: '50%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  cellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ledgerCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ledgerCellLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  ledgerCellValue: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  ledgerTotalBar: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E0E7FF',
  },
  ledgerTotalLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#3730A3',
    letterSpacing: 0.8,
  },
  ledgerTotalValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#312E81',
  },
  settlementHoldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
  },
  settlementHoldIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settlementTextWrap: {
    flex: 1,
  },
  settlementHoldTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  settlementHoldSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B45309',
    marginTop: 1,
  },
  settlementFinalizedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
  },
  settlementFinalizedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settlementFinalizedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  settlementFinalizedSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 1,
  },
  releasePayoutsBtn: {
    backgroundColor: '#059669',
  },
  shippingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  shippingAddressText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 19,
  },
  shippingRecipientRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  shippingRecipientText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  emptyItemsBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  itemRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  itemThumbPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleNew: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemQtyNew: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  itemPriceNew: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  itemsTotalBar: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemsTotalLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  itemsTotalValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 12,
  },
  riderAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  riderInfoWrap: {
    flex: 1,
  },
  riderName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  riderPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  riderPhoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  riderBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  riderBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  noRiderCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  noRiderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  noRiderSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  customerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  customerValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  customerValueMono: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#0F172A',
  },
  forceReleaseLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 2,
  },
  forceReleaseLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
    textDecorationLine: 'underline',
  },
});
