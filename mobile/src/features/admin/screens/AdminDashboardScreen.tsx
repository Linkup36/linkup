import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

import {
  ShieldCheck,
  ArrowLeft,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Truck,
  Wallet,
  Grid,
  Mail,
  RefreshCw,
  Menu,
  Store,
  TrendingUp,
  Bell,
} from 'lucide-react-native';

import { AdminSidebar } from '../components/AdminSidebar';

// Tabs
import { AdminOverviewTab } from '../components/tabs/AdminOverviewTab';
import { AdminOrdersTab } from '../components/tabs/AdminOrdersTab';
import { AdminSendPackagesTab } from '../components/tabs/AdminSendPackagesTab';
import { AdminUsersTab } from '../components/tabs/AdminUsersTab';
import { AdminKycTab } from '../components/tabs/AdminKycTab';
import { AdminPayoutsTab } from '../components/tabs/AdminPayoutsTab';
import { AdminComplaintsTab } from '../components/tabs/AdminComplaintsTab';
import { AdminLogisticsTab } from '../components/tabs/AdminLogisticsTab';
import { AdminFeeConfigTab } from '../components/tabs/AdminFeeConfigTab';
import { AdminCategoriesTab } from '../components/tabs/AdminCategoriesTab';
import { AdminNewsletterTab } from '../components/tabs/AdminNewsletterTab';
import { AdminAnalyticsTab } from '../components/tabs/AdminAnalyticsTab';

