import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Wallet,
  Clock,
  ArrowDownToLine,
  TrendingUp,
  FileText,
  Landmark,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { PayoutReceiptModal } from './PayoutReceiptModal';

interface WalletTabProps {
  wallet: any;
  transactions: any[];
  payoutRequests?: any[];
  onRequestPayout: () => void;
  loading?: boolean;
}

export function WalletTab({
  wallet,
  transactions,
  payoutRequests = [],
  onRequestPayout,
  loading = false,
}: WalletTabProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
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

      {/* Payout Requests History (Withdrawals) */}
      {payoutRequests.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Withdrawal Requests</Text>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{payoutRequests.length} LOGGED</Text>
            </View>
          </View>

          <View style={styles.payoutList}>
            {payoutRequests.map((req) => {
              const status = (req.status || 'pending').toLowerCase();
              const isCompleted = status === 'completed';
              const isRejected = status === 'rejected';

              const iconBg = isCompleted ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7';
              const iconColor = isCompleted ? '#15803d' : isRejected ? '#b91c1c' : '#b45309';

              const badgeBg = isCompleted ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7';
              const badgeColor = isCompleted ? '#15803d' : isRejected ? '#b91c1c' : '#b45309';
              const badgeLabel = isCompleted ? 'PAID' : isRejected ? 'REJECTED' : 'PENDING REVIEW';

              return (
                <TouchableOpacity
                  key={req.id}
                  style={styles.payoutCard}
                  activeOpacity={0.7}
                  onPress={() => setSelectedReceipt(req)}
                >
                  <View style={styles.payoutLeft}>
                    <View style={[styles.payoutIconWrap, { backgroundColor: iconBg }]}>
                      <Landmark size={18} color={iconColor} strokeWidth={2.5} />
                    </View>
                    <View style={styles.payoutMeta}>
                      <Text style={styles.payoutTitle}>Withdrawal Request</Text>
                      <View style={styles.payoutStatusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                            {badgeLabel}
                          </Text>
                        </View>
                        <Text style={styles.payoutDate}>
                          {req.created_at
                            ? new Date(req.created_at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Pending'}
                        </Text>
                      </View>
                      <Text style={styles.payoutBank}>
                        {req.bank_name || 'Bank'} • {req.account_number || ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.payoutRight}>
                    <Text style={styles.payoutAmount}>{formatPrice(Number(req.amount || 0))}</Text>
                    <Text style={styles.payoutFee}>
                      Fee: ₦{Number(req.fee_amount || 0).toLocaleString()}
                    </Text>
                    <View style={styles.receiptPill}>
                      <FileText size={12} color="#64748b" />
                      <Text style={styles.receiptPillText}>Receipt</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

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
            <Text style={styles.emptyTitle}>
              {payoutRequests.length > 0 ? 'No Settled Orders Yet' : 'No Transactions Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {payoutRequests.length > 0
                ? 'Your order escrow payouts and completions will appear here.'
                : 'Completed order payouts and withdrawals will be logged here.'}
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

      {/* Payout Receipt Details Modal */}
      <PayoutReceiptModal
        visible={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        request={selectedReceipt}
      />
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  payoutList: {
    gap: 10,
  },
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  payoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutMeta: {
    flex: 1,
    gap: 2,
  },
  payoutTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  payoutStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  payoutDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  payoutBank: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  payoutRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  payoutAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  payoutFee: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  receiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  receiptPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
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
