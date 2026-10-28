import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Package,
  Plus,
  ShoppingBag,
  Wallet,
  TrendingUp,
  Bell,
  ShieldCheck,
  Store,
  ArrowUpRight,
  ArrowDownToLine,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Menu,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeView } from '../../../components/ui/SafeView';
import { toast as GooeyToast } from '../../../components/ui/GooeyToast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';

import { SellerSidebar } from '../components/SellerSidebar';
import { SellerInventoryTab } from '../components/SellerInventoryTab';
import { SellerListProductTab } from '../components/SellerListProductTab';
import { SellerOrdersTab } from '../components/SellerOrdersTab';
import { SellerWalletTab } from '../components/SellerWalletTab';
import { SellerAnalyticsTab } from '../components/SellerAnalyticsTab';
import { SellerIssuesTab } from '../components/SellerIssuesTab';
import { SellerPaymentsTab } from '../components/SellerPaymentsTab';
import { SellerProfileTab } from '../components/SellerProfileTab';

export type SellerTabKey =
  | 'products'
  | 'list-product'
  | 'orders'
  | 'issues'
  | 'wallet'
  | 'analytics'
  | 'payments'
  | 'profile';

const TAB_TITLES: Record<SellerTabKey, string> = {
  products: 'Inventory',
  'list-product': 'List Product',
  orders: 'Orders',
  issues: 'Order Issues',
  wallet: 'Seller Wallet',
  analytics: 'Insights & Analytics',
  payments: 'Payments History',
  profile: 'Store Profile',
};

