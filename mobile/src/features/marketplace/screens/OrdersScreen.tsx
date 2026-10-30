import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { AuthGuard } from '../../../components/auth/AuthGuard';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { OrdersHeader } from '../components/OrdersHeader';
import { OrdersTabs } from '../components/OrdersTabs';
import { useNavigation } from '@react-navigation/native';

export function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('all');
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [userIssues, setUserIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatStatus = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'Order Confirmed',
      awaiting_agent: 'Finding Courier...',
      broadcast: 'Finding Courier...',
      accepted: 'Courier Assigned',
      assigned: 'Courier Assigned',
      out_for_pickup: 'Heading to Seller',
      arrived_at_seller: 'Arrived at Pickup',
      picked_up: 'Picked Up & In Transit',
      started: 'Picked Up & In Transit',
      out_for_delivery: 'Heading to You',
      arrived_at_destination: 'Arrived at Hub',
      arrived: 'Arrived',
      shipped: 'Shipped',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
      disputed: 'Under Dispute',
    };
    return (
      map[status.toLowerCase()] ||
      status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
    );
  };

  const fetchOrdersAndIssues = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // 1. Fetch Orders with shipments, recipients, and items
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          *,
          shipments:shipments ( * ),
          order_recipient (
            full_name,
            phone,
            address_line
          ),
          order_items (
            product_id,
            size,
            products (
              title,
              images,
              price
            )
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;

      // 2. Fetch User Issues (Disputes / Reports)
      const { data: issuesData } = await (supabase as any)
        .from('issues')
        .select(`
          *,
          seller:profiles!issues_seller_id_fkey(display_name),
          product:products(title, images)
        `)
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersData) setRawOrders(ordersData);
      if (issuesData) setUserIssues(issuesData);
    } catch (err) {
      console.warn('[OrdersScreen] Error fetching orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchOrdersAndIssues();
  }, [fetchOrdersAndIssues]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrdersAndIssues();
  };

  // Normalize orders like web
  const orders = rawOrders.map((order: any) => {
    const shipmentData = order.shipments;
    const shipment = Array.isArray(shipmentData) ? shipmentData[0] : shipmentData;

    const orderItems = order.order_items || [];
    const normalizedItem = orderItems[0] || null;

    let productData = normalizedItem?.products || null;
    if (Array.isArray(productData)) {
      productData = productData[0];
    }

    const legacyItems = Array.isArray(order.items) ? order.items : [];
    const legacyItem = legacyItems[0] || null;

    const title =
      productData?.title ||
      legacyItem?.title ||
      order.title ||
      `Order #${order.id.slice(0, 8)}`;

    const image =
      productData?.images?.[0] ||
      legacyItem?.image ||
      legacyItem?.images?.[0] ||
      order.image ||
      '';

    const price = order.total_amount || order.total_price || 0;
    const store = 'Linkup Partner';

    const rawStatus = (order.status || 'pending').toLowerCase();
    const activeStatus = ['completed', 'disputed', 'cancelled', 'refunded'].includes(rawStatus)
      ? rawStatus
      : shipment && shipment.status && shipment.status !== 'pending'
      ? shipment.status
      : rawStatus;

    return {
      id: order.id,
      title,
      price,
      image,
      store,
      status: activeStatus,
      displayStatus: formatStatus(activeStatus),
      itemsCount: orderItems.length,
      shipment,
      sellerId: order.seller_id,
      productId: normalizedItem?.product_id,
      size: normalizedItem?.size,
    };
  });

  const isToShip = (s: string) =>
    ['pending', 'confirmed', 'processing', 'awaiting_agent'].includes(s.toLowerCase());
  const isToReceive = (s: string) =>
    [
      'accepted',
      'out_for_pickup',
      'arrived_at_seller',
      'picked_up',
      'out_for_delivery',
      'arrived_at_destination',
      'shipped',
      'delivered',
    ].includes(s.toLowerCase());
  const isCompleted = (s: string) => ['completed'].includes(s.toLowerCase());

  const counts = {
    toShip: orders.filter((o) => isToShip(o.status)).length,
    toReceive: orders.filter((o) => isToReceive(o.status)).length,
    completed: orders.filter((o) => isCompleted(o.status)).length,
    cancelled: orders.filter((o) => o.status.toLowerCase() === 'cancelled').length,
    reports: userIssues.length,
  };

  const filteredOrders =
    activeTab === 'all'
      ? orders
      : orders.filter((o) => {
          const s = o.status.toLowerCase();
          if (activeTab === 'to-ship') return isToShip(s);
          if (activeTab === 'to-receive') return isToReceive(s);
          if (activeTab === 'completed') return isCompleted(s);
          if (activeTab === 'cancelled') return s === 'cancelled';
          return true;
        });

  return (
    <AuthGuard
      fallbackTitle="Order History"
      fallbackDescription="Sign in to view your orders, live courier tracking, and delivery receipts."
    >
      <SafeView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#eb7d30']}
            tintColor="#eb7d30"
          />
        }
      >
        {/* Header matching web with Registry Management & Badges */}
        <OrdersHeader />

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#eb7d30" />
          </View>
        ) : (
          /* Tabs + Orders List matching web */
          <OrdersTabs
            orders={orders}
            filteredOrders={filteredOrders}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            counts={counts}
            userIssues={userIssues}
            onBrowseMarketplace={() => navigation.navigate('HomeTab')}
          />
        )}
      </ScrollView>
    </SafeView>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  loadingCenter: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
