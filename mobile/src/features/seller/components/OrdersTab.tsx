import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  ShoppingBag,
  MapPin,
  Truck,
  Check,
  ShieldCheck,
  ChevronRight,
  Clock,
  ArrowLeft,
  Smartphone,
  EyeOff,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface OrdersTabProps {
  orders: any[];
  totalOrders: number;
  ordersPage: number;
  setOrdersPage: (updater: (p: number) => number) => void;
  pageSize: number;
  onUpdateStatus: (orderId: string, status: string) => void;
  onInitiateBroadcast: (orderId: string) => void;
  updatingOrderId?: string | null;
  loading?: boolean;
}

export function OrdersTab({
  orders,
  totalOrders,
  ordersPage,
  setOrdersPage,
  pageSize,
  onUpdateStatus,
  onInitiateBroadcast,
  updatingOrderId,
  loading = false,
}: OrdersTabProps) {
  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const getOrderStatusMeta = (rawStatus: string, shipment?: any) => {
    const s = (rawStatus || 'pending').toLowerCase();
    if (s === 'completed') {
      return { label: 'Completed & Settled', bg: '#dcfce7', color: '#15803d' };
    }
    if (s === 'delivered') {
      return { label: 'Delivered • Awaiting Buyer Confirmation', bg: '#fef3c7', color: '#b45309' };
    }
    if (s === 'awaiting_agent' || s === 'broadcast') {
      return { label: 'Finding Delivery Partner', bg: '#ffedd5', color: '#ea580c' };
    }
    if (shipment && shipment.status && shipment.status !== 'pending') {
      const shipStatus = shipment.status.toLowerCase();
      if (['accepted', 'assigned'].includes(shipStatus)) {
        return { label: 'Courier Partner Assigned', bg: '#e0e7ff', color: '#4338ca' };
      }
      if (['picked_up', 'started', 'in_transit', 'out_for_delivery'].includes(shipStatus)) {
        return { label: 'In Transit with Courier', bg: '#f3e8ff', color: '#7e22ce' };
      }
    }
    if (s === 'confirmed' || s === 'processing') {
      return { label: 'Confirmed • Ready for Dispatch', bg: '#e0f2fe', color: '#0369a1' };
    }
    if (s === 'disputed') {
      return { label: 'Dispute Under Review', bg: '#fee2e2', color: '#dc2626' };
    }
    if (s === 'cancelled') {
      return { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b' };
    }
    return { label: 'Order Confirmed', bg: '#fef9c3', color: '#a16207' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.subtitle}>Orders Summary</Text>
          <Text style={styles.title}>Customer Orders</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{totalOrders}</Text>
        </View>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <ShoppingBag size={40} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Active Orders</Text>
          <Text style={styles.emptySubtitle}>
            Your orders queue is currently clear. When buyers place orders, they will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {orders.map((order) => {
            const recipientData = Array.isArray(order.order_recipient)
              ? order.order_recipient[0]
              : order.order_recipient;
            const recipient = recipientData || {};
            const shipment = Array.isArray(order.shipments)
              ? order.shipments[0]
              : order.shipments;
            const statusMeta = getOrderStatusMeta(order.status, shipment);
            const isDelivered = order.status?.toLowerCase() === 'delivered';
            const isCompleted = order.status?.toLowerCase() === 'completed';
            const isPending = order.status?.toLowerCase() === 'pending';
            const isConfirmed = ['confirmed', 'processing'].includes(order.status?.toLowerCase());
            const isAwaitingAgent = ['awaiting_agent', 'broadcast'].includes(order.status?.toLowerCase());
            const isBusyWithThis = updatingOrderId === order.id;

            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Order Top Bar */}
                <View style={styles.orderTopBar}>
                  <View style={styles.orderRefRow}>
                    <View style={styles.refBadge}>
                      <Text style={styles.refBadgeText}>#{order.id.slice(0, 6).toUpperCase()}</Text>
                    </View>
                    <View>
                      <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                        <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                          {statusMeta.label}
                        </Text>
                      </View>
                      <Text style={styles.orderDate}>
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Items List */}
                <View style={styles.cardSection}>
                  <Text style={styles.sectionHeading}>Order Items</Text>
                  {(order.order_items || []).map((item: any, idx: number) => {
                    const prod = item.products || {};
                    const hasImg = prod.images && prod.images.length > 0;
                    return (
                      <View key={item.id || idx} style={styles.itemRow}>
                        <View style={styles.itemImageWrap}>
                          {hasImg ? (
                            <Image source={{ uri: prod.images[0] }} style={styles.itemImage} />
                          ) : (
                            <Smartphone size={16} color="#94a3b8" />
                          )}
                        </View>
                        <View style={styles.itemDetails}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {prod.title || 'Marketplace Item'}
                          </Text>
                          <View style={styles.itemMetaRow}>
                            <Text style={styles.itemQty}>Qty: {item.quantity || 1}</Text>
                            {item.size && (
                              <View style={styles.sizeBadge}>
                                <Text style={styles.sizeBadgeText}>Size: {item.size}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={styles.itemPrice}>
                          {formatPrice((item.price_at_purchase || prod.price || 0) * (item.quantity || 1))}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Delivery Destination (Strictly Hidden Buyer Phone/Email) */}
                <View style={styles.cardSection}>
                  <Text style={styles.sectionHeading}>Delivery Destination</Text>
                  <View style={styles.destBox}>
                    <Text style={styles.buyerName}>{recipient.full_name || 'LinkUp Customer'}</Text>
                    <Text style={styles.buyerAddress}>
                      {recipient.address_line || 'Delivery address registered with order'}
                    </Text>

                    <View style={styles.badgesRow}>
                      {recipient.cities?.name && (
                        <View style={styles.cityBadge}>
                          <Text style={styles.cityBadgeText}>{recipient.cities.name}</Text>
                        </View>
                      )}
                      {recipient.delivery_zones?.name && (
                        <View style={styles.cityBadge}>
                          <Text style={styles.cityBadgeText}>{recipient.delivery_zones.name}</Text>
                        </View>
                      )}
                    </View>

                    {/* Escrow Security & Privacy Shield Notice */}
                    <View style={styles.shieldNotice}>
                      <ShieldCheck size={14} color="#059669" />
                      <Text style={styles.shieldNoticeText}>
                        Buyer Contact Protected: Phone/email shielded for privacy & escrow security.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Courier Partner Info if Assigned */}
                {shipment && shipment.status && shipment.status !== 'pending' && (
                  <View style={styles.cardSection}>
                    <Text style={styles.sectionHeading}>Assigned Courier Partner</Text>
                    <View style={styles.courierCard}>
                      <View style={styles.courierAvatar}>
                        <Truck size={18} color={colors.primary} />
                      </View>
                      <View style={styles.courierInfo}>
                        <Text style={styles.courierName}>
                          {shipment.rider?.display_name || shipment.profiles?.display_name || 'LinkUp Delivery Agent'}
                        </Text>
                        <Text style={styles.trackingCode}>
                          Ref: {shipment.tracking_code || 'In Transit'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Status Action Buttons */}
                <View style={styles.actionFooter}>
                  {isPending && (
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => onUpdateStatus(order.id, 'confirmed')}
                      disabled={isBusyWithThis}
                      activeOpacity={0.8}
                    >
                      {isBusyWithThis ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Check size={16} color="#ffffff" strokeWidth={3} />
                          <Text style={styles.acceptBtnText}>Accept Order</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {isConfirmed && (!shipment || shipment.status === 'pending') && (
                    <TouchableOpacity
                      style={styles.broadcastBtn}
                      onPress={() => onInitiateBroadcast(order.id)}
                      disabled={isBusyWithThis}
                      activeOpacity={0.8}
                    >
                      <Truck size={16} color="#ffffff" strokeWidth={2.5} />
                      <Text style={styles.broadcastBtnText}>Find Delivery Partner</Text>
                    </TouchableOpacity>
                  )}

                  {isAwaitingAgent && (
                    <View style={styles.pulsingNotice}>
                      <Truck size={16} color="#2563eb" />
                      <Text style={styles.pulsingNoticeText}>
                        Waiting for a delivery partner to accept...
                      </Text>
                    </View>
                  )}

                  {isDelivered && (
                    <View style={[styles.pulsingNotice, styles.deliveredNotice]}>
                      <Clock size={16} color="#d97706" />
                      <Text style={[styles.pulsingNoticeText, { color: '#92400e' }]}>
                        Delivered • Awaiting Buyer Confirmation to Release Escrow
                      </Text>
                    </View>
                  )}

                  {isCompleted && (
                    <View style={[styles.pulsingNotice, styles.completedNotice]}>
                      <ShieldCheck size={16} color="#16a34a" />
                      <Text style={[styles.pulsingNoticeText, { color: '#15803d' }]}>
                        Delivered & Escrow Funds Released
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination */}
      {totalOrders > pageSize && (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageBtn, ordersPage === 0 && styles.pageBtnDisabled]}
            onPress={() => setOrdersPage((p) => Math.max(0, p - 1))}
            disabled={ordersPage === 0}
          >
            <ArrowLeft size={16} color={ordersPage === 0 ? '#cbd5e1' : '#0f172a'} />
          </TouchableOpacity>

          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>PAGE {ordersPage + 1}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pageBtn,
              (ordersPage + 1) * pageSize >= totalOrders && styles.pageBtnDisabled,
            ]}
            onPress={() => setOrdersPage((p) => p + 1)}
            disabled={(ordersPage + 1) * pageSize >= totalOrders}
          >
            <ChevronRight
              size={16}
              color={(ordersPage + 1) * pageSize >= totalOrders ? '#cbd5e1' : '#0f172a'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 260,
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    padding: 16,
    gap: 14,
  },
  orderTopBar: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refBadge: {
    width: 52,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 3,
  },
  cardSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  itemImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemQty: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  sizeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sizeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  destBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  buyerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  buyerAddress: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  cityBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  shieldNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  shieldNoticeText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    lineHeight: 14,
  },
  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  courierAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  trackingCode: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  actionFooter: {
    paddingTop: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  broadcastBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pulsingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  deliveredNotice: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  completedNotice: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  pulsingNoticeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  pageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageIndicatorText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
});