export function SellerDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, roles, refreshProfile, signOut } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 840;

  const [activeTab, setActiveTab] = useState<SellerTabKey>('products');
  const [isSidebarOpen, setIsSidebarOpen] = useState(isLargeScreen);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingRole, setActivatingRole] = useState(false);
  const dashboardScrollRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 360);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sync sidebar open state when screen size crosses tablet breakpoint
  useEffect(() => {
    setIsSidebarOpen(isLargeScreen);
  }, [isLargeScreen]);

  // Pagination & mutation states
  const PAGE_SIZE = 10;
  const [productsPage, setProductsPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
  const [isBroadcastingOrder, setIsBroadcastingOrder] = useState(false);

  // Dashboard Data State (matching useSellerDashboardData.ts)
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [verification, setVerification] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [openIssuesCount, setOpenIssuesCount] = useState(0);

  // Wallet Transactions Notification Bell Modal
  const [bellModalVisible, setBellModalVisible] = useState(false);
  const [seenTxIds, setSeenTxIds] = useState<string[]>([]);

  const isSeller = useMemo(() => {
    return (roles || []).includes('seller');
  }, [roles]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      GooeyToast.success('Signed Out', 'You have been safely signed out.');
    } catch (err) {
      console.warn('[SellerDashboardScreen] Sign out error:', err);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [
        productsRes,
        ordersRes,
        walletRes,
        verificationRes,
        profileRes,
        issuesRes,
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select(
            `
            *,
            order_items (
              *,
              products (*)
            ),
            order_recipient (*),
            shipments (*)
          `
          )
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('seller_verifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('*')
          .or(`user_id.eq.${user.id},id.eq.${user.id}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('issues')
          .select('id')
          .eq('seller_id', user.id)
          .in('status', ['open', 'investigating']),
      ]);

      setProducts(productsRes.data || []);

      // If direct seller_id orders returned empty, fallback to orders containing seller's products
      let sellerOrders = ordersRes.data || [];
      if (sellerOrders.length === 0 && (productsRes.data || []).length > 0) {
        const productIds = (productsRes.data || []).map((p: any) => p.id);
        const { data: itemOrders } = await supabase
          .from('order_items')
          .select('order_id')
          .in('product_id', productIds);
        const orderIds = Array.from(
          new Set((itemOrders || []).map((io: any) => io.order_id).filter(Boolean))
        );
        if (orderIds.length > 0) {
          const { data: fallbackOrders } = await supabase
            .from('orders')
            .select(
              `
              *,
              order_items (
                *,
                products (*)
              ),
              order_recipient (*),
              shipments (*)
            `
            )
            .in('id', orderIds)
            .order('created_at', { ascending: false });
          sellerOrders = fallbackOrders || [];
        }
      }
      setOrders(sellerOrders);

      let activeWallet = walletRes.data;
      if (!activeWallet) {
        const { data: createdWallet } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            balance: 0,
            escrow_balance: 0,
          } as any)
          .select('*')
          .maybeSingle();
        activeWallet = createdWallet;
      }
      setWallet(activeWallet);

      if (activeWallet?.id) {
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', activeWallet.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setTransactions(txData || []);
      } else {
        setTransactions([]);
      }

      setVerification(verificationRes.data || null);
      setProfile(profileRes.data || null);
      setOpenIssuesCount((issuesRes.data || []).length);
    } catch (err) {
      console.warn('[SellerDashboardScreen] Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime subscriptions for orders & wallet updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`seller-dashboard-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchDashboardData]);

  const onPullRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboardData();
  };

  // Computed metrics (matching web MetricCards & useSellerDashboardData)
  const metrics = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.payment_status !== 'failed'
    );
    const totalEarnings = validOrders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );
    const netSettled = Math.round(totalEarnings * 0.9);
    const pendingOrdersCount = orders.filter(
      (o) => o.status === 'pending' || o.status === 'processing'
    ).length;

    const activeProductsCount = products.filter(
      (p) => p.is_active !== false && Number(p.inventory ?? 0) > 0
    ).length;

    return {
      totalEarnings,
      netSettled,
      pendingOrdersCount,
      activeProductsCount,
    };
  }, [orders, products]);

  const unreadTransactionsCount = useMemo(() => {
    return transactions.filter((t) => !seenTxIds.includes(t.id)).length;
  }, [transactions, seenTxIds]);

  const totalSidebarAlerts = metrics.pendingOrdersCount + openIssuesCount;

  const handleOpenBellModal = () => {
    Haptics.selectionAsync();
    setBellModalVisible(true);
    setSeenTxIds(transactions.map((t) => t.id));
  };

  const handleBecomeSeller = async () => {
    if (!user?.id) return;
    setActivatingRole(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'seller',
      } as any);
      await refreshProfile();
      GooeyToast.success('Seller Hub Activated!', 'Welcome to your LinkUp Merchant Dashboard.');
      fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Activation Error', err?.message || 'Could not activate seller role.');
    } finally {
      setActivatingRole(false);
    }
  };

  const handleUpdateProduct = async (updatedProduct: any) => {
    setIsUpdatingProduct(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          title: updatedProduct.title,
          price: Number(updatedProduct.price),
          inventory: Number(updatedProduct.inventory),
          description: updatedProduct.description,
          sizes: updatedProduct.sizes || [],
        } as any)
        .eq('id', updatedProduct.id);

      if (error) throw error;
      GooeyToast.success('Product Updated', 'Changes saved to your inventory.');
      await fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Update Failed', err?.message || 'Could not update product.');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      GooeyToast.success('Product Removed', 'Listing deleted from your store.');
      await fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Delete Failed', err?.message || 'Could not delete product.');
    }
  };

  const handleToggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: isActive } as any)
        .eq('id', productId);

      if (error) throw error;
      GooeyToast.success(
        isActive ? 'Listing Activated' : 'Listing Paused',
        isActive ? 'Product is now visible to buyers.' : 'Product hidden from storefront.'
      );
      await fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Status Error', err?.message || 'Could not toggle listing status.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setIsUpdatingOrderStatus(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status } as any)
        .eq('id', orderId);

      if (error) throw error;
      GooeyToast.success('Order Updated', `Order marked as ${status.replace(/_/g, ' ')}.`);
      await fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Order Update Failed', err?.message || 'Could not update order status.');
    } finally {
      setIsUpdatingOrderStatus(false);
    }
  };

  const handleBroadcastOrder = async (payload: {
    orderId: string;
    zone: string;
    zoneId: string;
    pickupAddress: string;
    pickupTime: string;
    lat?: number;
    lng?: number;
    riderId?: string;
    orderNumber?: string;
  }) => {
    setIsBroadcastingOrder(true);
    try {
      const isDirectAssign = Boolean(payload.riderId);
      const targetOrder = orders.find((o) => o.id === payload.orderId);
      const recipient =
        targetOrder?.order_recipient?.[0] ||
        targetOrder?.order_recipient ||
        targetOrder?.shipping_address ||
        {};
      const deliveryAddress =
        typeof recipient === 'string'
          ? recipient
          : recipient.address_line || recipient.address || 'Customer Delivery Address';

      if (!isDirectAssign) {
        let broadcastFunctionSucceeded = false;
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke(
            'broadcast-order',
            {
              body: {
                id: payload.orderId,
                zone: payload.zone,
                zoneId: payload.zoneId,
                cityId: profile?.city_id,
                pickupAddress: payload.pickupAddress,
                deliveryAddress,
                pickupTime: payload.pickupTime,
                lat: payload.lat,
                lng: payload.lng,
              },
            }
          );
          if (!fnError && fnData?.success) {
            broadcastFunctionSucceeded = true;
          }
        } catch (fnErr) {
          console.warn('[SellerDashboardScreen] Edge function broadcast-order notice:', fnErr);
        }

        // Direct database updates to guarantee state change regardless of edge function availability
        if (!broadcastFunctionSucceeded) {
          // 1. Update orders table (ONLY valid columns on orders: status, updated_at)
          const { error: orderErr } = await supabase
            .from('orders')
            .update({
              status: 'awaiting_agent',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', payload.orderId);
          if (orderErr) throw orderErr;

          // 2. Update or insert shipments table (where pickup_address belongs!)
          const { data: existingShipment } = await supabase
            .from('shipments')
            .select('id')
            .eq('order_id', payload.orderId)
            .maybeSingle();

          if (existingShipment) {
            const { error: shipErr } = await supabase
              .from('shipments')
              .update({
                pickup_address: payload.pickupAddress,
                zone_id: payload.zoneId || undefined,
                status: 'pending',
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', existingShipment.id);
            if (shipErr) console.warn('[SellerDashboardScreen] Shipment update warning:', shipErr);
          } else {
            const { error: shipInsertErr } = await supabase
              .from('shipments')
              .insert({
                order_id: payload.orderId,
                seller_id: user?.id,
                pickup_address: payload.pickupAddress,
                delivery_address: deliveryAddress,
                zone_id: payload.zoneId || null,
                status: 'pending',
              } as any);
            if (shipInsertErr) console.warn('[SellerDashboardScreen] Shipment insert warning:', shipInsertErr);
          }
        }
      } else {
        // Direct assignment to a selected rider
        // 1. Update orders table (valid status: 'accepted', updated_at)
        const { error: orderErr } = await supabase
          .from('orders')
          .update({
            status: 'accepted',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', payload.orderId);
        if (orderErr) throw orderErr;

        // 2. Update or insert shipments table (with pickup_address & rider_id)
        const { data: existingShipment } = await supabase
          .from('shipments')
          .select('id')
          .eq('order_id', payload.orderId)
          .maybeSingle();

        if (existingShipment) {
          const { error: shipErr } = await supabase
            .from('shipments')
            .update({
              pickup_address: payload.pickupAddress,
              rider_id: payload.riderId,
              zone_id: payload.zoneId || undefined,
              status: 'assigned',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', existingShipment.id);
          if (shipErr) console.warn('[SellerDashboardScreen] Shipment update warning:', shipErr);
        } else {
          const { error: shipInsertErr } = await supabase
            .from('shipments')
            .insert({
              order_id: payload.orderId,
              seller_id: user?.id,
              rider_id: payload.riderId,
              pickup_address: payload.pickupAddress,
              delivery_address: deliveryAddress,
              zone_id: payload.zoneId || null,
              status: 'assigned',
            } as any);
          if (shipInsertErr) console.warn('[SellerDashboardScreen] Shipment insert warning:', shipInsertErr);
        }

        // 3. Notify the assigned rider
        await supabase.from('notifications').insert({
          user_id: payload.riderId,
          title: 'New Delivery Invitation 🏍️',
          message: `You have been selected to deliver order #${payload.orderNumber || payload.orderId.slice(0, 8)} from ${payload.pickupAddress}.`,
          type: 'delivery',
        } as any);
      }

      // Notify the buyer that their order has been accepted by the seller
      const buyerId = targetOrder?.buyer_id || (targetOrder as any)?.buyer?.id;
      if (buyerId) {
        const orderNum = payload.orderNumber || payload.orderId.slice(0, 8).toUpperCase();
        const buyerTitle = 'Order Accepted! 🛍️';
        const buyerMessage = `Your order #${orderNum} has been accepted by the seller and is being prepared for dispatch!`;

        await supabase.from('notifications').insert({
          user_id: buyerId,
          title: buyerTitle,
          message: buyerMessage,
          type: 'order',
        } as any);

        supabase.functions.invoke('send-push', {
          body: {
            target_user_id: buyerId,
            title: buyerTitle,
            message: buyerMessage,
            url: `/orders/${payload.orderId}`,
            type: 'order',
            save_notification: false,
          },
        }).catch((err) => console.warn('[SellerDashboardScreen] Buyer push notice:', err));
      }

      // Send push notification to the assigned rider or zone riders
      if (isDirectAssign && payload.riderId) {
        supabase.functions.invoke('send-push', {
          body: {
            target_user_id: payload.riderId,
            title: 'New Delivery Invitation 🏍️',
            message: `You have been selected to deliver order #${payload.orderNumber || payload.orderId.slice(0, 8)} from ${payload.pickupAddress}.`,
            url: '/logistics',
            type: 'mission',
            save_notification: false,
          },
        }).catch((err) => console.warn('[SellerDashboardScreen] Rider direct push notice:', err));
      } else if (!isDirectAssign) {
        supabase.functions.invoke('send-push', {
          body: {
            zone_id: payload.zoneId,
            role: 'logistics',
            title: '⚡ New Delivery Mission!',
            message: `New mission available in ${payload.zone || 'your zone'}! Tap to view route and claim.`,
            url: '/logistics',
            type: 'mission',
            save_notification: false,
          },
        }).catch((err) => console.warn('[SellerDashboardScreen] Zone couriers push notice:', err));
      }

      GooeyToast.success(
        isDirectAssign ? 'Rider Assigned!' : 'Order Broadcasted!',
        isDirectAssign
          ? 'Direct delivery invitation sent to the selected courier.'
          : `Order broadcasted to verified couriers in ${payload.zone || 'your zone'}.`
      );
      await fetchDashboardData();
    } catch (err: any) {
      GooeyToast.error('Dispatch Failed', err?.message || 'Could not broadcast order.');
    } finally {
      setIsBroadcastingOrder(false);
    }
  };

  const paginatedProducts = useMemo(() => {
    const start = (productsPage - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, productsPage]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * PAGE_SIZE;
    return orders.slice(start, start + PAGE_SIZE);
  }, [orders, ordersPage]);

  const sidebarCounts = useMemo(
    () => ({
      totalProducts: products.length,
      activeProducts: metrics.activeProductsCount,
      pendingOrders: metrics.pendingOrdersCount,
      openIssues: openIssuesCount,
    }),
    [products.length, metrics.activeProductsCount, metrics.pendingOrdersCount, openIssuesCount]
  );

  if (!user) {
    return (
      <SafeView style={styles.centeredScreen}>
        <Store size={48} color={colors.primary} />
        <Text style={styles.promptTitle}>Merchant Sign In Required</Text>
        <Text style={styles.promptSub}>
          Please sign in to access your LinkUp Seller Hub, inventory, and wallet.
        </Text>
        <TouchableOpacity
          style={styles.primaryCtaBtn}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryCtaText}>Sign In</Text>
        </TouchableOpacity>
      </SafeView>
    );
  }

  if (!loading && !isSeller) {
    return (
      <SafeView style={styles.centeredScreen}>
        <View style={styles.heroIconWrap}>
          <Sparkles size={36} color={colors.primary} />
        </View>
        <Text style={styles.promptTitle}>Launch Your LinkUp Store</Text>
        <Text style={styles.promptSub}>
          List products across Nigeria, connect with verified logistics riders, and receive instant escrow-protected payouts.
        </Text>
        <TouchableOpacity
          style={[styles.primaryCtaBtn, activatingRole && { opacity: 0.7 }]}
          disabled={activatingRole}
          onPress={handleBecomeSeller}
        >
          {activatingRole ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Store size={18} color="#FFFFFF" />
              <Text style={styles.primaryCtaText}>Activate Seller Hub</Text>
            </>
          )}
        </TouchableOpacity>
      </SafeView>
    );
  }

  return (
    <SafeView style={styles.container} edges={['top']}>
      <View style={styles.mainLayout}>
        {/* Docked Sidebar on Tablets / Large Screens */}
        {isLargeScreen && (
          <SellerSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            activeTab={activeTab}
            onSelectTab={(k) => setActiveTab(k)}
            counts={sidebarCounts}
            wallet={wallet}
            profile={profile}
            verification={verification}
            onNavigateVerification={() => navigation.navigate('SellerVerification')}
            onExitToStore={() => navigation.navigate('MainTabs')}
            onLogout={handleLogout}
            isLargeScreen={true}
          />
        )}

        {/* Main Content Column */}
        <View style={styles.contentColumn}>
          {/* Top Bar */}
          <View style={styles.topHeader}>
            <View style={styles.headerLeft}>
              {/* Sidebar Hamburger / Toggle Trigger */}
              <TouchableOpacity
                style={[
                  styles.menuTriggerBtn,
                  isSidebarOpen && isLargeScreen && styles.menuTriggerBtnActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsSidebarOpen((prev) => !prev);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Toggle seller navigation sidebar"
              >
                <Menu
                  size={20}
                  color={
                    isSidebarOpen && isLargeScreen
                      ? colors.primary
                      : colors.foreground
                  }
                  strokeWidth={2.4}
                />
                {totalSidebarAlerts > 0 && <View style={styles.menuAlertDot} />}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <View style={styles.storeTitleRow}>
                  <Text style={styles.storeTitle} numberOfLines={1}>
                    {TAB_TITLES[activeTab] || 'Seller Hub'}
                  </Text>
                  {verification?.status === 'verified' && (
                    <View style={styles.verifiedChip}>
                      <ShieldCheck size={12} color="#059669" />
                      <Text style={styles.verifiedChipText}>Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.storeSubtitle} numberOfLines={1}>
                  {verification?.business_name ||
                    profile?.display_name ||
                    'LinkUp Merchant Console'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* Wallet Transactions Notification Bell */}
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={handleOpenBellModal}
              >
                <Bell size={18} color={colors.foreground} />
                {unreadTransactionsCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadTransactionsCount > 9 ? '9+' : unreadTransactionsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('list-product');
                }}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.quickAddText}>List</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading your Seller Hub...</Text>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <ScrollView
                ref={dashboardScrollRef}
                style={styles.mainScroll}
                contentContainerStyle={[
                  styles.mainScrollContent,
                  isKeyboardVisible && { paddingBottom: Math.max(380, keyboardHeight + 80) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onPullRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            >
              {/* Verification Alert Banner if not verified */}
              {verification?.status !== 'verified' && (
                <TouchableOpacity
                  style={[
                    styles.kycBanner,
                    verification?.status === 'pending' && styles.kycBannerPending,
                    verification?.status === 'rejected' && styles.kycBannerRejected,
                  ]}
                  onPress={() => navigation.navigate('SellerVerification')}
                >
                  <View style={styles.kycBannerIcon}>
                    {verification?.status === 'pending' ? (
                      <Clock size={18} color="#D97706" />
                    ) : (
                      <ShieldCheck
                        size={18}
                        color={
                          verification?.status === 'rejected' ? '#DC2626' : colors.primary
                        }
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kycBannerTitle}>
                      {verification?.status === 'pending'
                        ? 'KYC Verification Under Review'
                        : verification?.status === 'rejected'
                          ? 'KYC Verification Rejected — Tap to Resubmit'
                          : 'Complete Seller KYC Verification'}
                    </Text>
                    <Text style={styles.kycBannerSub}>
                      {verification?.status === 'pending'
                        ? 'Our team is reviewing your documents. You can prepare inventory in the meantime.'
                        : verification?.status === 'rejected'
                          ? verification?.rejection_reason ||
                          'Please update your documents to unlock full store privileges.'
                          : 'Verify your identity & bank details to earn the Verified badge and withdraw funds.'}
                    </Text>
                  </View>
                  <ArrowUpRight size={16} color={colors.foreground} />
                </TouchableOpacity>
              )}

              {/* Metric Cards Overview Row (matching MetricCards.tsx) */}
              {(activeTab === 'products' ||
                activeTab === 'orders' ||
                activeTab === 'analytics') && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.metricCardsScroll}
                  >
                    <TouchableOpacity
                      style={[styles.metricCard, styles.metricCardPrimary]}
                      activeOpacity={0.9}
                      onPress={() => setActiveTab('wallet')}
                    >
                      <View style={styles.metricCardTop}>
                        <Wallet size={16} color="rgba(255,255,255,0.85)" />
                        <Text style={styles.metricTagLight}>WALLET</Text>
                      </View>
                      <Text style={styles.metricBigLight}>
                        ₦{Number(wallet?.balance ?? wallet?.available_balance ?? 0).toLocaleString()}
                      </Text>
                      <Text style={styles.metricSubLight}>
                        Escrow: ₦{Number(wallet?.escrow_balance || 0).toLocaleString()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.metricCard}
                      activeOpacity={0.9}
                      onPress={() => setActiveTab('analytics')}
                    >
                      <View style={styles.metricCardTop}>
                        <TrendingUp size={16} color={colors.primary} />
                        <Text style={styles.metricTag}>REVENUE</Text>
                      </View>
                      <Text style={styles.metricBigVal}>
                        ₦{metrics.totalEarnings.toLocaleString()}
                      </Text>
                      <Text style={styles.metricSub}>
                        Net: ₦{metrics.netSettled.toLocaleString()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.metricCard}
                      activeOpacity={0.9}
                      onPress={() => setActiveTab('orders')}
                    >
                      <View style={styles.metricCardTop}>
                        <ShoppingBag size={16} color="#2563EB" />
                        <Text style={styles.metricTag}>ORDERS</Text>
                      </View>
                      <Text style={styles.metricBigVal}>{orders.length}</Text>
                      <Text style={styles.metricSub}>
                        {metrics.pendingOrdersCount} awaiting action
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.metricCard}
                      activeOpacity={0.9}
                      onPress={() => setActiveTab('products')}
                    >
                      <View style={styles.metricCardTop}>
                        <Package size={16} color="#059669" />
                        <Text style={styles.metricTag}>INVENTORY</Text>
                      </View>
                      <Text style={styles.metricBigVal}>{products.length}</Text>
                      <Text style={styles.metricSub}>
                        {metrics.activeProductsCount} active listings
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}

              {/* Active Tab View */}
              {activeTab === 'products' && (
                <SellerInventoryTab
                  products={paginatedProducts}
                  totalProducts={products.length}
                  productsPage={productsPage}
                  setProductsPage={setProductsPage}
                  pageSize={PAGE_SIZE}
                  onListProduct={() => setActiveTab('list-product')}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onToggleStatus={handleToggleProductStatus}
                  isUpdating={isUpdatingProduct}
                />
              )}

              {activeTab === 'list-product' && (
                <SellerListProductTab
                  scrollRef={dashboardScrollRef}
                  applyPlatformMarkup={false}
                  onSuccess={() => {
                    fetchDashboardData();
                    setActiveTab('products');
                  }}
                />
              )}

              {activeTab === 'orders' && (
                <SellerOrdersTab
                  orders={paginatedOrders}
                  totalOrders={orders.length}
                  ordersPage={ordersPage}
                  setOrdersPage={setOrdersPage}
                  pageSize={PAGE_SIZE}
                  sellerZone={profile?.zone}
                  sellerZoneId={profile?.zone_id || verification?.zone_id}
                  sellerCityId={profile?.city_id || verification?.city_id}
                  sellerAddress={profile?.address || verification?.business_address}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onBroadcastOrder={handleBroadcastOrder}
                  isUpdatingStatus={isUpdatingOrderStatus}
                  isBroadcasting={isBroadcastingOrder}
                />
              )}

              {activeTab === 'wallet' && (
                <SellerWalletTab
                  wallet={wallet}
                  transactions={transactions}
                  onRefreshWallet={fetchDashboardData}
                />
              )}

              {activeTab === 'analytics' && (
                <SellerAnalyticsTab
                  totalEarnings={metrics.totalEarnings}
                  netSettled={metrics.netSettled}
                  ordersCount={orders.length}
                  escrowBalance={Number(wallet?.escrow_balance || 0)}
                  orders={orders}
                />
              )}

              {activeTab === 'issues' && (
                <SellerIssuesTab
                  userId={user.id}
                  onIssuesCountChange={setOpenIssuesCount}
                  onContactSupport={() => navigation.navigate('Support')}
                />
              )}

              {activeTab === 'payments' && (
                <SellerPaymentsTab
                  userId={user.id}
                  onRefreshDashboard={fetchDashboardData}
                />
              )}

              {activeTab === 'profile' && (
                <SellerProfileTab
                  userId={user.id}
                  userEmail={user.email}
                  profile={profile}
                  verification={verification}
                  onRefresh={fetchDashboardData}
                  onNavigateVerification={() =>
                    navigation.navigate('SellerVerification')
                  }
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        </View>
      </View>

      {/* Responsive Off-Canvas Sliding Sidebar on Mobile */}
      {!isLargeScreen && (
        <SellerSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={activeTab}
          onSelectTab={(k) => setActiveTab(k)}
          counts={sidebarCounts}
          wallet={wallet}
          profile={profile}
          verification={verification}
          onNavigateVerification={() => navigation.navigate('SellerVerification')}
          onExitToStore={() => navigation.navigate('MainTabs')}
          onLogout={handleLogout}
          isLargeScreen={false}
        />
      )}

      {/* Wallet Transactions Notification Modal (matching WalletTransactionsNotification.tsx) */}
      <Modal
        visible={bellModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBellModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Wallet Activity</Text>
                <Text style={styles.modalSub}>
                  Recent credits, escrow releases & withdrawals
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setBellModalVisible(false)}
              >
                <X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              {transactions.length === 0 ? (
                <View style={styles.emptyBellBox}>
                  <Bell size={28} color="#94A3B8" />
                  <Text style={styles.emptyBellTitle}>No Wallet Alerts Yet</Text>
                  <Text style={styles.emptyBellSub}>
                    Order settlements and payouts will appear here in real time.
                  </Text>
                </View>
              ) : (
                transactions.slice(0, 15).map((tx: any, idx: number) => {
                  const isCredit =
                    tx.type === 'credit' ||
                    tx.type === 'settlement' ||
                    tx.type === 'escrow_release' ||
                    Number(tx.amount || 0) > 0;
                  return (
                    <View key={tx.id || idx} style={styles.txNotifRow}>
                      <View
                        style={[
                          styles.txNotifIcon,
                          {
                            backgroundColor: isCredit ? '#ECFDF5' : '#FEF2F2',
                          },
                        ]}
                      >
                        {isCredit ? (
                          <CheckCircle2 size={16} color="#059669" />
                        ) : (
                          <ArrowDownToLine size={16} color="#DC2626" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txNotifTitle} numberOfLines={1}>
                          {tx.description ||
                            (isCredit ? 'Order Settlement Credit' : 'Wallet Withdrawal')}
                        </Text>
                        <Text style={styles.txNotifDate}>
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleString()
                            : 'Recent'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.txNotifAmt,
                          { color: isCredit ? '#059669' : '#DC2626' },
                        ]}
                      >
                        {isCredit ? '+' : '-'}₦
                        {Math.abs(Number(tx.amount || 0)).toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentColumn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  heroIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.foreground,
    textAlign: 'center',
    marginTop: 10,
  },
  promptSub: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
    marginBottom: 22,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 16,
    minWidth: 210,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  menuTriggerBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  menuAlertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: 6,
    right: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.foreground,
    maxWidth: 185,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  storeSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF3EC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  kycBannerPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  kycBannerRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  kycBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.foreground,
  },
  kycBannerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  metricCardsScroll: {
    gap: 10,
    paddingBottom: 2,
  },
  metricCard: {
    width: 158,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricCardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  metricCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  metricTagLight: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.6,
  },
  metricBigVal: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.foreground,
  },
  metricBigLight: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  metricSub: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 3,
    fontWeight: '600',
  },
  metricSubLight: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  modalSub: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBellBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyBellTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  emptyBellSub: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  txNotifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  txNotifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txNotifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  txNotifDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txNotifAmt: {
    fontSize: 13,
    fontWeight: '900',
  },
});
