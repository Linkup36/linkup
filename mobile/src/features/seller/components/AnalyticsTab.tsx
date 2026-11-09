import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CreditCard,
  DollarSign,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface AnalyticsTabProps {
  revenue: number;
  netRevenue: number;
  escrowBalance: number;
  totalOrders: number;
  chartData?: any[];
}

export function AnalyticsTab({
  revenue,
  netRevenue,
  escrowBalance,
  totalOrders,
}: AnalyticsTabProps) {
  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');
  const avgOrderValue = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View>
        <Text style={styles.subtitle}>Simple Insights</Text>
        <Text style={styles.title}>Business Summary</Text>
      </View>

      {/* 4 Primary Metric Cards Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricIconWrap}>
            <ShoppingBag size={20} color={colors.primary} />
          </View>
          <Text style={styles.metricLabel}>Total Orders</Text>
          <Text style={styles.metricValue}>{totalOrders}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: '#fef3c7' }]}>
            <Clock size={20} color="#d97706" />
          </View>
          <Text style={styles.metricLabel}>Pending Escrow</Text>
          <Text style={[styles.metricValue, { color: '#d97706' }]}>
            {formatPrice(escrowBalance)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: '#dcfce7' }]}>
            <TrendingUp size={20} color="#16a34a" />
          </View>
          <Text style={styles.metricLabel}>Total Sales</Text>
          <Text style={[styles.metricValue, { color: '#16a34a' }]}>{formatPrice(revenue)}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: '#e0e7ff' }]}>
            <CreditCard size={20} color="#4338ca" />
          </View>
          <Text style={styles.metricLabel}>Net Settled</Text>
          <Text style={[styles.metricValue, { color: '#4338ca' }]}>
            {formatPrice(netRevenue)}
          </Text>
        </View>
      </View>

      {/* Performance Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <TrendingUp size={20} color={colors.primary} />
          <Text style={styles.summaryTitle}>Operational Efficiency</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Average Order Value</Text>
          <Text style={styles.statValue}>{formatPrice(avgOrderValue)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Escrow Protection Rate</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>100% Guaranteed</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Settlement Speed</Text>
          <Text style={styles.statValue}>Instant on Receipt</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    marginTop: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});

