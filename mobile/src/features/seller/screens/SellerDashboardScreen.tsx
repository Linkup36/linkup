import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import {
  Menu,
  Plus,
  Wallet,
  ArrowLeft,
  Package,
  ShoppingBag,
  AlertCircle,
  TrendingUp,
  CreditCard,
  UserCheck,
} from 'lucide-react-native';

// Modular Components
import { SellerSidebar, SellerTab, SELLER_TABS } from '../components/SellerSidebar';
import { InventoryTab } from '../components/InventoryTab';
import { OrdersTab } from '../components/OrdersTab';
import { WalletTab } from '../components/WalletTab';
import { AnalyticsTab } from '../components/AnalyticsTab';
import { IssuesTab } from '../components/IssuesTab';
import { PaymentReconciliationTab } from '../components/PaymentReconciliationTab';
import { ProfileTab } from '../components/ProfileTab';
import { ProfileCompletionBanner } from '../components/ProfileCompletionBanner';
import { EditProductModal } from '../components/EditProductModal';
import { ZoneBroadcastModal } from '../components/ZoneBroadcastModal';
import { PayoutRequestModal } from '../components/PayoutRequestModal';

const PAGE_SIZE = 10;

export function SellerDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, refreshProfile, signOut } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<SellerTab>('products');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Modals State
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [broadcastOrderId, setBroadcastOrderId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  // Data States
  const [products, setProducts] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [productsPage, setProductsPage] = useState(0);

  const [orders, setOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);

  const [wallet, setWallet] = useState<any>({ balance: 0, escrow_balance: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [sellerProfile, setSellerProfile] = useState<any>(null);

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    netRevenue: 0,
    pendingOrdersCount: 0,
    openIssuesCount: 0,
  });

  // 1. Fetch Products
  const fetchProducts = useCallback(async () => {
    if (!user) return;
    try {
      const from = productsPage * PAGE_SIZE;
      const to = (productsPage + 1) * PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from('products')
        .select('id, title, price, inventory, images, description, is_active, category, sizes', {
          count: 'exact',
        })
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setProducts(data);
        setTotalProducts(count || 0);
      }
    } catch (e) {
      console.warn('Error fetching seller products:', e);
    }
  }, [user, productsPage]);

  // 2. Fetch Orders (Strict privacy: buyer phone/email hidden)
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const from = ordersPage * PAGE_SIZE;
      const to = (ordersPage + 1) * PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from('orders')
        .select(
          `
          id, status, created_at, grand_total, total_amount,
          order_settlements (
            seller_amount,
            status
          ),
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
            city_id,
            zone_id,
            cities (name),
            delivery_zones (name)
          ),
          shipments (
            id,
            status,
            tracking_code,
            zone_id,
            delivery_fee
          )
        `,
          { count: 'exact' }
        )
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Seller orders fetch error:', error);
      } else if (data) {
        setOrders(data);
        setTotalOrders(count || 0);

        // Count pending orders
        const pendingCount = data.filter((o) => o.status === 'pending').length;
        setMetrics((prev) => ({ ...prev, pendingOrdersCount: pendingCount }));
      }
    } catch (e) {
      console.warn('Error fetching seller orders:', e);
    }
  }, [user, ordersPage]);

  // 3. Fetch Wallet, Transactions & Payout Requests
  const fetchWallet = useCallback(async () => {
    if (!user) return;
    try {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) {
        console.warn('Error fetching wallet:', walletError);
      }

      if (walletData) {
        setWallet(walletData);

        const { data: txData, error: txError } = await supabase
          .from('wallet_transactions')
          .select('id, amount, type, reference, created_at, status')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txError) {
          console.warn('Error fetching wallet transactions:', txError);
        } else if (txData) {
          setTransactions(txData);
          const netRev = txData
            .filter((t) => t.type === 'settlement' || t.type === 'credit')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
          setMetrics((prev) => ({ ...prev, netRevenue: netRev }));
        }
      }

      // Fetch Payout Requests History
      const { data: pData, error: pError } = await supabase
        .from('payout_requests')
        .select('id, amount, fee_amount, status, created_at, bank_name, account_number, account_name, admin_notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (pError) {
        console.warn('Error fetching payout requests:', pError);
      } else if (pData) {
        setPayoutRequests(pData);
      }
    } catch (e) {
      console.warn('Error fetching wallet data:', e);
    }
  }, [user]);

  // 4. Fetch Issues
  const fetchIssues = useCallback(async () => {
    if (!user) return;
    try {
      const { data, count } = await (supabase as any)
        .from('issues')
        .select('id, title, description, status, priority, created_at, order_id', { count: 'exact' })
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setIssues(data);
        const openCount = data.filter((i: any) => i.status === 'open').length;
        setMetrics((prev) => ({ ...prev, openIssuesCount: openCount }));
      }
    } catch (e) {
      console.warn('Error fetching issues:', e);
    }
  }, [user]);

  // 5. Fetch Payment Reconciliation Records
  const fetchSettlements = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('order_settlements')
        .select(`
          id,
          order_id,
          status,
          created_at,
          seller_amount,
          orders!inner (
            id,
            grand_total,
            payment_status,
            payment_ref,
            payment_method,
            created_at,
            status
          )
        `)
        .eq('orders.seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        const mapped = data.map((settlement: any) => ({
          id: settlement.orders?.id || settlement.order_id,
          grand_total: settlement.orders?.grand_total,
          status: settlement.orders?.status,
          payment_status: settlement.orders?.payment_status,
          payment_ref: settlement.orders?.payment_ref,
          payment_method: settlement.orders?.payment_method,
          created_at: settlement.orders?.created_at || settlement.created_at,
          settlement_status: settlement.status,
          seller_amount: settlement.seller_amount,
        }));
        setSettlements(mapped);

        const totalSales = mapped.reduce(
          (sum: number, s: any) => sum + (Number(s.seller_amount) || Number(s.grand_total) || 0),
          0
        );
        setMetrics((prev) => ({ ...prev, totalRevenue: totalSales }));
      }
    } catch (e) {
      console.warn('Error fetching settlements:', e);
    }
  }, [user]);

  // 6. Fetch Full Profile & Verification Details
  const fetchProfileDetails = useCallback(async () => {
    if (!user) return;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select(
          'id, user_id, display_name, phone, bio, email, address, city_id, zone_id, payout_bank_name, payout_account_number, payout_account_name'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: verif } = await supabase
        .from('seller_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSellerProfile({
        ...(prof || profile),
        verification: verif,
      });
    } catch (e) {
      console.warn('Error fetching profile details:', e);
    }
  }, [user, profile]);

  // Initial Load
  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchOrders(),
      fetchWallet(),
      fetchIssues(),
      fetchSettlements(),
      fetchProfileDetails(),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, [
    fetchProducts,
    fetchOrders,
    fetchWallet,
    fetchIssues,
    fetchSettlements,
    fetchProfileDetails,
  ]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Realtime Subscriptions for Orders & Wallet
  useEffect(() => {
    if (!user) return;

    const orderCh = supabase
      .channel(`mobile-seller-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchOrders();
          fetchSettlements();
        }
      )
      .subscribe();

    const walletCh = supabase
      .channel(`mobile-seller-wallet-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWallet();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWallet();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
        },
        () => {
          fetchWallet();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderCh);
      supabase.removeChannel(walletCh);
    };
  }, [user, fetchOrders, fetchSettlements, fetchWallet]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // Actions
  const handleToggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      Haptics.selectionAsync().catch(() => {});
      const { error } = await (supabase as any)
        .from('products')
        .update({ is_active: isActive })
        .eq('id', productId);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: isActive } : p))
      );
      toast.success('Product Availability Updated');
    } catch (e: any) {
      toast.error('Update Failed: ' + e.message);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setTotalProducts((prev) => Math.max(0, prev - 1));
      toast.success('Product removed from inventory');
    } catch (e: any) {
      toast.error('Delete Failed: ' + e.message);
    }
  };

  const handleSaveProductEdit = async (updatedProduct: any) => {
    setIsSavingProduct(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          title: updatedProduct.title,
          price: updatedProduct.price,
          inventory: updatedProduct.inventory,
          description: updatedProduct.description,
        })
        .eq('id', updatedProduct.id);

      if (error) throw error;
      toast.success('Product updated successfully');
      setEditingProduct(null);
      fetchProducts();
    } catch (e: any) {
      toast.error('Failed to update product: ' + e.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      Haptics.selectionAsync().catch(() => {});
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      toast.success('Order status updated');
      fetchOrders();
    } catch (e: any) {
      toast.error('Failed to update order: ' + e.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleBroadcastOrder = async (
    zone: string,
    zoneId: string,
    pickupAddress: string,
    pickupTime: string
  ) => {
    if (!broadcastOrderId) return;
    setIsBroadcasting(true);
    try {
      const order = orders.find((o) => o.id === broadcastOrderId);
      const recipient = order?.order_recipient || {};
      const deliveryAddress = `${recipient.address_line || ''}, ${recipient.cities?.name || ''}, ${
        recipient.delivery_zones?.name || ''
      }`;

      // Invoke broadcast-order edge function with fallback
      const { data, error } = await supabase.functions.invoke('broadcast-order', {
        body: {
          id: broadcastOrderId,
          zone,
          zoneId,
          cityId: (sellerProfile as any)?.city_id,
          pickupAddress,
          deliveryAddress,
          pickupTime,
        },
      });

      if (error || !data?.success) {
        // Fallback update order status to awaiting_agent directly
        await supabase.from('orders').update({ status: 'awaiting_agent' }).eq('id', broadcastOrderId);
      }

      toast.success('Order broadcasted! Waiting for an agent to claim.');
      setBroadcastOrderId(null);
      fetchOrders();
    } catch (e: any) {
      toast.error('Broadcast note: ' + (e.message || 'Updated status to finding partner'));
      setBroadcastOrderId(null);
      fetchOrders();
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleUpdateProfile = async (formData: any) => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          phone: formData.phone,
          bio: formData.bio,
          email: formData.email,
          payout_bank_name: formData.payout_bank_name,
          payout_account_number: formData.payout_account_number,
          payout_account_name: formData.payout_account_name,
        })
        .eq('user_id', user.id);

      if (profError) throw profError;

      if (formData.business_name || formData.business_address) {
        await supabase
          .from('seller_verifications')
          .update({
            business_name: formData.business_name,
            business_address: formData.business_address,
          })
          .eq('user_id', user.id);
      }

      toast.success('Store profile updated successfully');
      refreshProfile();
      fetchProfileDetails();
    } catch (e: any) {
      toast.error('Profile update failed: ' + e.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleTabChange = (tab: SellerTab) => {
    Haptics.selectionAsync().catch(() => {});
    if (tab === 'list-product') {
      navigation.navigate('ListProduct', {});
      return;
    }
    setActiveTab(tab);
  };

  return (
    <SafeView>
      {/* Top Header matching Web Navbar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setIsSidebarOpen(true)}
            activeOpacity={0.7}
          >
            <Menu size={20} color="#0f172a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.brandTitle}>LinkUp</Text>
            <Text style={styles.brandBadge}>Merchant Portal</Text>
          </View>
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.addShortcutBtn}
            onPress={() => navigation.navigate('ListProduct', {})}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" strokeWidth={3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.walletShortcutBtn}
            onPress={() => setActiveTab('wallet')}
            activeOpacity={0.8}
          >
            <Wallet size={18} color={colors.primary} />
            <Text style={styles.walletShortcutText}>
              ₦{(wallet?.balance || 0).toLocaleString()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Tabs Quick Switcher */}
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {SELLER_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            const hasBadge =
              (id === 'orders' && metrics.pendingOrdersCount > 0) ||
              (id === 'issues' && metrics.openIssuesCount > 0);

            return (
              <TouchableOpacity
                key={id}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => handleTabChange(id)}
                activeOpacity={0.75}
              >
                <Icon
                  size={15}
                  color={isActive ? '#ffffff' : '#475569'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                  {label}
                </Text>
                {hasBadge && (
                  <View style={styles.tabDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Completion Warning Banner */}
        <ProfileCompletionBanner
          profile={sellerProfile || profile}
          onAction={() => setActiveTab('profile')}
        />

        {/* Tab 1: Products / Inventory */}
        {activeTab === 'products' && (
          <InventoryTab
            products={products}
            totalProducts={totalProducts}
            productsPage={productsPage}
            setProductsPage={setProductsPage}
            pageSize={PAGE_SIZE}
            onEditProduct={(p) => setEditingProduct(p)}
            onDeleteProduct={handleDeleteProduct}
            onToggleStatus={handleToggleProductStatus}
            onListProduct={() => navigation.navigate('ListProduct', {})}
            loading={loading}
          />
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            totalOrders={totalOrders}
            ordersPage={ordersPage}
            setOrdersPage={setOrdersPage}
            pageSize={PAGE_SIZE}
            onUpdateStatus={handleUpdateOrderStatus}
            onInitiateBroadcast={(orderId) => setBroadcastOrderId(orderId)}
            updatingOrderId={updatingOrderId}
            loading={loading}
          />
        )}

        {/* Tab 3: Wallet */}
        {activeTab === 'wallet' && (
          <WalletTab
            wallet={wallet}
            transactions={transactions}
            payoutRequests={payoutRequests}
            onRequestPayout={() => setIsPayoutModalOpen(true)}
            loading={loading}
          />
        )}

        {/* Tab 4: Insights / Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            revenue={metrics.totalRevenue}
            netRevenue={metrics.netRevenue}
            escrowBalance={wallet?.escrow_balance || 0}
            totalOrders={totalOrders}
          />
        )}

        {/* Tab 5: Issues */}
        {activeTab === 'issues' && (
          <IssuesTab issues={issues} loading={loading} />
        )}

        {/* Tab 6: Payment Reconciliation */}
        {activeTab === 'payments' && (
          <PaymentReconciliationTab settlements={settlements} loading={loading} />
        )}

        {/* Tab 7: Profile */}
        {activeTab === 'profile' && (
          <ProfileTab
            profile={sellerProfile || profile}
            onUpdate={handleUpdateProfile}
            isUpdating={isUpdatingProfile}
            onNavigateKYC={() => navigation.navigate('SellerVerification')}
          />
        )}
      </ScrollView>

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProductEdit}
        isSaving={isSavingProduct}
      />

      {/* Zone Broadcast Modal */}
      <ZoneBroadcastModal
        visible={Boolean(broadcastOrderId)}
        onClose={() => setBroadcastOrderId(null)}
        onBroadcast={handleBroadcastOrder}
        isBroadcasting={isBroadcasting}
        defaultZone={(sellerProfile as any)?.zone || undefined}
        defaultPickupAddress={
          sellerProfile?.verification?.business_address || sellerProfile?.address || undefined
        }
      />

      {/* Payout / Withdrawal Request Modal */}
      <PayoutRequestModal
        visible={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        wallet={wallet}
        onSuccess={() => {
          fetchWallet();
          fetchSettlements();
        }}
      />

      {/* Sliding Sidebar Drawer */}
      <SellerSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        pendingOrdersCount={metrics.pendingOrdersCount}
        openIssuesCount={metrics.openIssuesCount}
        profile={sellerProfile || profile}
        wallet={wallet}
        onExitToStore={() => navigation.navigate('Main', { screen: 'Home' } as any)}
        onLogout={async () => {
          await signOut();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }}
      />
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  brandBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addShortcutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  walletShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  walletShortcutText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
  },
  tabsBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  tabsScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
