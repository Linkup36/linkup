import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  CreditCard,
  Store,
  Bike,
  TrendingUp,
  ShieldCheck,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';

interface AdminOverviewTabProps {
  revenue: {
    platform_total: number;
    seller_total: number;
    rider_total: number;
    promoter_total: number;
    total_received: number;
  };
  counts: {
    activeOrders: number;
    totalOrders: number;
    users: number;
    openIssues: number;
    pendingPackages: number;
    pendingKyc: number;
  };
  criticalIssues: any[];
  onSelectTab: (tabKey: string) => void;
  onRefresh: () => void;
}

export function AdminOverviewTab({
  revenue,
  counts,
  criticalIssues,
  onSelectTab,
  onRefresh,
}: AdminOverviewTabProps) {
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const handleRunEscrowReleases = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Automated Escrow Release',
      'Scan delivered orders past their 48-hour inspection period and credit seller balances?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Now',
          onPress: async () => {
            setRunningAction('escrow');
            try {
              const { data, error } = await (supabase as any).rpc(
                'process_automated_escrow_releases'
              );
              if (error) throw error;
              const res = data as any;
              toast.success('Escrow Releases Processed', {
                description: `${res?.orders_completed ?? 0} orders completed, ${res?.settlements_released ?? 0} settlements credited.`,
              });
              onRefresh();
            } catch (err: any) {
              toast.error('Escrow Process Failed', {
                description: err.message || 'Could not complete escrow releases.',
              });
            } finally {
              setRunningAction(null);
            }
          },
        },
      ]
    );
  };

  const handleRunRiderReleases = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'SEND Rider Payouts',
      'Scan and release earnings for delivered parcel orders past inspection window?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release Earnings',
          onPress: async () => {
            setRunningAction('riders');
            try {
              const { data, error } = await (supabase as any).rpc(
                'process_send_rider_payout_releases'
              );
              if (error) throw error;
              const res = data as any;
              toast.success('Rider Payouts Released', {
                description: `${res?.released_count ?? 0} parcels credited (₦${(res?.total_amount ?? 0).toLocaleString()}).`,
              });
              onRefresh();
            } catch (err: any) {
              toast.error('Release Failed', {
                description: err.message || 'Could not process rider earnings.',
              });
            } finally {
              setRunningAction(null);
            }
          },
        },
      ]
    );
  };

  const ledgerCards = [
    {
      title: 'Platform Revenue',
      subtitle: 'Net LinkUp Fee Cuts',
      amount: revenue.platform_total,
      icon: ShieldCheck,
      color: colors.primary,
      bgColor: '#FFF7ED',
      borderColor: '#FED7AA',
    },
    {
      title: 'Gross Payments',
      subtitle: 'Total Payments Ingested',
      amount: revenue.total_received,
      icon: CreditCard,
      color: '#0F172A',
      bgColor: '#F8FAFC',
      borderColor: '#E2E8F0',
    },
    {
      title: 'Seller Escrow',
      subtitle: 'Merchant Product Balances',
      amount: revenue.seller_total,
      icon: Store,
      color: '#059669',
      bgColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    {
      title: 'Courier Logistics',
      subtitle: 'Rider Delivery Earnings',
      amount: revenue.rider_total,
      icon: Bike,
      color: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    {
      title: 'Affiliate Growth',
      subtitle: 'Promoter Referral Cuts',
      amount: revenue.promoter_total,
      icon: TrendingUp,
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      borderColor: '#C7D2FE',
    },
  ];

  const quickStats = [
    {
      title: 'Active Orders',
      count: counts.activeOrders,
      desc: 'In-flight delivery',
      tabKey: 'orders',
      icon: ShoppingBag,
      color: '#0284C7',
      bg: '#E0F2FE',
    },
    {
      title: 'Send Parcels',
      count: counts.pendingPackages,
      desc: 'Awaiting rider pickup',
      tabKey: 'send-packages',
      icon: Package,
      color: colors.primary,
      bg: '#FFF7ED',
      badge: counts.pendingPackages > 0,
    },
    {
      title: 'Platform Users',
      count: counts.users,
      desc: 'Registered accounts',
      tabKey: 'users',
      icon: Users,
      color: '#6366F1',
      bg: '#EEF2FF',
    },
    {
      title: 'Open Complaints',
      count: counts.openIssues,
      desc: 'Customer disputes',
      tabKey: 'complaints',
      icon: AlertTriangle,
      color: '#EF4444',
      bg: '#FEF2F2',
      badge: counts.openIssues > 0,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Platform Ledger Header */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionOverline}>FINANCIAL BREAKDOWN</Text>
          <Text style={styles.sectionTitle}>Realtime Revenue Ledger</Text>
        </View>
        <TouchableOpacity
          style={styles.analyticsButton}
          onPress={() => {
            Haptics.selectionAsync();
            onSelectTab('analytics');
          }}
          activeOpacity={0.75}
        >
          <TrendingUp size={13} color={colors.primary} strokeWidth={2.4} />
          <Text style={styles.analyticsButtonText}>Full Analytics</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Revenue Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>LINKUP EARNINGS</Text>
            <Text style={styles.heroAmount}>{formatNaira(revenue.platform_total)}</Text>
          </View>

        </View>
        <Text style={styles.heroDesc}>
          Earned commissions across marketplace escrow checkout and on-demand courier deliveries.
        </Text>
      </View>

      {/* Grid of Financial Breakdown Cards */}
      <View style={styles.ledgerGrid}>
        {ledgerCards.slice(1).map((item, idx) => {
          const Icon = item.icon;
          return (
            <View
              key={idx}
              style={[
                styles.ledgerCard,
                { backgroundColor: item.bgColor, borderColor: item.borderColor },
              ]}
            >
              <View style={styles.ledgerCardTop}>
                <View style={[styles.iconWrap, { backgroundColor: '#FFFFFF' }]}>
                  <Icon size={18} color={item.color} strokeWidth={2.4} />
                </View>
                <Text style={[styles.ledgerAmount, { color: item.color }]}>
                  {formatNaira(item.amount)}
                </Text>
              </View>
              <Text style={styles.ledgerTitle}>{item.title}</Text>
              <Text style={styles.ledgerSubtitle}>{item.subtitle}</Text>
            </View>
          );
        })}
      </View>




      {/* Operations Quick Stats */}
      <View style={styles.sectionHeader}>
        <View>

          <Text style={styles.sectionTitle}>Activity Overview</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {quickStats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={idx}
              style={styles.statCard}
              onPress={() => onSelectTab(item.tabKey)}
              activeOpacity={0.7}
            >
              <View style={styles.statTop}>
                <View style={[styles.statIconBox, { backgroundColor: item.bg }]}>
                  <Icon size={20} color={item.color} strokeWidth={2.4} />
                </View>
                <View style={styles.statRightArrow}>
                  <ArrowUpRight size={16} color="#94A3B8" />
                </View>
              </View>
              <View style={styles.statBody}>
                <Text style={styles.statCount}>{item.count.toLocaleString()}</Text>
                <Text style={styles.statTitle}>{item.title}</Text>
                <Text style={styles.statDesc} numberOfLines={1}>
                  {item.desc}
                </Text>
              </View>
              {item.badge && (
                <View style={styles.statPulseBadge}>
                  <Text style={styles.statPulseText}>ACTION NEEDED</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Critical Alerts Feed */}
      <View style={styles.sectionHeader}>
        <View>

          <Text style={styles.sectionTitle}>What needs attention</Text>
        </View>
        <TouchableOpacity
          onPress={() => onSelectTab('complaints')}
          style={styles.viewAllBtn}
        >
          <Text style={styles.viewAllText}>View All ({counts.openIssues})</Text>
        </TouchableOpacity>
      </View>

      {criticalIssues.length === 0 ? (
        <View style={styles.emptyAlertsCard}>
          <CheckCircle2 size={32} color="#10B981" />
          <Text style={styles.emptyAlertsTitle}>All system is Good!</Text>
          <Text style={styles.emptyAlertsSubtitle}>
            No high or critical disputes open right now across Nigeria.
          </Text>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {criticalIssues.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={styles.alertCard}
              onPress={() => onSelectTab('complaints')}
              activeOpacity={0.7}
            >
              <View style={styles.alertCardTop}>
                <View style={styles.alertBadge}>
                  <AlertTriangle size={12} color="#EF4444" strokeWidth={2.4} />
                  <Text style={styles.alertBadgeText}>
                    {issue.priority?.toUpperCase()} PRIORITY
                  </Text>
                </View>
                <Text style={styles.alertDate}>
                  {new Date(issue.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.alertTitle} numberOfLines={1}>
                {issue.title || issue.category || 'Complaint Report'}
              </Text>
              <Text style={styles.alertDesc} numberOfLines={2}>
                {issue.description || 'No additional details provided.'}
              </Text>
              <View style={styles.alertFooter}>
                <Text style={styles.alertReporter}>
                  Reporter: {issue.profiles?.display_name || issue.reporter?.display_name || 'Buyer'}
                </Text>
                <Text style={styles.alertResolveLink}>Resolve &rarr;</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  analyticsButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    fontWeight: '500',
  },
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  ledgerCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  ledgerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ledgerAmount: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  ledgerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  ledgerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  opsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  opsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  opsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 8,
  },
  opsButtonPrimary: {
    backgroundColor: colors.primary,
  },
  opsButtonSecondary: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  opsButtonTextWrap: {
    flex: 1,
  },
  opsButtonTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  opsButtonSub: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRightArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBody: {
    marginTop: 2,
  },
  statCount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  statDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  statPulseBadge: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statPulseText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#EF4444',
  },
  viewAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyAlertsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyAlertsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyAlertsSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  alertsList: {
    gap: 10,
  },
  alertCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  alertCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
  alertDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  alertDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  alertReporter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  alertResolveLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
});
