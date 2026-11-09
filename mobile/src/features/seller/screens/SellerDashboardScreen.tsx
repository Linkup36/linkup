import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Plus,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  Wallet,
  MapPin,
  Clock,
  EyeOff,
  CheckCircle,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

export function SellerDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    activeListings: 0,
    pendingOrders: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSellerMetrics = async () => {
    if (!user) return;
    try {
      // 1. Fetch active listings count
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id);

      // 2. Fetch seller orders count
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, products!inner(price, seller_id)')
        .eq('products.seller_id', user.id);

      const totalRev = (orderItems || []).reduce(
        (acc: number, curr: any) => acc + (curr.products?.price || 0),
        0
      );

      // 3. Fetch actual seller orders (strictly omitting buyer phone/email for privacy)
      const { data: sellerOrders } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          total_amount,
          order_items (
            id,
            product_id,
            quantity,
            price_at_purchase,
            size,
            products (
              title,
              images,
              price
            )
          ),
          order_recipient (
            full_name,
            address_line,
            cities (name),
            delivery_zones (name)
          ),
          shipments (
            id,
            status,
            tracking_code
          )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setMetrics({
        totalRevenue: totalRev,
        activeListings: productCount || 0,
        pendingOrders: (orderItems || []).length,
      });

      if (sellerOrders) {
        setOrders(sellerOrders);
      }
    } catch (e) {
      console.warn('[SellerDashboard] Error fetching stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSellerMetrics();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSellerMetrics();
  };

  const formatPrice = (val: number) => '₦' + val.toLocaleString('en-NG');

  const getOrderStatusMeta = (rawStatus: string) => {
    const s = (rawStatus || 'pending').toLowerCase();
    switch (s) {
      case 'completed':
        return { label: 'Completed & Settled', bg: '#dcfce7', color: '#15803d' };
      case 'delivered':
        return { label: 'Delivered • Awaiting Buyer Confirmation', bg: '#fef3c7', color: '#b45309' };
      case 'out_for_delivery':
      case 'in_transit':
      case 'picked_up':
      case 'started':
        return { label: 'In Transit with Courier', bg: '#ffedd5', color: '#ea580c' };
      case 'awaiting_agent':
      case 'broadcast':
        return { label: 'Finding Courier Partner', bg: '#e0e7ff', color: '#4338ca' };
      case 'accepted':
      case 'assigned':
        return { label: 'Courier Assigned', bg: '#e0e7ff', color: '#4338ca' };
      case 'disputed':
        return { label: 'Dispute Under Review', bg: '#fee2e2', color: '#dc2626' };
      case 'cancelled':
        return { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b' };
      default:
        return { label: 'Order Confirmed', bg: '#fef9c3', color: '#a16207' };
    }
  };

  const scrollToOrders = () => {
    scrollRef.current?.scrollTo({ y: 340, animated: true });
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Merchant Dashboard</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('ListProduct', {})}
        >
          <Plus size={20} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        {/* Verification Alert Banner */}
        {profile?.kyc_status !== 'verified' && (
          <TouchableOpacity
            style={styles.kycBanner}
            onPress={() => navigation.navigate('SellerVerification')}
            activeOpacity={0.8}
          >
            <View style={styles.kycLeft}>
              <ShieldCheck size={20} color="#d97706" />
              <View>
                <Text style={styles.kycTitle}>Complete Identity KYC</Text>
                <Text style={styles.kycSubtitle}>Unlock instant payouts & trust badge</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#d97706" />
          </TouchableOpacity>
        )}

        {/* Metric Cards Grid */}
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <TrendingUp size={22} color="#16a34a" />
            <Text style={styles.metricLabel}>Total Sales</Text>
            <Text style={styles.metricValue}>
              {loading ? '...' : formatPrice(metrics.totalRevenue)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Package size={22} color="#4f46e5" />
            <Text style={styles.metricLabel}>Active Listings</Text>
            <Text style={styles.metricValue}>
              {loading ? '...' : metrics.activeListings}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={scrollToOrders}
            activeOpacity={0.8}
          >
            <ShoppingBag size={22} color="#ea580c" />
            <Text style={styles.metricLabel}>Incoming Orders</Text>
            <Text style={styles.metricValue}>
              {loading ? '...' : metrics.pendingOrders}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, styles.walletCard]}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Wallet size={22} color="#ffffff" />
            <Text style={[styles.metricLabel, { color: '#cbd5e1' }]}>Wallet Payouts</Text>
            <Text style={[styles.metricValue, { color: '#ffffff' }]}>Manage</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionHeader}>Quick Actions</Text>
        <Button
          title="Create New Product Listing"
          onPress={() => navigation.navigate('ListProduct', {})}
          style={{ marginBottom: 12 }}
        />

        <Button
          title="Verify Merchant KYC"
          variant="outline"
          onPress={() => navigation.navigate('SellerVerification')}
          style={{ marginBottom: 28 }}
        />

        {/* Incoming Orders Section */}
        <View style={styles.ordersSectionHeaderRow}>
          <View>
            <Text style={styles.sectionHeaderDark}>Incoming Customer Orders</Text>
            <Text style={styles.sectionSubDark}>
              Orders placed by LinkUp buyers for your inventory
            </Text>
          </View>
          <View style={styles.orderCountPill}>
            <Text style={styles.orderCountPillText}>{orders.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color="#4f46e5" />
            <Text style={styles.centerLoadingText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyOrdersCard}>
            <ShoppingBag size={36} color="#94a3b8" />
            <Text style={styles.emptyOrdersTitle}>No Incoming Orders</Text>
            <Text style={styles.emptyOrdersSub}>
              When buyers purchase your items, they will appear here with automated courier dispatch tracking.
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((o) => {
              const recipient = Array.isArray(o.order_recipient)
                ? o.order_recipient[0]
                : o.order_recipient;
              const shipment = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments;
              const statusMeta = getOrderStatusMeta(o.status);
              const isDeliveredAwaitingConfirmation = o.status?.toLowerCase() === 'delivered';
              const isOrderCompleted = o.status?.toLowerCase() === 'completed';

              return (
                <View key={o.id} style={styles.orderCard}>
                  {/* Order Top Bar */}
                  <View style={styles.orderTopBar}>
                    <View style={styles.orderRefWrap}>
                      <Text style={styles.orderRefText}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                      <Text style={styles.orderDateText}>
                        {new Date(o.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Order Items */}
                  <View style={styles.orderItemsWrap}>
                    {(o.order_items || []).map((item: any, idx: number) => {
                      const prod = item.products || {};
                      const img = prod.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200';
                      return (
                        <View key={item.id || idx} style={styles.orderItemRow}>
                          <Image source={{ uri: img }} style={styles.itemThumb} resizeMode="cover" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {prod.title || 'Product'}
                            </Text>
                            <View style={styles.itemMetaRow}>
                              <Text style={styles.itemQty}>Qty: {item.quantity || 1}</Text>
                              {item.size ? (
                                <View style={styles.itemSizeBadge}>
                                  <Text style={styles.itemSizeText}>Size: {item.size}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.itemPrice}>
                            ₦{Math.round(item.price_at_purchase || prod.price || 0).toLocaleString('en-NG')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Destination & Privacy Shield Section */}
                  <View style={styles.destinationCard}>
                    <View style={styles.destHeader}>
                      <MapPin size={13} color="#ea580c" />
                      <Text style={styles.destHeaderTitle}>DELIVERY DESTINATION</Text>
                    </View>

                    <Text style={styles.destCustomerName}>
                      {recipient?.full_name || 'LinkUp Customer'}
                    </Text>
                    <Text style={styles.destAddress}>
                      {recipient?.address_line || 'Delivery Address Provided to Courier'}
                    </Text>

                    <View style={styles.zonePillsRow}>
                      {recipient?.cities?.name && (
                        <View style={styles.zonePill}>
                          <Text style={styles.zonePillText}>{recipient.cities.name}</Text>
                        </View>
                      )}
                      {recipient?.delivery_zones?.name && (
                        <View style={styles.zonePill}>
                          <Text style={styles.zonePillText}>{recipient.delivery_zones.name}</Text>
                        </View>
                      )}
                    </View>

                    {/* PRIVACY PROTECTION: Buyer Contact Hidden from Seller */}
                    <View style={styles.privacyShieldBox}>
                      <View style={styles.privacyShieldTop}>
                        <EyeOff size={14} color="#059669" />
                        <Text style={styles.privacyShieldTitle}>Buyer Contact Protected</Text>
                      </View>
                      <Text style={styles.privacyShieldDesc}>
                        Buyer phone number and email are kept hidden for customer privacy and escrow security. Linkup Courier Partners coordinate pickup and delivery directly.
                      </Text>
                    </View>
                  </View>

                  {/* Shipment Tracking Info if assigned */}
                  {shipment && shipment.tracking_code ? (
                    <View style={styles.shipmentTrackingBar}>
                      <Text style={styles.shipmentTrackingLabel}>COURIER TRACKING:</Text>
                      <Text style={styles.shipmentTrackingCode}>{shipment.tracking_code}</Text>
                    </View>
                  ) : null}

                  {/* Lifecycle Settlement Guidance */}
                  {isDeliveredAwaitingConfirmation && (
                    <View style={styles.escrowNoticeCard}>
                      <Clock size={14} color="#b45309" />
                      <Text style={styles.escrowNoticeText}>
                        Courier has delivered this order. Escrow payout will be released to your wallet as soon as the buyer physically confirms receipt on their mobile app.
                      </Text>
                    </View>
                  )}

                  {isOrderCompleted && (
                    <View style={styles.completedNoticeCard}>
                      <CheckCircle size={14} color="#16a34a" />
                      <Text style={styles.completedNoticeText}>
                        Order confirmed received by buyer. Escrow funds settled to your LinkUp Wallet.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  kycLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  kycSubtitle: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  walletCard: {
    backgroundColor: '#1e1b4b',
    borderColor: '#1e1b4b',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 10,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  ordersSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderDark: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionSubDark: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  orderCountPill: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderCountPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
  },
  centerLoading: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyOrdersCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  emptyOrdersTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
  },
  emptyOrdersSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  orderRefWrap: {
    flex: 1,
  },
  orderRefText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  orderDateText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  orderItemsWrap: {
    paddingVertical: 12,
    gap: 10,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  itemQty: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  itemSizeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemSizeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
  },
  destinationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
    gap: 4,
  },
  destHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  destHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  destCustomerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  destAddress: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  zonePillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  zonePill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  zonePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  privacyShieldBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  privacyShieldTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyShieldTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
    textTransform: 'uppercase',
  },
  privacyShieldDesc: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 15,
  },
  shipmentTrackingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  shipmentTrackingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338ca',
  },
  shipmentTrackingCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4338ca',
    fontFamily: 'monospace',
  },
  escrowNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    marginTop: 10,
  },
  escrowNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92400e',
    lineHeight: 15,
    fontWeight: '500',
  },
  completedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    marginTop: 10,
  },
  completedNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#15803d',
    lineHeight: 15,
    fontWeight: '600',
  },
});
