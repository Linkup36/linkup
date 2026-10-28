import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import {
  TrendingUp,
  Clock,
  ShoppingCart,
  Copy,
  Share2,
  Sparkles,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpRight,
  Activity,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { toast } from '../../../components/ui';
import { CommissionItem, ReferralItem, PromoterStats } from '../hooks/usePromoterData';

const BRAND_ORANGE = '#EB7D30';

interface PromoterOverviewTabProps {
  promoterCode: string;
  stats: PromoterStats;
  commissions: CommissionItem[];
  referrals: ReferralItem[];
  onOpenWithdrawModal: () => void;
  onGoToMarketplace: () => void;
}

export function PromoterOverviewTab({
  promoterCode,
  stats,
  commissions,
  referrals,
  onOpenWithdrawModal,
  onGoToMarketplace,
}: PromoterOverviewTabProps) {
  const referralLink = `https://linkupng.com?ref=${promoterCode || 'linkup'}`;

  const handleCopyCode = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Promoter Code Copied! 📋', {
      description: promoterCode || 'Code copied to clipboard',
    });
  };

  const handleCopyLink = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Referral Link Copied! 🔗', {
      description: referralLink,
    });
  };

  const handleShareLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: 'Join LinkUp Marketplace',
        message: `Join LinkUp Marketplace and get instant discounts on electronics, phones & on-demand deliveries! Use my invite link: ${referralLink}`,
      });
    } catch (e) {
      console.warn('[PromoterOverview] share error:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Promoter Identity Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconBox}>
            <Sparkles size={18} color={BRAND_ORANGE} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>Your Affiliate Link</Text>
            <Text style={styles.heroSubtitle}>
              Share your link or code. You earn 5% commission on every customer purchase.
            </Text>
          </View>
        </View>

        {/* Code & Link Pill */}
        <View style={styles.heroCodeBox}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroCodeLabel}>AFFILIATE CODE</Text>
            <Text style={styles.heroCodeValue} numberOfLines={1}>
              {promoterCode || 'LOADING...'}
            </Text>
          </View>

          <View style={styles.heroActionButtons}>
            <TouchableOpacity style={styles.heroCopyBtn} onPress={handleCopyCode} activeOpacity={0.8}>
              <Copy size={13} color={BRAND_ORANGE} />
              <Text style={styles.heroCopyText}>Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.heroShareBtn} onPress={handleShareLink} activeOpacity={0.85}>
              <Share2 size={13} color="#FFFFFF" />
              <Text style={styles.heroShareText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Total Revenue */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel} numberOfLines={1}>TOTAL REVENUE</Text>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <TrendingUp size={12} color={BRAND_ORANGE} />
            </View>
          </View>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            ₦{stats.totalRevenue.toLocaleString()}
          </Text>
          <Text style={styles.metricSub}>All-time earnings</Text>
        </View>

        {/* Ready Balance */}
        <TouchableOpacity style={styles.metricCard} onPress={onOpenWithdrawModal} activeOpacity={0.85}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel} numberOfLines={1}>AVAILABLE</Text>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <ArrowUpRight size={12} color={BRAND_ORANGE} />
            </View>
          </View>
          <Text style={[styles.metricValue, { color: BRAND_ORANGE }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            ₦{stats.availableBalance.toLocaleString()}
          </Text>
          <Text style={styles.metricSub}>Tap to withdraw</Text>
        </TouchableOpacity>

        {/* In Escrow */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel} numberOfLines={1}>IN ESCROW</Text>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Clock size={12} color="#D97706" />
            </View>
          </View>
          <Text style={[styles.metricValue, { color: '#C25E1A' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            ₦{stats.escrowBalance.toLocaleString()}
          </Text>
          <Text style={styles.metricSub}>Releases on delivery</Text>
        </View>

        {/* Total Conversions */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel} numberOfLines={1}>CONVERSIONS</Text>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <ShoppingCart size={12} color={BRAND_ORANGE} />
            </View>
          </View>
          <Text style={styles.metricValue} numberOfLines={1}>
            {stats.totalConversions}
          </Text>
          <Text style={styles.metricSub}>{stats.totalClicks} link clicks</Text>
        </View>
      </View>

      {/* 3. Call-to-action: Browse Marketplace */}
      <TouchableOpacity style={styles.ctaBanner} onPress={onGoToMarketplace} activeOpacity={0.85}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.ctaBannerTitle}>Boost Your Commission! 🚀</Text>
          <Text style={styles.ctaBannerSubtitle}>
            Browse top marketplace products from verified sellers with up to 10% commission.
          </Text>
        </View>
        <View style={styles.ctaArrow}>
          <ArrowUpRight size={18} color={BRAND_ORANGE} />
        </View>
      </TouchableOpacity>

      {/* 4. Recent Earnings Section */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT EARNINGS</Text>
          <Text style={styles.sectionBadge}>{commissions.length} settlements</Text>
        </View>

        {commissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Package size={32} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Commission Settlements Yet</Text>
            <Text style={styles.emptySub}>
              Share your affiliate link or promote products to start earning instant commission.
            </Text>
          </View>
        ) : (
          commissions.slice(0, 5).map((c) => (
            <View key={c.id} style={styles.commissionRow}>
              <View style={styles.commIconBox}>
                <TrendingUp size={16} color={BRAND_ORANGE} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.commOrderText} numberOfLines={1}>
                  {c.order_id ? `Order #${c.order_id.slice(0, 8)}` : `Settlement #${c.id.slice(0, 8)}`}
                </Text>
                <Text style={styles.commDateText}>
                  {new Date(c.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commAmount}>+₦{c.amount.toLocaleString()}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{c.status.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 5. Attribution Clicks Feed */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>REFERRAL ATTRIBUTION FEED</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {referrals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Activity size={32} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Link Clicks Tracked Yet</Text>
            <Text style={styles.emptySub}>
              When buyers click your link, real-time attribution will appear here.
            </Text>
          </View>
        ) : (
          referrals.slice(0, 6).map((r) => (
            <View key={r.id} style={styles.referralRow}>
              <View style={styles.refIconBox}>
                <Activity size={14} color={BRAND_ORANGE} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.refBuyerText} numberOfLines={1}>
                  {r.orders?.buyer_id ? `Buyer: #${r.orders.buyer_id.slice(0, 8)}` : `Click ID: #${r.id.slice(0, 8)}`}
                </Text>
                <Text style={styles.refDateText}>
                  {new Date(r.created_at).toLocaleDateString()} at {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View
                style={[
                  styles.refBadge,
                  r.status === 'conversion' ? styles.refBadgeConversion : styles.refBadgeClick,
                ]}
              >
                <Text
                  style={[
                    styles.refBadgeText,
                    r.status === 'conversion' ? styles.refBadgeTextConversion : styles.refBadgeTextClick,
                  ]}
                >
                  {r.status === 'conversion' ? 'CONVERSION' : 'CLICK'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  heroIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 15,
    marginTop: 1,
  },
  heroCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  heroCodeLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: BRAND_ORANGE,
    letterSpacing: 0.5,
  },
  heroCodeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#C25E1A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginTop: 1,
  },
  heroActionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  heroCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  heroCopyText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  heroShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  heroShareText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.4,
    flex: 1,
  },
  metricIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  metricSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  ctaBanner: {
    backgroundColor: BRAND_ORANGE,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ctaBannerSubtitle: {
    fontSize: 10.5,
    color: '#FFF7ED',
    marginTop: 2,
    lineHeight: 14,
  },
  ctaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionWrap: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 2,
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 240,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  commIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commOrderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  commDateText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  commAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND_ORANGE,
  },
  statusBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_ORANGE,
  },
  liveText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: BRAND_ORANGE,
    letterSpacing: 0.5,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  refIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refBuyerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  refDateText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  refBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  refBadgeConversion: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  refBadgeClick: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  refBadgeTextConversion: {
    color: BRAND_ORANGE,
  },
  refBadgeTextClick: {
    color: '#64748B',
  },
});
