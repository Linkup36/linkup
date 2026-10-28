import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  Activity,
  CheckCircle2,
  BarChart3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';

interface SellerAnalyticsTabProps {
  totalEarnings: number;
  netSettled: number;
  ordersCount: number;
  escrowBalance: number;
  orders: any[];
}

export function SellerAnalyticsTab({
  totalEarnings,
  netSettled,
  ordersCount,
  escrowBalance,
  orders,
}: SellerAnalyticsTabProps) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  const avgOrderValue = useMemo(() => {
    if (!ordersCount || ordersCount <= 0) return 0;
    return Math.round(totalEarnings / ordersCount);
  }, [totalEarnings, ordersCount]);

  // Build daily/grouped activity bars for the selected range
  const chartData = useMemo(() => {
    const now = new Date();
    const bucketCount = 7; // 7 visual bars across the selected range
    const msPerDay = 24 * 60 * 60 * 1000;
    const stepDays = Math.max(1, Math.floor(rangeDays / bucketCount));

    const buckets: Array<{ label: string; count: number; amount: number }> = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const endDate = new Date(now.getTime() - i * stepDays * msPerDay);
      const startDate = new Date(endDate.getTime() - stepDays * msPerDay);

      const label =
        rangeDays === 7
          ? endDate.toLocaleDateString('en-US', { weekday: 'short' })
          : endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const matching = (orders || []).filter((o) => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return d > startDate && d <= endDate;
      });

      const amount = matching.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      buckets.push({
        label,
        count: matching.length,
        amount,
      });
    }

    return buckets;
  }, [orders, rangeDays]);

  const maxBucketAmount = useMemo(() => {
    const maxVal = Math.max(...chartData.map((b) => b.amount), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [chartData]);

  const maxBucketCount = useMemo(() => {
    const maxVal = Math.max(...chartData.map((b) => b.count), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [chartData]);

  const totalRangeOrders = useMemo(
    () => chartData.reduce((s, b) => s + b.count, 0),
    [chartData]
  );

  const totalRangeRevenue = useMemo(
    () => chartData.reduce((s, b) => s + b.amount, 0),
    [chartData]
  );

  return (
    <View style={styles.container}>
      {/* Business Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerIconBox}>
            <TrendingUp size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Business Summary</Text>
            <Text style={styles.cardSubtitle}>All-time store financial snapshot</Text>
          </View>
        </View>

        <View style={styles.metricsList}>
          <View style={styles.metricRow}>
            <View style={styles.metricLabelGroup}>
              <View style={[styles.dotIcon, { backgroundColor: '#FFF3EC' }]}>
                <DollarSign size={14} color={colors.primary} />
              </View>
              <Text style={styles.metricLabel}>Total Revenue</Text>
            </View>
            <Text style={styles.metricValuePrimary}>
              ₦{Number(totalEarnings || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLabelGroup}>
              <View style={[styles.dotIcon, { backgroundColor: '#ECFDF5' }]}>
                <CheckCircle2 size={14} color="#059669" />
              </View>
              <Text style={styles.metricLabel}>Net Settled (after fees)</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#059669' }]}>
              ₦{Number(netSettled || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLabelGroup}>
              <View style={[styles.dotIcon, { backgroundColor: '#EFF6FF' }]}>
                <ShoppingBag size={14} color="#2563EB" />
              </View>
              <Text style={styles.metricLabel}>Total Orders</Text>
            </View>
            <Text style={styles.metricValue}>{ordersCount}</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLabelGroup}>
              <View style={[styles.dotIcon, { backgroundColor: '#FFFBEB' }]}>
                <Clock size={14} color="#D97706" />
              </View>
              <Text style={styles.metricLabel}>Pending Payouts / Escrow</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#D97706' }]}>
              ₦{Number(escrowBalance || 0).toLocaleString()}
            </Text>
          </View>

          <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
            <View style={styles.metricLabelGroup}>
              <View style={[styles.dotIcon, { backgroundColor: '#F5F3FF' }]}>
                <Activity size={14} color="#7C3AED" />
              </View>
              <Text style={styles.metricLabel}>Avg Order Value</Text>
            </View>
            <Text style={styles.metricValue}>
              ₦{avgOrderValue.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Activity Overview Card */}
      <View style={styles.activityCard}>
        <View style={styles.activityHeader}>
          <View>
            <Text style={styles.cardTitle}>Activity Overview</Text>
            <Text style={styles.cardSubtitle}>
              {totalRangeOrders} order{totalRangeOrders === 1 ? '' : 's'} • ₦
              {totalRangeRevenue.toLocaleString()} in last {rangeDays} days
            </Text>
          </View>

          <View style={styles.rangePills}>
            {([7, 30, 90] as const).map((days) => {
              const active = rangeDays === days;
              return (
                <TouchableOpacity
                  key={days}
                  style={[styles.rangePill, active && styles.rangePillActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRangeDays(days);
                  }}
                >
                  <Text
                    style={[
                      styles.rangePillText,
                      active && styles.rangePillTextActive,
                    ]}
                  >
                    {days}D
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Native Bar Chart */}
        {orders.length === 0 ? (
          <View style={styles.emptyChartBox}>
            <TrendingUp size={32} color="#CBD5E1" />
            <Text style={styles.emptyChartTitle}>No order activity yet</Text>
            <Text style={styles.emptyChartSub}>
              Charts will appear cleanly once orders start flowing into your store.
            </Text>
          </View>
        ) : (
          <View style={styles.chartWrapper}>
            <View style={styles.barsContainer}>
              {chartData.map((bucket, idx) => {
                const heightPercent =
                  bucket.amount > 0
                    ? Math.max(14, Math.round((bucket.amount / maxBucketAmount) * 100))
                    : bucket.count > 0
                      ? Math.max(14, Math.round((bucket.count / maxBucketCount) * 100))
                      : 6;
                const isZero = bucket.count === 0 && bucket.amount === 0;

                return (
                  <View key={idx} style={styles.barColumn}>
                    <Text style={styles.barTopValue}>
                      {bucket.count > 0 ? `${bucket.count}` : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: isZero ? '#E2E8F0' : colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {bucket.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Order Volume & Gross Value</Text>
              </View>
              <Text style={styles.legendHint}>Numbers above bars = orders count</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  metricsList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  metricLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  metricValuePrimary: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 8,
  },
  rangePills: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  rangePillActive: {
    backgroundColor: colors.primary,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  rangePillTextActive: {
    color: '#FFFFFF',
  },
  emptyChartBox: {
    height: 190,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyChartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 10,
  },
  emptyChartSub: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
  chartWrapper: {
    paddingTop: 8,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 170,
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTopValue: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.foreground,
    marginBottom: 4,
    height: 14,
  },
  barTrack: {
    width: 22,
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  legendHint: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
