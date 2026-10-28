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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DAILY_LIMIT = 50000;
const MISSIONS_PER_PAGE = 4;
const TX_PER_PAGE = 4;

export function LogisticsEarningsTabV2({ onScroll }: { onScroll?: (e: any) => void } = {}) {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [completedMissions, setCompletedMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [missionPage, setMissionPage] = useState<number>(1);
  const [txPage, setTxPage] = useState<number>(1);

  // Computed paginated slices
  const totalMissionPages = Math.max(1, Math.ceil(completedMissions.length / MISSIONS_PER_PAGE));
  const paginatedMissions = completedMissions.slice(
    (missionPage - 1) * MISSIONS_PER_PAGE,
    missionPage * MISSIONS_PER_PAGE
  );

  const totalTxPages = Math.max(1, Math.ceil(transactions.length / TX_PER_PAGE));
  const paginatedTransactions = transactions.slice(
    (txPage - 1) * TX_PER_PAGE,
    txPage * TX_PER_PAGE
  );

  // Clamp pagination bounds when lists update
  useEffect(() => {
    if (missionPage > totalMissionPages && totalMissionPages > 0) {
      setMissionPage(totalMissionPages);
    }
  }, [totalMissionPages, missionPage]);

  useEffect(() => {
    if (txPage > totalTxPages && totalTxPages > 0) {
      setTxPage(totalTxPages);
    }
  }, [totalTxPages, txPage]);

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

      // 2. Fetch completed shipments (marketplace) & send_orders (LinkUp Send)
      const [shipmentsRes, sendOrdersRes] = await Promise.all([
        (supabase as any)
          .from('shipments')
          .select(`
            id,
            order_id,
            delivery_fee,
            zone_id,
            created_at,
            status,
            pickup_address,
            delivery_address
          `)
          .eq('rider_id', user.id)
          .in('status', ['delivered', 'completed'])
          .order('created_at', { ascending: false })
          .limit(20),
        (supabase as any)
          .from('send_orders')
          .select(`
            id,
            delivery_fee,
            rider_payout_amount,
            rider_payout_status,
            pickup_address,
            dropoff_address,
            delivered_at,
            created_at,
            status
          `)
          .eq('rider_id', user.id)
          .eq('status', 'delivered')
          .order('delivered_at', { ascending: false })
          .limit(20),
      ]);

      const formattedShipments = (shipmentsRes.data || []).map((s: any) => ({
        id: s.id,
        order_id: s.order_id || s.id,
        type: 'Marketplace',
        delivery_address: s.delivery_address,
        pickup_address: s.pickup_address,
        rider_earnings: Math.max(1000, Math.round(Number(s.delivery_fee || 1500) * 0.8)),
        status: 'COMPLETED',
        is_held: false,
        created_at: s.created_at,
      }));

      const formattedSendOrders = (sendOrdersRes.data || []).map((s: any) => ({
        id: s.id,
        order_id: s.id,
        type: 'Send Package',
        delivery_address: s.dropoff_address,
        pickup_address: s.pickup_address,
        rider_earnings: Number(s.rider_payout_amount || 0) > 0
          ? Number(s.rider_payout_amount)
          : Math.max(1000, Math.round(Number(s.delivery_fee || 1500) * 0.8)),
        status: s.rider_payout_status === 'held' ? 'IN ESCROW' : 'RELEASED',
        is_held: s.rider_payout_status === 'held',
        created_at: s.delivered_at || s.created_at,
      }));

      const combinedMissions = [...formattedShipments, ...formattedSendOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setCompletedMissions(combinedMissions);

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

    if (!user) return;

    // Real-time synchronization for rider wallet, transactions, and mission payouts
    const channel = supabase
      .channel(`rider-earnings-tab-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        () => fetchEarningsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders', filter: `rider_id=eq.${user.id}` },
        () => fetchEarningsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments', filter: `rider_id=eq.${user.id}` },
        () => fetchEarningsData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEarningsData]);

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
          role: 'rider',
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
      onScroll={onScroll}
      scrollEventThrottle={16}
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
              <Wallet size={20} color="#059669" strokeWidth={2.5} />
            </View>
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeTextGreen}>READY</Text>
            </View>
          </View>
          <Text style={styles.cardLabel}>READY BALANCE</Text>
          <AnimatedCounter
            value={balance}
            duration={1200}
            prefix="₦"
            style={styles.cardValueGreen}
          />
          <Text style={styles.cardSubtext}>Available for immediate payout</Text>
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
          <AnimatedCounter
            value={escrowBalance}
            duration={1200}
            prefix="₦"
            style={styles.cardValueAmber}
          />
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

      {/* Completed Missions History */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeader}>
            <Package size={16} color="#64748b" />
            <Text style={styles.sectionTitle}>RECENT COMPLETED MISSIONS</Text>
          </View>
          {completedMissions.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{completedMissions.length} total</Text>
            </View>
          )}
        </View>

        {completedMissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed missions yet</Text>
          </View>
        ) : (
          <>
            {paginatedMissions.map((m) => (
              <View key={m.id} style={styles.missionHistoryCard}>
                <View style={styles.historyLeft}>
                  <View style={[styles.historyIconWrap, m.is_held && { backgroundColor: '#fef3c7' }]}>
                    {m.is_held ? (
                      <Clock size={16} color="#d97706" />
                    ) : (
                      <CheckCircle size={16} color="#16a34a" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.historyRef}>
                        REF: #{String(m.order_id || m.id).slice(-8).toUpperCase()}
                      </Text>
                      <View
                        style={[
                          styles.typeBadge,
                          m.type === 'Send Package' ? styles.typeBadgeSend : styles.typeBadgeMarket,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            m.type === 'Send Package'
                              ? styles.typeBadgeTextSend
                              : styles.typeBadgeTextMarket,
                          ]}
                        >
                          {m.type === 'Send Package' ? 'SEND' : 'MARKET'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={styles.historyAddress}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {m.delivery_address || 'Delivered to recipient'}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.historyAmount, m.is_held && { color: '#d97706' }]}>
                    +₦{Number(m.rider_earnings || 1000).toLocaleString('en-NG')}
                  </Text>
                  <Text style={[styles.historyStatus, m.is_held && { color: '#d97706' }]}>
                    {m.status}
                  </Text>
                </View>
              </View>
            ))}

            {/* Pagination Controls for Completed Missions */}
            {totalMissionPages > 1 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    missionPage === 1 && styles.paginationBtnDisabled,
                  ]}
                  disabled={missionPage === 1}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMissionPage((p) => Math.max(1, p - 1));
                  }}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={16} color={missionPage === 1 ? '#cbd5e1' : '#0f172a'} />
                  <Text
                    style={[
                      styles.paginationBtnText,
                      missionPage === 1 && styles.paginationBtnTextDisabled,
                    ]}
                  >
                    Prev
                  </Text>
                </TouchableOpacity>

                <View style={styles.pageIndicatorWrap}>
                  <Text style={styles.pageIndicatorText}>
                    Page <Text style={styles.pageIndicatorBold}>{missionPage}</Text> of{' '}
                    <Text style={styles.pageIndicatorBold}>{totalMissionPages}</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    missionPage >= totalMissionPages && styles.paginationBtnDisabled,
                  ]}
                  disabled={missionPage >= totalMissionPages}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMissionPage((p) => Math.min(totalMissionPages, p + 1));
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.paginationBtnText,
                      missionPage >= totalMissionPages && styles.paginationBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <ChevronRight
                    size={16}
                    color={missionPage >= totalMissionPages ? '#cbd5e1' : '#0f172a'}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Wallet Transaction Ledger */}
      {transactions.length > 0 && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <TrendingUp size={16} color="#64748b" />
              <Text style={styles.sectionTitle}>TRANSACTION LEDGER (REAL TIME)</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{transactions.length} total</Text>
            </View>
          </View>
          {paginatedTransactions.map((tx) => {
            const isCredit =
              tx.type === 'settlement' || tx.type === 'escrow_credit' || tx.type === 'deposit';
            const isEscrow = tx.type === 'escrow_credit';
            return (
              <View key={tx.id} style={styles.missionHistoryCard}>
                <View style={styles.historyLeft}>
                  <View
                    style={[
                      styles.historyIconWrap,
                      isEscrow
                        ? { backgroundColor: '#fef3c7' }
                        : isCredit
                        ? { backgroundColor: '#dcfce7' }
                        : { backgroundColor: '#fee2e2' },
                    ]}
                  >
                    {isEscrow ? (
                      <Clock size={16} color="#d97706" />
                    ) : isCredit ? (
                      <CheckCircle size={16} color="#16a34a" />
                    ) : (
                      <ArrowDownToLine size={16} color="#dc2626" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyRef} numberOfLines={1} ellipsizeMode="tail">
                      {tx.reference || (isEscrow ? 'Escrow Safety Hold' : tx.type?.toUpperCase())}
                    </Text>
                    <Text style={styles.historyAddress}>
                      {new Date(tx.created_at).toLocaleString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyRight}>
                  <Text
                    style={[
                      styles.historyAmount,
                      isEscrow
                        ? { color: '#d97706' }
                        : isCredit
                        ? { color: '#16a34a' }
                        : { color: '#dc2626' },
                    ]}
                  >
                    {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString('en-NG')}
                  </Text>
                  <Text
                    style={[
                      styles.historyStatus,
                      isEscrow
                        ? { color: '#d97706' }
                        : isCredit
                        ? { color: '#16a34a' }
                        : { color: '#dc2626' },
                    ]}
                  >
                    {isEscrow ? 'ESCROW' : tx.type === 'settlement' ? 'READY' : tx.type?.toUpperCase()}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Pagination Controls for Transactions */}
          {totalTxPages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[
                  styles.paginationBtn,
                  txPage === 1 && styles.paginationBtnDisabled,
                ]}
                disabled={txPage === 1}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTxPage((p) => Math.max(1, p - 1));
                }}
                activeOpacity={0.7}
              >
                <ChevronLeft size={16} color={txPage === 1 ? '#cbd5e1' : '#0f172a'} />
                <Text
                  style={[
                    styles.paginationBtnText,
                    txPage === 1 && styles.paginationBtnTextDisabled,
                  ]}
                >
                  Prev
                </Text>
              </TouchableOpacity>

              <View style={styles.pageIndicatorWrap}>
                <Text style={styles.pageIndicatorText}>
                  Page <Text style={styles.pageIndicatorBold}>{txPage}</Text> of{' '}
                  <Text style={styles.pageIndicatorBold}>{totalTxPages}</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationBtn,
                  txPage >= totalTxPages && styles.paginationBtnDisabled,
                ]}
                disabled={txPage >= totalTxPages}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTxPage((p) => Math.min(totalTxPages, p + 1));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.paginationBtnText,
                    txPage >= totalTxPages && styles.paginationBtnTextDisabled,
                  ]}
                >
                  Next
                </Text>
                <ChevronRight
                  size={16}
                  color={txPage >= totalTxPages ? '#cbd5e1' : '#0f172a'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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
    paddingBottom: 110,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  readyBalanceCard: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  escrowCard: {
    flex: 1,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardIconWrapGreen: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapAmber: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGreen: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextGreen: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#065f46',
  },
  badgeAmber: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextAmber: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#92400e',
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  cardValueGreen: {
    fontSize: 20,
    fontWeight: '900',
    color: '#064e3b',
    letterSpacing: -0.4,
  },
  cardValueAmber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#78350f',
    letterSpacing: -0.4,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paginationBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    opacity: 0.5,
  },
  paginationBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  paginationBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageIndicatorWrap: {
    paddingHorizontal: 8,
  },
  pageIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  pageIndicatorBold: {
    fontWeight: '900',
    color: '#0f172a',
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
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeBadgeMarket: {
    backgroundColor: '#eff6ff',
  },
  typeBadgeSend: {
    backgroundColor: '#fff7ed',
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  typeBadgeTextMarket: {
    color: '#2563eb',
  },
  typeBadgeTextSend: {
    color: '#ea580c',
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
});