export function AdminDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const { user, profile, signOut } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = windowWidth >= 840;

  const handleLogout = async () => {
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      toast.success('Signed Out', { description: 'You have been safely signed out.' });
    } catch (e: any) {
      console.warn('Sign out error:', e);
    }
  };

  const [activeTab, setActiveTab] = useState<string>(
    route.params?.initialTab || 'overview'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(isLargeScreen);

  const [refreshing, setRefreshing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Platform ledger & operational counts
  const [revenue, setRevenue] = useState({
    platform_total: 0,
    seller_total: 0,
    rider_total: 0,
    promoter_total: 0,
    total_received: 0,
  });

  const [counts, setCounts] = useState({
    activeOrders: 0,
    totalOrders: 0,
    users: 0,
    openIssues: 0,
    pendingPackages: 0,
    pendingKyc: 0,
  });

  const [criticalIssues, setCriticalIssues] = useState<any[]>([]);

  const fetchAdminStats = useCallback(async () => {
    try {
      // 1. Revenue Ledger
      const { data: revData } = await (supabase as any).rpc('get_admin_revenue');
      if (revData) {
        let parsed = revData;
        if (Array.isArray(revData) && revData.length > 0) {
          parsed = revData[0];
        }
        setRevenue({
          platform_total: Number(parsed.platform_total || parsed.json_build_object?.platform_total || 0),
          seller_total: Number(parsed.seller_total || parsed.json_build_object?.seller_total || 0),
          rider_total: Number(parsed.rider_total || parsed.json_build_object?.rider_total || 0),
          promoter_total: Number(parsed.promoter_total || parsed.json_build_object?.promoter_total || 0),
          total_received: Number(parsed.total_received || parsed.json_build_object?.total_received || 0),
        });
      }

      // 2. Active Orders Count
      const { count: activeCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'in_transit', 'paid']);

      // 3. Total Orders Count
      const { count: totalOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // 4. Users Count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 5. Open Issues / Complaints
      const [issuesRes, criticalRes] = await Promise.all([
        (supabase as any)
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open'),
        (supabase as any)
          .from('issues')
          .select('*, profiles:user_id(display_name)')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(4),
      ]);

      // 6. Pending Packages Count
      const { count: pendingPkgs } = await (supabase as any)
        .from('send_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['finding_rider', 'pending_payment']);

      // 7. Pending KYC Count
      const [sellerKyc, logisticsKyc] = await Promise.all([
        supabase
          .from('seller_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('logistics_kyc')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      const totalPendingKyc = (sellerKyc.count || 0) + (logisticsKyc.count || 0);

      setCounts({
        activeOrders: activeCount || 0,
        totalOrders: totalOrdersCount || 0,
        users: usersCount || 0,
        openIssues: issuesRes.count || 0,
        pendingPackages: pendingPkgs || 0,
        pendingKyc: totalPendingKyc,
      });

      setCriticalIssues(criticalRes.data || []);
    } catch (err: any) {
      console.warn('[AdminDashboard] Fetch stats error:', err);
    } finally {
      setLoadingInitial(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchAdminStats();
  };

  const navTabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'orders', label: 'Orders', icon: ShoppingBag, count: counts.activeOrders },
    { key: 'send-packages', label: 'Send Parcels', icon: Package, count: counts.pendingPackages, badgeColor: '#EA580C' },
    { key: 'users', label: 'Members', icon: Users },
    { key: 'kyc', label: 'KYC Checks', icon: CheckCircle2, count: counts.pendingKyc, badgeColor: '#3B82F6' },
    { key: 'payouts', label: 'Payouts', icon: CreditCard },
    { key: 'complaints', label: 'Complaints', icon: AlertTriangle, count: counts.openIssues, badgeColor: '#EF4444' },
    { key: 'logistics', label: 'Shipping', icon: Truck },
    { key: 'fees', label: 'Fee Config', icon: Wallet },
    { key: 'categories', label: 'Categories', icon: Grid },
    { key: 'newsletter', label: 'Broadcast', icon: Mail },
  ];

  const currentTabConfig = navTabs.find((t) => t.key === activeTab) || navTabs[0];
  const CurrentIcon = currentTabConfig.icon;
  const totalAlerts = counts.openIssues + counts.pendingKyc + counts.pendingPackages;

  return (
    <SafeView edges={['top', 'left', 'right']} style={styles.safeContainer}>
      <View style={styles.mainLayout}>
        {/* Tablet / Desktop Docked Persistent Sidebar */}
        {isLargeScreen && isSidebarOpen && (
          <AdminSidebar
            isOpen={true}
            onClose={() => setIsSidebarOpen(false)}
            activeTab={activeTab}
            onSelectTab={(k) => setActiveTab(k)}
            counts={counts}
            profile={profile}
            onLogout={handleLogout}
            isLargeScreen={true}
          />
        )}

        {/* Content Column */}
        <View style={styles.contentColumn}>
          {/* Top Header matching OGA ADMIN design */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <TouchableOpacity
                style={styles.menuTriggerBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsSidebarOpen((prev) => !prev);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Open navigation menu"
              >
                <Menu size={20} color="#0F172A" strokeWidth={2.4} />
                {totalAlerts > 0 && <View style={styles.menuAlertDot} />}
              </TouchableOpacity>
            </View>

            {/* Center OGA ADMIN branding */}
            <View style={styles.topBarCenter}>
              <Text style={styles.adminBrandTitle}>OGA ADMIN</Text>
            </View>

            <View style={styles.topBarRight}>
              {/* Notification Bell */}
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab('complaints');
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Bell size={18} color="#0F172A" strokeWidth={2.2} />
                {totalAlerts > 0 && <View style={styles.bellBadgeDot} />}
              </TouchableOpacity>

              {/* Logo Badge -> Storefront return */}
              <TouchableOpacity
                style={styles.logoBadgeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('MainTabs');
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Return to Storefront"
              >
                <Store size={18} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Tab Screen View */}
          {activeTab === 'analytics' ? (
            <AdminAnalyticsTab />
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
            >
              {activeTab === 'overview' && (
                <AdminOverviewTab
                  revenue={revenue}
                  counts={counts}
                  criticalIssues={criticalIssues}
                  onSelectTab={(k) => setActiveTab(k)}
                  onRefresh={fetchAdminStats}
                />
              )}
              {activeTab === 'orders' && <AdminOrdersTab />}
              {activeTab === 'send-packages' && <AdminSendPackagesTab />}
              {activeTab === 'users' && <AdminUsersTab />}
              {activeTab === 'kyc' && <AdminKycTab />}
              {activeTab === 'payouts' && <AdminPayoutsTab />}
              {activeTab === 'complaints' && <AdminComplaintsTab />}
              {activeTab === 'logistics' && <AdminLogisticsTab />}
              {activeTab === 'fees' && <AdminFeeConfigTab />}
              {activeTab === 'categories' && <AdminCategoriesTab />}
              {activeTab === 'newsletter' && <AdminNewsletterTab />}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Responsive Framer Motion Sliding Sidebar on Mobile */}
      {!isLargeScreen && (
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={activeTab}
          onSelectTab={(k) => setActiveTab(k)}
          counts={counts}
          profile={profile}
          onLogout={handleLogout}
          isLargeScreen={false}
        />
      )}
    </SafeView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentColumn: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuTriggerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
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
  topBarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBrandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  topBarRight: {
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
    position: 'relative',
  },
  bellBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: 7,
    right: 7,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  logoBadgeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
});
