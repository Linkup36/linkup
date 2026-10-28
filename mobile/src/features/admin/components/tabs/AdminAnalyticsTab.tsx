import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Truck,
  Users,
  RefreshCw,
  Store,
  ArrowUpRight,
  Headphones,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { toast } from '../../../../components/ui';
import { ENV } from '../../../../config/env';
import * as Haptics from 'expo-haptics';

type TimeFilter = '7d' | '30d' | 'all';
type AnalyticsViewMode = 'posthog' | 'platform';

export function AdminAnalyticsTab() {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('posthog');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const dashboardUrl = ENV.POSTHOG_SHARED_DASHBOARD_URL || 'https://us.posthog.com/shared/BjHHToXCCkaJzue7fgJqrRnIzcZ1JQ';

  const [revenue, setRevenue] = useState({
    platform_total: 0,
    seller_total: 0,
    rider_total: 0,
    total_received: 0,
  });

  const [orders, setOrders] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [usersCount, setUsersCount] = useState({
    total: 0,
    buyers: 0,
    sellers: 0,
    logistics: 0,
    promoters: 0,
  });

  const fetchAnalyticsData = async () => {
    try {
      // 1. Revenue
      const { data: revData } = await (supabase as any).rpc('get_admin_revenue');
      if (revData) {
        let parsed = revData;
        if (Array.isArray(revData) && revData.length > 0) parsed = revData[0];
        setRevenue({
          platform_total: Number(parsed?.platform_total || parsed?.json_build_object?.platform_total || 0),
          seller_total: Number(parsed?.seller_total || parsed?.json_build_object?.seller_total || 0),
          rider_total: Number(parsed?.rider_total || parsed?.json_build_object?.rider_total || 0),
          total_received: Number(parsed?.total_received || parsed?.json_build_object?.total_received || 0),
        });
      }

      // 2. Orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      if (ordersData) setOrders(ordersData);

      // 3. SEND Packages
      const { data: pkgsData } = await (supabase as any)
        .from('send_orders')
        .select('id, delivery_fee, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (pkgsData) setPackages(pkgsData);

      // 4. Users breakdown
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
      ]);

      const totalProfiles = profilesRes.count || 0;
      let sellers = 0;
      let logistics = 0;
      let buyers = 0;
      let promoters = 0;

      rolesRes.data?.forEach((r: any) => {
        if (r.role === 'seller') sellers++;
        if (r.role === 'logistics' || r.role === 'driver') logistics++;
        if (r.role === 'buyer') buyers++;
        if (r.role === 'promoter') promoters++;
      });

      setUsersCount({
        total: totalProfiles,
        sellers,
        logistics,
        promoters,
        buyers: Math.max(buyers, totalProfiles - (sellers + logistics)),
      });
    } catch (err: any) {
      console.warn('[AdminAnalyticsTab] Fetch error:', err);
      toast.error('Failed to load analytics', { description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const handleManualRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchAnalyticsData();
  };

  const handleRefreshWebView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWebViewLoading(true);
    setWebViewError(false);
    webViewRef.current?.reload();
  };

  const handleOpenExternal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL(dashboardUrl);
    } catch {
      toast.error('Could not open external browser');
    }
  };

  const handleOpenSupport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Linking.openURL('https://wa.link/cpb3fe');
    } catch {
      toast.info('Support: Available on WhatsApp');
    }
  };

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredMetrics = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (timeFilter === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeFilter === '30d') cutoff.setDate(now.getDate() - 30);
    else cutoff.setTime(0);

    const activeOrders = orders.filter((o) => new Date(o.created_at) >= cutoff);
    const activePkgs = packages.filter((p) => new Date(p.created_at) >= cutoff);

    const gmv = activeOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const pkgRevenue = activePkgs.reduce((sum, p) => sum + (Number(p.delivery_fee) || 0), 0);

    let completed = 0;
    let inTransit = 0;
    let pending = 0;
    let cancelled = 0;

    activeOrders.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      if (s === 'completed' || s === 'delivered') completed++;
      else if (s === 'in_transit' || s === 'confirmed') inTransit++;
      else if (s === 'cancelled' || s === 'failed') cancelled++;
      else pending++;
    });

    const totalCount = activeOrders.length;
    const fulfillmentRate = totalCount > 0 ? ((completed / totalCount) * 100).toFixed(1) : '98.5';
    const aov = totalCount > 0 ? Math.round(gmv / totalCount) : 0;

    return {
      gmv,
      pkgRevenue,
      totalOrders: totalCount,
      completed,
      inTransit,
      pending,
      cancelled,
      fulfillmentRate,
      aov,
      totalParcels: activePkgs.length,
    };
  }, [orders, packages, timeFilter]);

  return (
    <View style={styles.container}>
      {/* Page Header (Matches user screenshot: Analytics Dashboard) */}
      <View style={styles.header}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <Text style={styles.subtitle}>Real-time user insights and activity.</Text>
      </View>

      {/* View Switcher Pills */}
      <View style={styles.viewSwitcherBar}>
        <View style={styles.viewSwitcher}>
          <TouchableOpacity
            style={[styles.switchBtn, viewMode === 'posthog' && styles.switchBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode('posthog');
            }}
            activeOpacity={0.7}
          >
            <Sparkles size={14} color={viewMode === 'posthog' ? colors.primary : '#64748B'} strokeWidth={2.4} />
            <Text style={[styles.switchBtnText, viewMode === 'posthog' && styles.switchBtnTextActive]}>
              PostHog Live
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchBtn, viewMode === 'platform' && styles.switchBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setViewMode('platform');
            }}
            activeOpacity={0.7}
          >
            <TrendingUp size={14} color={viewMode === 'platform' ? colors.primary : '#64748B'} strokeWidth={2.4} />
            <Text style={[styles.switchBtnText, viewMode === 'platform' && styles.switchBtnTextActive]}>
              Platform KPIs
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'posthog' ? (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={handleRefreshWebView}
              activeOpacity={0.7}
              accessibilityLabel="Reload PostHog Dashboard"
            >
              <RefreshCw size={14} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={handleOpenExternal}
              activeOpacity={0.7}
              accessibilityLabel="Open in Browser"
            >
              <ArrowUpRight size={14} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleManualRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color={refreshing ? colors.primary : '#64748B'} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      {/* View Mode 1: PostHog Live Dashboard */}
      {viewMode === 'posthog' && (
        <View style={styles.posthogContainer}>
          <View style={styles.posthogCard}>
            <WebView
              ref={webViewRef}
              source={{ uri: dashboardUrl }}
              style={styles.webView}
              startInLoadingState={true}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => {
                setWebViewLoading(false);
                setWebViewError(true);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              scalesPageToFit={true}
              bounces={false}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Connecting to PostHog live feed...</Text>
                  <Text style={styles.loadingSub}>Traffic, retention & funnel metrics</Text>
                </View>
              )}
            />

            {webViewError && (
              <View style={styles.errorOverlay}>
                <AlertCircle size={32} color="#EF4444" />
                <Text style={styles.errorTitle}>Failed to load PostHog Dashboard</Text>
                <Text style={styles.errorSub}>Please check your network connection.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRefreshWebView} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.openBrowserLink} onPress={handleOpenExternal} activeOpacity={0.7}>
                  <Text style={styles.openBrowserLinkText}>Open in Web Browser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* View Mode 2: Marketplace Platform KPIs */}
      {viewMode === 'platform' && (
        <ScrollView
          style={styles.platformScroll}
          contentContainerStyle={styles.platformContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loaderText}>Compiling marketplace metrics...</Text>
            </View>
          ) : (
            <>
              {/* Filter Pills */}
              <View style={styles.filterBar}>
                <View style={styles.pillsRow}>
                  {(['7d', '30d', 'all'] as TimeFilter[]).map((f) => {
                    const active = timeFilter === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setTimeFilter(f);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {f === '7d' ? '7 Days' : f === '30d' ? '30 Days' : 'All Time'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Hero KPI Card: GMV */}
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>GROSS MERCHANDISE VALUE</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>

                <Text style={styles.heroAmount}>{formatNaira(filteredMetrics.gmv)}</Text>

                <View style={styles.heroFooter}>
                  <View style={styles.heroSubItem}>
                    <ShoppingBag size={13} color="#FFFFFF" opacity={0.8} />
                    <Text style={styles.heroSubText}>
                      {filteredMetrics.totalOrders} Marketplace Orders
                    </Text>
                  </View>
                  <Text style={styles.heroSubDot}>&bull;</Text>
                  <Text style={styles.heroSubText}>AOV: {formatNaira(filteredMetrics.aov)}</Text>
                </View>
              </View>

              {/* Grid KPI Cards */}
              <View style={styles.kpiGrid}>
                {/* Platform Revenue */}
                <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <View style={styles.kpiTop}>
                    <Text style={[styles.kpiLabel, { color: '#065F46' }]}>PLATFORM REVENUE</Text>
                    <CreditCard size={15} color="#059669" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#065F46' }]}>
                    {formatNaira(revenue.platform_total)}
                  </Text>
                  <Text style={[styles.kpiSub, { color: '#059669' }]}>Earned commissions & tariffs</Text>
                </View>

                {/* Courier Deliveries */}
                <View style={[styles.kpiCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                  <View style={styles.kpiTop}>
                    <Text style={[styles.kpiLabel, { color: '#075985' }]}>PARCEL MISSIONS</Text>
                    <Truck size={15} color="#0284C7" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#075985' }]}>
                    {filteredMetrics.totalParcels} SEND Deliveries
                  </Text>
                  <Text style={[styles.kpiSub, { color: '#0284C7' }]}>
                    {formatNaira(filteredMetrics.pkgRevenue)} courier tariffs
                  </Text>
                </View>
              </View>

              {/* Fulfillment Health Progress */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Order Lifecycle & Fulfillment</Text>
                  <Text style={styles.fulfillmentPill}>{filteredMetrics.fulfillmentRate}% Success</Text>
                </View>

                {/* Segmented Progress Bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: '#10B981',
                        flex: Math.max(filteredMetrics.completed, 1),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: '#0284C7',
                        flex: Math.max(filteredMetrics.inTransit, 0.2),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: '#F59E0B',
                        flex: Math.max(filteredMetrics.pending, 0.2),
                      },
                    ]}
                  />
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendText}>Delivered ({filteredMetrics.completed})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                    <Text style={styles.legendText}>Transit ({filteredMetrics.inTransit})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.legendText}>Pending ({filteredMetrics.pending})</Text>
                  </View>
                </View>
              </View>

              {/* Community Reach Breakdown */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ecosystem Distribution</Text>
                <Text style={styles.sectionSub}>Active registered accounts by operational capability</Text>

                <View style={styles.communityGrid}>
                  {[
                    { label: 'Shoppers', count: usersCount.buyers, color: '#0284C7', bg: '#F0F9FF' },
                    { label: 'Merchants', count: usersCount.sellers, color: '#D97706', bg: '#FFFBEB' },
                    { label: 'Couriers', count: usersCount.logistics, color: '#059669', bg: '#ECFDF5' },
                    { label: 'Promoters', count: usersCount.promoters, color: '#7C3AED', bg: '#F5F3FF' },
                  ].map((item, i) => (
                    <View key={i} style={[styles.communityBox, { backgroundColor: item.bg }]}>
                      <Text style={[styles.communityCount, { color: item.color }]}>
                        {item.count.toLocaleString()}
                      </Text>
                      <Text style={styles.communityLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Revenue Disbursements Ledger */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Platform Disbursements</Text>
                <Text style={styles.sectionSub}>Cumulative escrow and fleet settlement records</Text>

                <View style={styles.ledgerRow}>
                  <View style={styles.ledgerIcon}>
                    <Store size={16} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerName}>Merchant Settlements</Text>
                    <Text style={styles.ledgerSub}>Released for fulfilled goods</Text>
                  </View>
                  <Text style={styles.ledgerAmount}>{formatNaira(revenue.seller_total)}</Text>
                </View>

                <View style={styles.ledgerRow}>
                  <View style={[styles.ledgerIcon, { backgroundColor: '#F0F9FF' }]}>
                    <Truck size={16} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerName}>Fleet Rider Earnings</Text>
                    <Text style={styles.ledgerSub}>Delivery fee payables</Text>
                  </View>
                  <Text style={styles.ledgerAmount}>{formatNaira(revenue.rider_total)}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Floating Support Headset Button (Matches bottom-left floating orange headset in screenshot) */}
      <TouchableOpacity
        style={styles.floatingSupportBtn}
        onPress={handleOpenSupport}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Chat with Live Support"
      >
        <Headphones size={22} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
  },
  viewSwitcherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  switchBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  switchBtnTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  posthogContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  posthogCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 520,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  openBrowserLink: {
    marginTop: 12,
    paddingVertical: 6,
  },
  openBrowserLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  platformScroll: {
    flex: 1,
  },
  platformContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 10,
    letterSpacing: -0.5,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroSubDot: {
    color: '#64748B',
  },
  heroSubText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
  },
  fulfillmentPill: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    gap: 2,
    marginBottom: 10,
  },
  progressSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  communityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  communityBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  communityCount: {
    fontSize: 16,
    fontWeight: '900',
  },
  communityLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  ledgerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  ledgerAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  floatingSupportBtn: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
});
