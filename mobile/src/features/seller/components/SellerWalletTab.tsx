import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import {
  Wallet,
  TrendingUp,
  Clock,
  Calendar,
  ArrowDownToLine,
  Landmark,
  Receipt,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Share2,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { format, addDays, isAfter } from 'date-fns';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';

interface SellerWalletTabProps {
  wallet: any;
  transactions: any[];
  onRefreshWallet: () => Promise<void>;
}

export function SellerWalletTab({
  wallet,
  transactions,
  onRefreshWallet,
}: SellerWalletTabProps) {
  const { user, profile, refreshProfile } = useAuth();

  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Payout settings & cooldown
  const [withdrawalFee, setWithdrawalFee] = useState<number>(0);
  const [intervalDays, setIntervalDays] = useState<number>(7);
  const [lastRequestDate, setLastRequestDate] = useState<string | null>(null);

  // Withdrawal form state
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState((profile as any)?.payout_bank_name || '');
  const [accountNumber, setAccountNumber] = useState(
    (profile as any)?.payout_account_number || ''
  );
  const [accountName, setAccountName] = useState((profile as any)?.payout_account_name || '');
  const [saveForLater, setSaveForLater] = useState(true);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const loadPayoutData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [reqsRes, settingsRes, lastReqRes, profRes] = await Promise.all([
        supabase
          .from('payout_requests')
          .select(
            'id, amount, fee_amount, status, created_at, bank_name, account_number, account_name, admin_notes'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        (supabase as any).from('system_settings').select('key, value'),
        supabase
          .from('payout_requests')
          .select('created_at')
          .eq('user_id', user.id)
          .neq('status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('payout_bank_name, payout_account_number, payout_account_name')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (reqsRes.data) {
        setPayoutRequests(reqsRes.data as any[]);
      }

      if (settingsRes.data) {
        const feeRow = (settingsRes.data as any[]).find((s) => s.key === 'withdrawal_fee');
        const intervalRow = (settingsRes.data as any[]).find(
          (s) => s.key === 'payout_interval_days'
        );
        if (feeRow?.value?.amount !== undefined) {
          setWithdrawalFee(Number(feeRow.value.amount) || 0);
        }
        if (intervalRow?.value !== undefined) {
          setIntervalDays(Number(intervalRow.value) || 7);
        }
      }

      if (lastReqRes.data?.created_at) {
        setLastRequestDate(lastReqRes.data.created_at);
      } else {
        setLastRequestDate(null);
      }

      if (profRes.data) {
        const p = profRes.data as any;
        if (p.payout_bank_name && !bankName) setBankName(p.payout_bank_name);
        if (p.payout_account_number && !accountNumber) setAccountNumber(p.payout_account_number);
        if (p.payout_account_name && !accountName) setAccountName(p.payout_account_name);
      }
    } catch (e) {
      console.warn('[SellerWalletTab] Load payout data error:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPayoutData();
  }, [loadPayoutData]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`seller-payouts-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests', filter: `user_id=eq.${user.id}` },
        () => {
          loadPayoutData();
          onRefreshWallet();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, loadPayoutData, onRefreshWallet]);

  const settlementTransactions = transactions.filter(
    (t: any) => t.type === 'settlement' && (t.status === 'success' || t.status === 'completed')
  );
  const totalSettled = settlementTransactions.reduce(
    (acc: number, t: any) => acc + Number(t.amount || 0),
    0
  );
  const escrowBalance = Number(wallet?.escrow_balance ?? 0);
  const currentBalance = Number(wallet?.balance ?? 0);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const monthlySettled = settlementTransactions
    .filter((t: any) => new Date(t.created_at) >= thisMonth)
    .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0);

  const nextAvailableDate = lastRequestDate
    ? addDays(new Date(lastRequestDate), intervalDays)
    : new Date();
  const canRequest =
    !lastRequestDate || isAfter(new Date(), new Date(nextAvailableDate.getTime() - 1000));

  const withdrawalAmount = Number(amount) || 0;
  const totalDeduction = withdrawalAmount + withdrawalFee;
  const isInsufficient = totalDeduction > currentBalance;

  const handleSubmitWithdrawal = async () => {
    if (!user) return;
    if (!canRequest) {
      toast.error('Cooldown Active', {
        description: `You can only request payouts every ${intervalDays} days.`,
      });
      return;
    }
    if (withdrawalAmount <= 0) {
      toast.error('Invalid Amount', {
        description: 'Please enter a valid withdrawal amount greater than zero.',
      });
      return;
    }
    if (isInsufficient) {
      toast.error('Insufficient Balance', {
        description: 'Balance cannot cover the withdrawal amount and fee.',
      });
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast.error('Bank Details Required', {
        description: 'Please provide your bank name, 10-digit account number, and account name.',
      });
      return;
    }

    setSubmittingPayout(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      const { error } = await (supabase as any).rpc('request_wallet_payout', {
        p_amount: withdrawalAmount,
        p_bank_name: bankName.trim(),
        p_account_number: accountNumber.trim(),
        p_account_name: accountName.trim(),
      });

      if (error) throw error;

      // Save bank details to profile if checked
      if (saveForLater) {
        await supabase
          .from('profiles')
          .update({
            payout_bank_name: bankName.trim(),
            payout_account_number: accountNumber.trim(),
            payout_account_name: accountName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        refreshProfile().catch(() => { });
      }

      // Notify admins in background
      supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .then(({ data: admins }) => {
          if (admins && admins.length > 0) {
            Promise.all(
              admins.map((a: any) =>
                supabase.functions.invoke('send-push', {
                  body: {
                    target_user_id: a.user_id,
                    title: 'Action Required: New Payout Request 💰',
                    message: `A new payout request of ₦${withdrawalAmount.toLocaleString('en-NG')} needs review.`,
                    url: '/admin/payments',
                  },
                })
              )
            ).catch(() => { });
          }
        });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      toast.success('Payout Request Submitted!', {
        description: `₦${withdrawalAmount.toLocaleString('en-NG')} withdrawal queued for bank settlement.`,
      });

      setAmount('');
      setPayoutModalOpen(false);
      await Promise.all([loadPayoutData(), onRefreshWallet()]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      toast.error('Withdrawal Failed', {
        description: err?.message || 'Could not process your payout request.',
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleShareReceipt = async (req: any) => {
    try {
      const dateStr = req.created_at
        ? format(new Date(req.created_at), 'MMM d, yyyy')
        : 'Pending';
      await Share.share({
        title: `Linkup Withdrawal Receipt #${String(req.id).slice(0, 8).toUpperCase()}`,
        message: [
          `LINKUP FINANCIAL HUB - WITHDRAWAL RECEIPT`,
          `Receipt ID: ${String(req.id).slice(0, 13).toUpperCase()}`,
          `Status: ${String(req.status).toUpperCase()}`,
          `Net Payout: ₦${Number(req.amount || 0).toLocaleString('en-NG')} NGN`,
          `Fee: ₦${Number(req.fee_amount || 0).toLocaleString('en-NG')}`,
          `Total Deduction: ₦${Number((req.amount || 0) + (req.fee_amount || 0)).toLocaleString('en-NG')}`,
          `Bank: ${req.bank_name}`,
          `Account: ${req.account_name} (${req.account_number})`,
          `Date Requested: ${dateStr}`,
        ].join('\n'),
      });
    } catch { }
  };

  const getReceiptStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#DCFCE7', text: '#166534', label: 'PAID', Icon: CheckCircle2 };
      case 'approved':
        return {
          bg: '#DBEAFE',
          text: '#1E40AF',
          label: 'APPROVED (PROCESSING)',
          Icon: CheckCircle2,
        };
      case 'processing':
        return { bg: '#DBEAFE', text: '#1E40AF', label: 'PROCESSING', Icon: Clock };
      case 'rejected':
        return { bg: '#FEE2E2', text: '#991B1B', label: 'REJECTED', Icon: XCircle };
      default:
        return { bg: '#FEF3C7', text: '#92400E', label: 'PENDING REVIEW', Icon: Clock };
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.eyebrow}>YOUR MONEY</Text>
        <Text style={styles.title}>Wallet & Payouts</Text>
      </View>

      {/* Main Balance Hero Card */}
      <View style={styles.balanceHeroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroWalletIconBox}>
            <Wallet size={20} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <View style={styles.secureWalletPill}>
            <Text style={styles.secureWalletPillText}>SECURE WALLET</Text>
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.availableLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.availableAmount}>
              <Text style={{ fontSize: 18, opacity: 0.7 }}>₦</Text>
              {currentBalance.toLocaleString('en-NG')}
            </Text>
            <Text style={styles.totalEarnedSub}>
              Total earned: ₦{totalSettled.toLocaleString('en-NG')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.withdrawFundsBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
              setPayoutModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            <ArrowDownToLine size={15} color={colors.primary} strokeWidth={2.6} />
            <Text style={styles.withdrawFundsBtnText}>WITHDRAW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Secondary Stats Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>THIS MONTH</Text>
          <Text style={styles.statCardVal}>₦{monthlySettled.toLocaleString('en-NG')}</Text>
          <View style={styles.statTrendRow}>
            <TrendingUp size={13} color="#10B981" strokeWidth={2.6} />
            <Text style={styles.statTrendText}>{settlementTransactions.length} ORDERS</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>IN PROCESS (ESCROW)</Text>
          <Text style={styles.statCardVal}>₦{escrowBalance.toLocaleString('en-NG')}</Text>
          <View style={styles.statTrendRow}>
            <Clock size={13} color="#D97706" strokeWidth={2.6} />
            <Text style={[styles.statTrendText, { color: '#D97706' }]}>PENDING RELEASE</Text>
          </View>
        </View>
      </View>

      {/* Payout Requests History */}
      {payoutRequests.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>PAYOUT HISTORY</Text>
          <View style={{ gap: 10 }}>
            {payoutRequests.map((req) => {
              const isCompleted = req.status === 'completed';
              const isRejected = req.status === 'rejected';
              return (
                <TouchableOpacity
                  key={req.id}
                  style={styles.payoutItemCard}
                  onPress={() => setSelectedReceipt(req)}
                  activeOpacity={0.85}
                >
                  <View style={styles.payoutItemLeft}>
                    <View
                      style={[
                        styles.payoutIconCircle,
                        isCompleted
                          ? { backgroundColor: '#ECFDF5' }
                          : isRejected
                            ? { backgroundColor: '#FEF2F2' }
                            : { backgroundColor: '#FFFBEB' },
                      ]}
                    >
                      <Landmark
                        size={17}
                        color={isCompleted ? '#059669' : isRejected ? '#DC2626' : '#D97706'}
                      />
                    </View>
                    <View>
                      <Text style={styles.payoutItemTitle}>WITHDRAWAL REQUEST</Text>
                      <View style={styles.payoutMetaRow}>
                        <View
                          style={[
                            styles.payoutStatusBadge,
                            isCompleted
                              ? { backgroundColor: '#DCFCE7' }
                              : isRejected
                                ? { backgroundColor: '#FEE2E2' }
                                : { backgroundColor: '#FEF3C7' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.payoutStatusText,
                              isCompleted
                                ? { color: '#15803D' }
                                : isRejected
                                  ? { color: '#B91C1C' }
                                  : { color: '#B45309' },
                            ]}
                          >
                            {String(req.status).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.payoutDateText}>
                          {req.created_at
                            ? format(new Date(req.created_at), 'MMM d, yyyy')
                            : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.payoutItemRight}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.payoutAmountText}>
                        ₦{Number(req.amount || 0).toLocaleString('en-NG')}
                      </Text>
                      <Text style={styles.payoutFeeText}>
                        FEE: ₦{Number(req.fee_amount || 0).toLocaleString('en-NG')}
                      </Text>
                    </View>
                    <View style={styles.receiptIconBtn}>
                      <Receipt size={15} color="#64748B" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>TRANSACTION HISTORY</Text>
          <View style={{ gap: 8 }}>
            {transactions.map((t) => {
              const amt = Number(t.amount || 0);
              const isPositive = amt > 0;
              return (
                <View key={t.id} style={styles.txItemCard}>
                  <View style={styles.payoutItemLeft}>
                    <View
                      style={[
                        styles.payoutIconCircle,
                        isPositive
                          ? { backgroundColor: '#F0FDF4' }
                          : { backgroundColor: '#FEF2F2' },
                      ]}
                    >
                      <TrendingUp
                        size={17}
                        color={isPositive ? '#16A34A' : '#EF4444'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutItemTitle}>
                        {String(t.type || 'transaction').replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <View style={styles.payoutMetaRow}>
                        <Calendar size={10} color="#94A3B8" />
                        <Text style={styles.payoutDateText}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                        </Text>
                        {t.reference ? (
                          <Text style={styles.txRefSnippet} numberOfLines={1}>
                            · {t.reference}
                          </Text>
                        ) : null}
                        {t.status === 'pending' && (
                          <View style={styles.onHoldBadge}>
                            <Text style={styles.onHoldBadgeText}>ON HOLD</Text>
                          </View>
                        )}
                      </View>
                      {t.status === 'pending' && t.metadata?.reason ? (
                        <Text style={styles.holdReasonText}>{t.metadata.reason}</Text>
                      ) : null}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.txAmountText,
                      isPositive ? { color: '#16A34A' } : { color: '#EF4444' },
                    ]}
                  >
                    {isPositive ? '+' : '-'} ₦{Math.abs(amt).toLocaleString('en-NG')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Withdrawal Hub Modal (Matches PayoutRequestModal.tsx) */}
      <Modal
        visible={payoutModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPayoutModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPayoutModalOpen(false)}
          />

          <View style={styles.modalSheet}>
            {/* Orange Header */}
            <View style={styles.payoutModalHeader}>
              <View style={styles.payoutModalTopRow}>
                <View>
                  <Text style={styles.payoutModalTitle}>Withdrawal Hub</Text>
                  <Text style={styles.payoutModalSubtitle}>
                    Withdraw your earnings to your bank account.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseWhiteBtn}
                  onPress={() => setPayoutModalOpen(false)}
                >
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.payoutModalBalanceBox}>
                <View>
                  <Text style={styles.payoutModalBalanceLabel}>AVAILABLE BALANCE</Text>
                  <Text style={styles.payoutModalBalanceVal}>
                    ₦{currentBalance.toLocaleString('en-NG')}
                  </Text>
                </View>
                <Wallet size={28} color="rgba(255,255,255,0.45)" />
              </View>
            </View>

            <ScrollView
              style={{ maxHeight: 440 }}
              contentContainerStyle={{ padding: 20, gap: 14 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!canRequest && (
                <View style={styles.cooldownAlertBox}>
                  <Clock size={16} color="#B45309" />
                  <Text style={styles.cooldownAlertText}>
                    Wait Period: You can request your next payout on{' '}
                    {format(nextAvailableDate, 'MMM d, yyyy')}.
                  </Text>
                </View>
              )}

              <View>
                <Text style={styles.inputLabel}>AMOUNT TO WITHDRAW (₦)</Text>
                <TextInput
                  style={[styles.input, { fontSize: 17, fontWeight: '900' }]}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  value={amount}
                  onChangeText={(val) => {
                    if (val === '' || parseFloat(val) >= 0) {
                      setAmount(val);
                    }
                  }}
                />
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>BANK NAME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. GTBank"
                    placeholderTextColor="#94A3B8"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholder="10 digits"
                    placeholderTextColor="#94A3B8"
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                  />
                </View>
              </View>

              <View>
                <Text style={styles.inputLabel}>ACCOUNT NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name on account"
                  placeholderTextColor="#94A3B8"
                  value={accountName}
                  onChangeText={setAccountName}
                />
              </View>

              <View style={styles.saveLaterRow}>
                <Text style={styles.saveLaterLabel}>Save these details for future use</Text>
                <Switch
                  value={saveForLater}
                  onValueChange={setSaveForLater}
                  trackColor={{ false: '#E2E8F0', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.deductionSummaryBox}>
                <View style={styles.deductionRow}>
                  <Text style={styles.deductionFeeLabel}>Withdrawal Fee</Text>
                  <Text style={styles.deductionFeeVal}>
                    ₦{withdrawalFee.toLocaleString('en-NG')}
                  </Text>
                </View>
                <View style={styles.deductionRow}>
                  <Text style={styles.deductionTotalLabel}>TOTAL DEDUCTION</Text>
                  <Text
                    style={[
                      styles.deductionTotalVal,
                      isInsufficient && { color: '#EF4444' },
                    ]}
                  >
                    ₦{totalDeduction.toLocaleString('en-NG')}
                  </Text>
                </View>
                {isInsufficient && (
                  <View style={styles.insufficientRow}>
                    <AlertCircle size={12} color="#EF4444" />
                    <Text style={styles.insufficientText}>Exceeds available balance</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitWithdrawBtn,
                  (!canRequest ||
                    !amount ||
                    withdrawalAmount <= 0 ||
                    isInsufficient ||
                    submittingPayout) && { opacity: 0.5 },
                ]}
                disabled={
                  !canRequest ||
                  !amount ||
                  withdrawalAmount <= 0 ||
                  isInsufficient ||
                  submittingPayout
                }
                onPress={handleSubmitWithdrawal}
              >
                {submittingPayout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitWithdrawBtnText}>WITHDRAW FUNDS</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdrawal Receipt Modal (Matches PayoutReceiptModal.tsx) */}
      <Modal
        visible={!!selectedReceipt}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedReceipt(null)}
          />

          {selectedReceipt && (() => {
            const st = getReceiptStatusConfig(selectedReceipt.status);
            const StatusIcon = st.Icon;
            return (
              <View style={styles.modalSheet}>
                {/* Receipt Header */}
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptBrandRow}>
                    <View style={styles.receiptBrandBadge}>
                      <Landmark size={16} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.receiptBrandName}>Linkup</Text>
                      <Text style={styles.receiptBrandSub}>FINANCIAL HUB</Text>
                    </View>
                  </View>

                  <Text style={styles.receiptTitle}>Withdrawal Receipt</Text>
                  <Text style={styles.receiptIdText}>
                    ID: {String(selectedReceipt.id).slice(0, 13).toUpperCase()}
                  </Text>

                  <View style={[styles.receiptFloatingBadge, { backgroundColor: st.bg }]}>
                    <StatusIcon size={13} color={st.text} />
                    <Text style={[styles.receiptFloatingBadgeText, { color: st.text }]}>
                      {st.label}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  style={{ maxHeight: 420 }}
                  contentContainerStyle={{ padding: 22, paddingTop: 26, gap: 18 }}
                >
                  {/* Net Payout */}
                  <View>
                    <Text style={styles.receiptSectionLabel}>NET PAYOUT (TO BANK)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text style={styles.receiptNetAmount}>
                        ₦{Number(selectedReceipt.amount || 0).toLocaleString('en-NG')}
                      </Text>
                      <Text style={styles.receiptCurrencyText}>NGN</Text>
                    </View>
                    <View style={styles.receiptDeductionTag}>
                      <Wallet size={12} color={colors.primary} />
                      <Text style={styles.receiptDeductionTagText}>
                        Total Wallet Deduction: ₦
                        {Number(
                          (selectedReceipt.amount || 0) + (selectedReceipt.fee_amount || 0)
                        ).toLocaleString('en-NG')}{' '}
                        (incl. ₦{Number(selectedReceipt.fee_amount || 0).toLocaleString('en-NG')}{' '}
                        fee)
                      </Text>
                    </View>
                  </View>

                  {/* Bank & Date */}
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receiptSectionLabel}>BANK NAME</Text>
                      <Text style={styles.receiptFieldValue}>
                        {selectedReceipt.bank_name || 'N/A'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receiptSectionLabel}>DATE REQUESTED</Text>
                      <Text style={styles.receiptFieldValue}>
                        {selectedReceipt.created_at
                          ? format(new Date(selectedReceipt.created_at), 'MMM d, yyyy')
                          : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Account Details */}
                  <View>
                    <Text style={styles.receiptSectionLabel}>ACCOUNT DETAILS</Text>
                    <View style={styles.receiptAccountBox}>
                      <Text style={styles.receiptAccountName}>
                        {selectedReceipt.account_name}
                      </Text>
                      <Text style={styles.receiptAccountNumber}>
                        {selectedReceipt.account_number}
                      </Text>
                    </View>
                  </View>

                  {selectedReceipt.admin_notes ? (
                    <View style={styles.receiptAdminNoteBox}>
                      <AlertCircle size={15} color="#D97706" />
                      <Text style={styles.receiptAdminNoteText}>
                        {selectedReceipt.admin_notes}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptFooterActions}>
                    <TouchableOpacity
                      style={styles.shareReceiptBtn}
                      onPress={() => handleShareReceipt(selectedReceipt)}
                    >
                      <Share2 size={15} color="#FFFFFF" />
                      <Text style={styles.shareReceiptBtnText}>SHARE RECEIPT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.closeReceiptBtn}
                      onPress={() => setSelectedReceipt(null)}
                    >
                      <XCircle size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  balanceHeroCard: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    gap: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWalletIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureWalletPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  secureWalletPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  availableLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  availableAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  totalEarnedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  withdrawFundsBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  withdrawFundsBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statCardLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  statCardVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  statTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  statTrendText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 2,
  },
  payoutItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  payoutIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutItemTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  payoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  payoutStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  payoutStatusText: {
    fontSize: 8,
    fontWeight: '900',
  },
  payoutDateText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  payoutItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payoutAmountText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  payoutFeeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  receiptIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  txRefSnippet: {
    fontSize: 9,
    color: '#94A3B8',
    maxWidth: 100,
  },
  onHoldBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  onHoldBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#B45309',
  },
  holdReasonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  payoutModalHeader: {
    backgroundColor: colors.primary,
    padding: 22,
    gap: 16,
  },
  payoutModalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  payoutModalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  payoutModalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  modalCloseWhiteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutModalBalanceBox: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutModalBalanceLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.4,
  },
  payoutModalBalanceVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  cooldownAlertBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cooldownAlertText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveLaterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveLaterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  deductionSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  deductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deductionFeeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  deductionFeeVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  deductionTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  deductionTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  insufficientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  insufficientText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  submitWithdrawBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitWithdrawBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  receiptHeader: {
    backgroundColor: colors.primary,
    padding: 24,
    paddingBottom: 30,
    position: 'relative',
  },
  receiptBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  receiptBrandBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptBrandName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  receiptBrandSub: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.4,
  },
  receiptTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  receiptIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  receiptFloatingBadge: {
    position: 'absolute',
    bottom: -14,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  receiptFloatingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  receiptSectionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  receiptNetAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
  },
  receiptCurrencyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  receiptDeductionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  receiptDeductionTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  receiptFieldValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  receiptAccountBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 2,
  },
  receiptAccountName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  receiptAccountNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  receiptAdminNoteBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    flexDirection: 'row',
    gap: 8,
  },
  receiptAdminNoteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  receiptFooterActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  shareReceiptBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareReceiptBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  closeReceiptBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
