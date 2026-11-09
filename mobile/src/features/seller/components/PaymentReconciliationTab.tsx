import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CreditCard, Search, CheckCircle2, Clock, AlertTriangle } from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface PaymentReconciliationTabProps {
  settlements: any[];
  loading?: boolean;
}

const FILTER_OPTIONS = ['all', 'paid', 'pending', 'failed'];

export function PaymentReconciliationTab({
  settlements,
  loading = false,
}: PaymentReconciliationTabProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      const matchSearch =
        search.trim() === '' ||
        (s.id && s.id.toLowerCase().includes(search.toLowerCase())) ||
        (s.payment_ref && s.payment_ref.toLowerCase().includes(search.toLowerCase()));

      const status = (s.settlement_status || s.payment_status || 'pending').toLowerCase();
      const matchFilter = activeFilter === 'all' || status === activeFilter;

      return matchSearch && matchFilter;
    });
  }, [settlements, search, activeFilter]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View>
        <Text style={styles.subtitle}>Escrow Settlements</Text>
        <Text style={styles.title}>Payment History</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order ref or payment ID..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {opt.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payment settlements...</Text>
        </View>
      ) : filteredSettlements.length === 0 ? (
        <View style={styles.emptyCard}>
          <CreditCard size={36} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Reconciliation Records</Text>
          <Text style={styles.emptySubtitle}>
            When orders are settled into your wallet, payout records appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.settlementList}>
          {filteredSettlements.map((item) => {
            const status = (item.settlement_status || item.payment_status || 'pending').toLowerCase();
            const isPaid = status === 'paid' || status === 'completed' || status === 'settled';

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.orderRef}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    {item.payment_ref && (
                      <Text style={styles.payRef}>Paystack: {item.payment_ref}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isPaid ? styles.paidBadge : styles.pendingBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isPaid ? styles.paidBadgeText : styles.pendingBadgeText,
                      ]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.amountLabel}>Merchant Payout</Text>
                    <Text style={styles.sellerAmount}>
                      {formatPrice(item.seller_amount || item.grand_total || 0)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Order Total</Text>
                    <Text style={styles.grandTotal}>
                      {formatPrice(item.grand_total || 0)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      )}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  settlementList: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderRef: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  payRef: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paidBadge: {
    backgroundColor: '#dcfce7',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  paidBadgeText: {
    color: '#15803d',
  },
  pendingBadgeText: {
    color: '#b45309',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  sellerAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2,
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
});

