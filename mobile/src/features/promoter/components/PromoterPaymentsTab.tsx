import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Wallet,
  Clock,
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { WithdrawalItem } from '../hooks/usePromoterData';

const BRAND_ORANGE = '#EB7D30';

interface PromoterPaymentsTabProps {
  availableBalance: number;
  escrowBalance: number;
  withdrawals: WithdrawalItem[];
  onOpenWithdrawModal: () => void;
}

export function PromoterPaymentsTab({
  availableBalance,
  escrowBalance,
  withdrawals,
  onOpenWithdrawModal,
}: PromoterPaymentsTabProps) {
  return (
    <View style={styles.container}>
      {/* 1. Wallet Balances Row */}
      <View style={styles.balanceCardsRow}>
        {/* Available Balance */}
        <View style={styles.balanceCardOrange}>
          <View style={styles.balanceCardHeader}>
            <View style={styles.iconCircleOrange}>
              <Wallet size={16} color={BRAND_ORANGE} />
            </View>
            <View style={styles.tagOrange}>
              <Text style={styles.tagOrangeText}>READY</Text>
            </View>
          </View>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceValueOrange} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            ₦{availableBalance.toLocaleString()}
          </Text>
          <Text style={styles.balanceSubtext}>Instant payout ready</Text>
        </View>

        {/* Escrow Hold */}
        <View style={styles.balanceCardAmber}>
          <View style={styles.balanceCardHeader}>
            <View style={styles.iconCircleAmber}>
              <Clock size={16} color="#D97706" />
            </View>
            <View style={styles.tagAmber}>
              <Text style={styles.tagAmberText}>ESCROW</Text>
            </View>
          </View>
          <Text style={styles.balanceLabel}>SAFETY HOLD</Text>
          <Text style={styles.balanceValueAmber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            ₦{escrowBalance.toLocaleString()}
          </Text>
          <Text style={styles.balanceSubtext}>Releases on delivery</Text>
        </View>
      </View>

      {/* 2. Payout Action Button */}
      <TouchableOpacity
        style={[styles.withdrawBtn, availableBalance < 1000 && styles.withdrawBtnDisabled]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenWithdrawModal();
        }}
        activeOpacity={0.85}
      >
        <ArrowDownToLine size={18} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.withdrawBtnText}>REQUEST WITHDRAWAL</Text>
      </TouchableOpacity>

      {availableBalance < 1000 && (
        <View style={styles.thresholdNotice}>
          <AlertCircle size={12} color="#94A3B8" />
          <Text style={styles.thresholdText}>Minimum withdrawal threshold is ₦1,000</Text>
        </View>
      )}

      {/* 3. Escrow Trust Guarantee */}
      <View style={styles.securityBanner}>
        <ShieldCheck size={20} color={BRAND_ORANGE} />
        <View style={{ flex: 1 }}>
          <Text style={styles.securityTitle}>Protected Escrow Payouts</Text>
          <Text style={styles.securitySub}>
            Commissions are held safely in escrow until the customer confirms delivery, then released directly into your ready balance.
          </Text>
        </View>
      </View>

      {/* 4. Payout History */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>WITHDRAWAL HISTORY</Text>
          <Text style={styles.historyBadge}>{withdrawals.length} requests</Text>
        </View>

        {withdrawals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Wallet size={32} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Withdrawals Yet</Text>
            <Text style={styles.emptySub}>
              Once you hit the ₦1,000 minimum balance, submit a bank withdrawal and your history will be logged here.
            </Text>
          </View>
        ) : (
          withdrawals.map((w) => {
            const isApproved = w.status === 'approved' || w.status === 'completed' || w.status === 'paid';
            const isPending = w.status === 'pending';
            const isRejected = w.status === 'rejected';

            return (
              <View key={w.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View
                    style={[
                      styles.statusIconCircle,
                      isApproved && styles.statusIconCircleApproved,
                      isPending && styles.statusIconCirclePending,
                      isRejected && styles.statusIconCircleRejected,
                    ]}
                  >
                    {isApproved && <CheckCircle2 size={16} color={BRAND_ORANGE} />}
                    {isPending && <Clock size={16} color="#D97706" />}
                    {isRejected && <XCircle size={16} color="#EF4444" />}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.historyAmount}>₦{w.amount.toLocaleString()}</Text>
                    <Text style={styles.historyBank} numberOfLines={1}>
                      {w.bank_name ? `${w.bank_name} •••• ${w.account_number?.slice(-4) || ''}` : 'Bank Transfer'}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(w.created_at).toLocaleDateString()} at{' '}
                      {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {w.admin_notes && (
                      <Text style={styles.adminNotesText} numberOfLines={2}>
                        Note: {w.admin_notes}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.historyBadgePill,
                    isApproved && styles.historyBadgeApproved,
                    isPending && styles.historyBadgePending,
                    isRejected && styles.historyBadgeRejected,
                  ]}
                >
                  <Text
                    style={[
                      styles.historyBadgePillText,
                      isApproved && styles.historyBadgePillTextApproved,
                      isPending && styles.historyBadgePillTextPending,
                      isRejected && styles.historyBadgePillTextRejected,
                    ]}
                  >
                    {w.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            );
          })
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
  balanceCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceCardOrange: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  balanceCardAmber: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconCircleOrange: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleAmber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagOrange: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagOrangeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: BRAND_ORANGE,
  },
  tagAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagAmberText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#92400E',
  },
  balanceLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  balanceValueOrange: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND_ORANGE,
    letterSpacing: -0.3,
  },
  balanceValueAmber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: -0.3,
  },
  balanceSubtext: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  withdrawBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND_ORANGE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  withdrawBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  thresholdNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -8,
  },
  thresholdText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
  },
  securityTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  securitySub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginTop: 1,
  },
  historySection: {
    gap: 10,
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  historyTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  historyBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 240,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  statusIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconCircleApproved: {
    backgroundColor: '#FFF7ED',
  },
  statusIconCirclePending: {
    backgroundColor: '#FEF3C7',
  },
  statusIconCircleRejected: {
    backgroundColor: '#FEE2E2',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  historyBank: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 1,
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  adminNotesText: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
    fontWeight: '600',
  },
  historyBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyBadgeApproved: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  historyBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  historyBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  historyBadgePillText: {
    fontSize: 9,
    fontWeight: '900',
  },
  historyBadgePillTextApproved: {
    color: BRAND_ORANGE,
  },
  historyBadgePillTextPending: {
    color: '#B45309',
  },
  historyBadgePillTextRejected: {
    color: '#B91C1C',
  },
});
