import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import {
  Wallet,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  CheckCircle,
  CreditCard,
  ShieldCheck,
  X,
  AlertCircle,
  Building2,
  Calendar,
  Package,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { PayoutReceiptModal } from '../../seller/components/PayoutReceiptModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DAILY_LIMIT = 50000;

export function LogisticsEarningsTabV2() {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [completedMissions, setCompletedMissions] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'missions' | 'withdrawals'>('missions');
  const [missionsPage, setMissionsPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modern Payout Modal State
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState((profile as any)?.payout_bank_name || '');
  const [accountNumber, setAccountNumber] = useState((profile as any)?.payout_account_number || '');
  const [accountName, setAccountName] = useState((profile as any)?.payout_account_name || '');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const fetchEarningsData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch wallet
      const { data: wData } = await (supabase as any)
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (wData) {
        setBalance(wData.balance || 0);
        setEscrowBalance(wData.escrow_balance || 0);
        setWalletId(wData.id);

        // Fetch wallet transactions
        const { data: txData } = await (supabase as any)
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', wData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData) {
          setTransactions(txData);
        }
      }

      // 2. Fetch completed shipments (with order & zone fallbacks for address)
      const { data: completedShipments } = await (supabase as any)
        .from('shipments')
        .select(`
          id,
          order_id,
          delivery_fee,
          zone_id,
          created_at,
          status,
          pickup_address,
          delivery_address,
          zone:delivery_zones(name),
          order:orders(shipping_address, zone:delivery_zones(name))
        `)
        .eq('rider_id', user.id)
        .in('status', ['delivered', 'completed'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (completedShipments) {
        setCompletedMissions(completedShipments);
      }

      // 3. Fetch rider withdrawal / payout requests
      const { data: prData } = await (supabase as any)
        .from('payout_requests')
        .select('id, amount, fee_amount, status, bank_name, account_number, account_name, admin_notes, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (prData) {
        setPayoutRequests(prData);
      }

      // Populate bank details from profile
      if (profile) {
        const p = profile as any;
        if (!bankName && p.payout_bank_name) setBankName(p.payout_bank_name);
        if (!accountNumber && p.payout_account_number) setAccountNumber(p.payout_account_number);
        if (!accountName && p.payout_account_name) setAccountName(p.payout_account_name);
      }
    } catch (err) {
      console.warn('[LogisticsEarningsTabV2] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchEarningsData();
  }, [fetchEarningsData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarningsData();
  };

  const handleRequestPayout = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount < 1000) {
      toast.error('Minimum withdrawal amount is ₦1,000');
      return;
    }

    if (numAmount > balance) {
      toast.error('Insufficient ready balance');
      return;
    }

    if (numAmount > DAILY_LIMIT) {
      toast.error(`Daily limit exceeded. Max withdrawal is ₦${DAILY_LIMIT.toLocaleString()}`);
      return;
    }

    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast.error('Please enter full bank and account details');
      return;
    }

    try {
      setSubmittingPayout(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await (supabase as any).from('payout_requests').insert([
        {
          user_id: user?.id,
          wallet_id: walletId,
          amount: numAmount,
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
          status: 'pending',
        },
      ]);

      if (error) throw error;

      // Update bank account on profile for future quick payouts
      await (supabase as any)
        .from('profiles')
        .update({
          payout_bank_name: bankName.trim(),
          payout_account_number: accountNumber.trim(),
          payout_account_name: accountName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(`Payout of ₦${numAmount.toLocaleString()} requested successfully!`);
      setPayoutModalVisible(false);
      setAmount('');
      fetchEarningsData();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Payout request error:', err);
      toast.error(err.message || 'Failed to submit payout request');
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Balances Overview Cards */}
      <View style={styles.cardsRow}>
        {/* Ready Balance Card */}
        <View style={styles.readyBalanceCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconWrapGreen}>
              <Wallet size={18} color="#34d399" strokeWidth={2.4} />
            </View>
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeTextGreen}>READY</Text>
            </View>
          </View>
          <Text style={[styles.cardLabel, { color: '#94a3b8' }]}>READY BALANCE</Text>
          <Text style={styles.cardValueGreen}>
            ₦{balance.toLocaleString('en-NG')}
          </Text>
          <Text style={[styles.cardSubtext, { color: '#cbd5e1' }]}>Available for immediate payout</Text>
        </View>

        {/* Safety Hold / Escrow Card */}
        <View style={styles.escrowCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconWrapAmber}>
              <Clock size={20} color="#d97706" strokeWidth={2.5} />
            </View>
            <View style={styles.badgeAmber}>
              <Text style={styles.badgeTextAmber}>ESCROW</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>SAFETY HOLD</Text>
          <Text style={styles.cardValueAmber}>
            ₦{escrowBalance.toLocaleString('en-NG')}
          </Text>
          <Text style={styles.cardSubtext}>Releases upon delivery confirmation</Text>
        </View>
      </View>

      {/* Payout Action Button */}
      <TouchableOpacity
        style={styles.payoutTriggerBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setPayoutModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <ArrowDownToLine size={18} color="#ffffff" strokeWidth={2.5} />
        <Text style={styles.payoutTriggerBtnText}>REQUEST WITHDRAWAL</Text>
      </TouchableOpacity>

      {/* Financial Security Banner */}
      <View style={styles.securityBanner}>
        <ShieldCheck size={20} color={colors.primary} />
        <View style={styles.securityTextWrap}>
          <Text style={styles.securityTitle}>Protected Escrow Payouts</Text>
          <Text style={styles.securitySub}>
            Earnings are guaranteed and credited securely to your wallet on every successful mission.
          </Text>
        </View>
      </View>

      {/* History Toggle: Completed Missions vs Withdrawals */}
      <View style={styles.sectionWrap}>
        <View style={styles.historyToggleBar}>
          <TouchableOpacity
            style={[
              styles.historyToggleBtn,
              historyTab === 'missions' && styles.historyToggleBtnActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setHistoryTab('missions')}
          >
            <Text
              style={[
                styles.historyToggleText,
                historyTab === 'missions' && styles.historyToggleTextActive,
              ]}
            >
              Missions ({completedMissions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.historyToggleBtn,
              historyTab === 'withdrawals' && styles.historyToggleBtnActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setHistoryTab('withdrawals')}
          >
            <Text
              style={[
                styles.historyToggleText,
                historyTab === 'withdrawals' && styles.historyToggleTextActive,
              ]}
            >
              Withdrawals ({payoutRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {historyTab === 'withdrawals' ? (
          payoutRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No withdrawal requests yet</Text>
            </View>
          ) : (
            (() => {
              const PAGE_SIZE = 5;
              const totalPages = Math.max(1, Math.ceil(payoutRequests.length / PAGE_SIZE));
              const safePage = Math.min(payoutsPage, totalPages);
              const paginatedPayouts = payoutRequests.slice(
                (safePage - 1) * PAGE_SIZE,
                safePage * PAGE_SIZE
              );

              return (
                <>
                  {paginatedPayouts.map((req) => {
                    const st = (req.status || 'pending').toLowerCase();
                    const badgeStyle =
                      st === 'completed' || st === 'approved' || st === 'paid'
                        ? { bg: '#dcfce7', text: '#15803d', label: st === 'completed' ? 'COMPLETED' : 'APPROVED' }
                        : st === 'rejected'
                        ? { bg: '#fee2e2', text: '#b91c1c', label: 'REJECTED' }
                        : { bg: '#fef3c7', text: '#b45309', label: 'PENDING' };

                    return (
                      <TouchableOpacity
                        key={req.id}
                        style={styles.missionHistoryCard}
                        activeOpacity={0.75}
                        onPress={() => setSelectedReceipt(req)}
                      >
                        <View style={[styles.historyLeft, { flex: 1, marginRight: 10 }]}>
                          <View style={[styles.historyIconWrap, { backgroundColor: badgeStyle.bg }]}>
                            <CreditCard size={16} color={badgeStyle.text} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyRef}>
                              ₦{Number(req.amount || 0).toLocaleString('en-NG')} • {req.bank_name}
                            </Text>
                            <Text style={styles.historyAddress} numberOfLines={1}>
                              {req.account_number} • {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • Tap for receipt
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.payoutStatusPill, { backgroundColor: badgeStyle.bg }]}>
                          <Text style={[styles.payoutStatusPillText, { color: badgeStyle.text }]}>
                            {badgeStyle.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {totalPages > 1 && (
                    <View style={styles.paginationRow}>
                      <TouchableOpacity
                        style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
                        disabled={safePage <= 1}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPayoutsPage(Math.max(1, safePage - 1));
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.pageBtnText, safePage <= 1 && styles.pageBtnTextDisabled]}>
                          Prev
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.pageInfo}>
                        Page {safePage} of {totalPages} ({payoutRequests.length})
                      </Text>

                      <TouchableOpacity
                        style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
                        disabled={safePage >= totalPages}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPayoutsPage(Math.min(totalPages, safePage + 1));
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.pageBtnText,
                            safePage >= totalPages && styles.pageBtnTextDisabled,
                          ]}
                        >
                          Next
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              );
            })()
          )
        ) : completedMissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed missions yet</Text>
          </View>
        ) : (
          (() => {
            const PAGE_SIZE = 5;
            const totalPages = Math.max(1, Math.ceil(completedMissions.length / PAGE_SIZE));
            const safePage = Math.min(missionsPage, totalPages);
            const paginatedMissions = completedMissions.slice(
              (safePage - 1) * PAGE_SIZE,
              safePage * PAGE_SIZE
            );

const formatCompletedAddress = (m: any): string => {
  const cleanStr = (v: any) => {
    if (typeof v !== 'string') return '';
    const trimmed = v.trim();
    return trimmed.replace(/[\s,]+/g, '').length > 0 ? trimmed : '';
  };

  const direct = cleanStr(m?.delivery_address);
  if (direct) return direct;

  const shipAddr = m?.order?.shipping_address;
  if (typeof shipAddr === 'string') {
    const cleaned = cleanStr(shipAddr);
    if (cleaned) return cleaned;
  } else if (shipAddr && typeof shipAddr === 'object') {
    const parts = [
      shipAddr.street || shipAddr.address || shipAddr.address_line1,
      shipAddr.area || shipAddr.lga,
      shipAddr.city || shipAddr.state,
    ]
      .map((p) => cleanStr(p))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  const orderAddr = cleanStr(m?.order?.delivery_address);
  if (orderAddr) return orderAddr;

  const zoneName = cleanStr(m?.zone?.name) || cleanStr(m?.order?.zone?.name);
  if (zoneName) return `${zoneName} Delivery`;

  return 'Delivered to recipient';
};

            return (
              <>
                {paginatedMissions.map((m) => (
                  <View key={m.id} style={styles.missionHistoryCard}>
                    <View style={[styles.historyLeft, { flex: 1, marginRight: 10 }]}>
                      <View style={styles.historyIconWrap}>
                        <CheckCircle size={16} color="#16a34a" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyRef}>
                          REF: #{String(m.order_id || m.id).slice(-8).toUpperCase()}
                        </Text>
                        <Text style={styles.historyAddress} numberOfLines={1}>
                          {formatCompletedAddress(m)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyAmount}>
                        +₦{Number(m.delivery_fee || 1500).toLocaleString('en-NG')}
                      </Text>
                      <Text style={styles.historyStatus}>COMPLETED</Text>
                    </View>
                  </View>
                ))}

                {totalPages > 1 && (
                  <View style={styles.paginationRow}>
                    <TouchableOpacity
                      style={[styles.pageBtn, safePage <= 1 && styles.pageBtnDisabled]}
                      disabled={safePage <= 1}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setMissionsPage(Math.max(1, safePage - 1));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pageBtnText, safePage <= 1 && styles.pageBtnTextDisabled]}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.pageInfo}>
                      Page {safePage} of {totalPages} ({completedMissions.length})
                    </Text>

                    <TouchableOpacity
                      style={[styles.pageBtn, safePage >= totalPages && styles.pageBtnDisabled]}
                      disabled={safePage >= totalPages}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setMissionsPage(Math.min(totalPages, safePage + 1));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.pageBtnText,
                          safePage >= totalPages && styles.pageBtnTextDisabled,
                        ]}
                      >
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            );
          })()
        )}
      </View>

      {/* Modern Payout Request Modal - KEYBOARD SAFE */}
      <Modal
        visible={payoutModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPayoutModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setPayoutModalVisible(false)}
          />

          <View style={styles.modalSheet}>
            {/* Drag Handle */}
            <View style={styles.modalDragWrap}>
              <View style={styles.modalDragPill} />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <Building2 size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Request Payout</Text>
                  <Text style={styles.modalSub}>
                    Available: ₦{balance.toLocaleString('en-NG')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPayoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Form Fields inside ScrollView to never clip on keyboard */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalFormContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Amount Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>WITHDRAWAL AMOUNT (₦)</Text>
                <View style={styles.inputBox}>
                  <Text style={styles.currencySymbol}>₦</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 5000"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <Text style={styles.inputHelper}>
                  Min: ₦1,000 • Daily limit: ₦{DAILY_LIMIT.toLocaleString()}
                </Text>
              </View>

              {/* Bank Name Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BANK NAME</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. OPay, Kuda, Access Bank, GTBank"
                    placeholderTextColor="#94a3b8"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
              </View>

              {/* Account Number Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-digit NUBAN account number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                  />
                </View>
              </View>

              {/* Account Name Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ACCOUNT HOLDER NAME</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Full account name"
                    placeholderTextColor="#94a3b8"
                    value={accountName}
                    onChangeText={setAccountName}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitPayoutBtn}
                onPress={handleRequestPayout}
                disabled={submittingPayout}
                activeOpacity={0.85}
              >
                {submittingPayout ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitPayoutBtnText}>SUBMIT WITHDRAWAL</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PayoutReceiptModal
        visible={selectedReceipt !== null}
        onClose={() => setSelectedReceipt(null)}
        request={selectedReceipt}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  readyBalanceCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 22,
    padding: 16,
    gap: 5,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  escrowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 22,
    padding: 16,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardIconWrapGreen: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapAmber: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeTextGreen: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#6ee7b7',
    letterSpacing: 0.6,
  },
  badgeAmber: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeTextAmber: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#b45309',
    letterSpacing: 0.6,
  },
  cardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.7,
  },
  cardValueGreen: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  cardValueAmber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  cardSubtext: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  payoutTriggerBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  payoutTriggerBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    padding: 14,
  },
  securityTextWrap: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  securitySub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 14,
    marginTop: 2,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  missionHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 14,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRef: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  historyAddress: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
    maxWidth: 180,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#16a34a',
  },
  historyStatus: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.4,
    marginTop: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  modalDragWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalDragPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalFormContent: {
    padding: 20,
    gap: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputHelper: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 2,
  },
  submitPayoutBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitPayoutBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageBtnDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.55,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageInfo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  historyToggleBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  historyToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  historyToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  historyToggleTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  payoutStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  payoutStatusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
