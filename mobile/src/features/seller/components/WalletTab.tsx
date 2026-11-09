import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Wallet,
  Clock,
  ArrowDownToLine,
  TrendingUp,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface WalletTabProps {
  wallet: any;
  transactions: any[];
  onRequestPayout: () => void;
  loading?: boolean;
}

export function WalletTab({
  wallet,
  transactions,
  onRequestPayout,
  loading = false,
}: WalletTabProps) {
  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const availableBalance = wallet?.balance || 0;
  const escrowBalance = wallet?.escrow_balance || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View>
        <Text style={styles.subtitle}>Financial Ledger</Text>
        <Text style={styles.title}>Merchant Wallet</Text>
      </View>

      {/* Balance Cards */}
      <View style={styles.balanceGrid}>
        <View style={styles.primaryBalanceCard}>
          <View style={styles.balanceTopRow}>
            <Text style={styles.balanceCardLabel}>Available Payout</Text>
            <Wallet size={18} color="#ffffff" opacity={0.8} />
          </View>
          <Text style={styles.primaryBalanceValue}>{formatPrice(availableBalance)}</Text>
          <TouchableOpacity
            style={styles.payoutBtn}
            onPress={onRequestPayout}
            activeOpacity={0.8}
          >
            <ArrowDownToLine size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.payoutBtnText}>Request Withdrawal</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.escrowCard}>
          <View style={styles.balanceTopRow}>
            <Text style={styles.escrowCardLabel}>Escrow in Transit</Text>
            <Clock size={18} color="#d97706" />
          </View>
          <Text style={styles.escrowValue}>{formatPrice(escrowBalance)}</Text>
          <Text style={styles.escrowSubText}>
            Protected in escrow. Released as soon as buyers confirm safe delivery receipt.
          </Text>
        </View>
      </View>

      {/* Transactions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileText size={36} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Completed order payouts and withdrawals will be logged here.
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {transactions.map((tx) => {
              const isSettlement = tx.type === 'settlement' || tx.type === 'credit';
              return (
                <View key={tx.id} style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <View
                      style={[
                        styles.txIconWrap,
                        isSettlement ? styles.creditIconWrap : styles.debitIconWrap,
                      ]}
                    >
                      {isSettlement ? (
                        <TrendingUp size={16} color="#16a34a" />
                      ) : (
                        <ArrowDownToLine size={16} color="#ea580c" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.txType}>
                        {tx.type ? tx.type.toUpperCase() : 'TRANSACTION'}
                      </Text>
                      <Text style={styles.txRef}>
                        {tx.reference || tx.id.slice(0, 10).toUpperCase()}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        isSettlement ? styles.txCreditText : styles.txDebitText,
                      ]}
                    >
                      {isSettlement ? '+' : '-'}
                      {formatPrice(Math.abs(tx.amount || 0))}
                    </Text>
                    <View style={styles.txStatusPill}>
                      <Text style={styles.txStatusText}>
                        {tx.status ? tx.status.toUpperCase() : 'COMPLETED'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
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
  balanceGrid: {
    gap: 12,
  },
  primaryBalanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.9,
  },
  primaryBalanceValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginVertical: 12,
  },
  payoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 14,
  },
  payoutBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  escrowCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  escrowCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  escrowValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#b45309',
    marginTop: 8,
    marginBottom: 4,
  },
  escrowSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a16207',
    lineHeight: 16,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centerLoading: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  txList: {
    gap: 10,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditIconWrap: {
    backgroundColor: '#dcfce7',
  },
  debitIconWrap: {
    backgroundColor: '#ffedd5',
  },
  txType: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  txRef: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  txDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  txCreditText: {
    color: '#16a34a',
  },
  txDebitText: {
    color: '#ea580c',
  },
  txStatusPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
});

