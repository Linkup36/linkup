import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Share,
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
  PackageX,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CheckCircle2,
  XCircle,
  Banknote,
  Landmark,
  Share2,
  Smartphone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';
import { logisticsCache } from '../../../services/logisticsCache';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DAILY_LIMIT = 50000;
const MISSIONS_PER_PAGE = 4;
const TX_PER_PAGE = 4;
const PAYOUTS_PER_PAGE = 3;

export type EarningsSubTab = 'withdrawals' | 'missions' | 'ledger';

export interface LogisticsEarningsTabV2Props {
  onScroll?: (e: any) => void;
  initialSubTab?: EarningsSubTab;
}

export function LogisticsEarningsTabV2({
  onScroll,
  initialSubTab = 'withdrawals',
}: LogisticsEarningsTabV2Props = {}) {
  const { user, profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<EarningsSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [balance, setBalance] = useState<number>(0);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [completedMissions, setCompletedMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawal requests & live tracking state
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutPage, setPayoutPage] = useState<number>(1);
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);

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

  const totalPayoutPages = Math.max(1, Math.ceil(payoutRequests.length / PAYOUTS_PER_PAGE));
  const paginatedPayouts = payoutRequests.slice(
    (payoutPage - 1) * PAYOUTS_PER_PAGE,
    payoutPage * PAYOUTS_PER_PAGE
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

  useEffect(() => {
    if (payoutPage > totalPayoutPages && totalPayoutPages > 0) {
      setPayoutPage(totalPayoutPages);
    }
  }, [totalPayoutPages, payoutPage]);

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

      let currentBal = balance;
      let currentEsc = escrowBalance;
      let currentWalletId = walletId;
      let currentTx = transactions;

      if (wData) {
        currentBal = wData.balance || 0;
        currentEsc = wData.escrow_balance || 0;
        currentWalletId = wData.id;
        setBalance(currentBal);
        setEscrowBalance(currentEsc);
        setWalletId(currentWalletId);

        // Fetch wallet transactions
        const { data: txData } = await (supabase as any)
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', wData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData) {
          currentTx = txData;
          setTransactions(txData);
        }
      }

      // 2. Fetch completed shipments (marketplace), send_orders (LinkUp Send), & payout requests
      const [shipmentsRes, sendOrdersRes, payoutReqsRes] = await Promise.all([
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
        (supabase as any)
          .from('payout_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const payoutList = payoutReqsRes.data || [];
      if (payoutReqsRes.data) {
        setPayoutRequests(payoutList);
        setSelectedPayout((prev: any) => {
          if (!prev) return null;
          return payoutList.find((p: any) => p.id === prev.id) || prev;
        });
      }

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

      // Save to persistent SWR Cache
      logisticsCache.setEarnings(user.id, {
        balance: currentBal,
        escrowBalance: currentEsc,
        walletId: currentWalletId,
        transactions: currentTx,
        completedMissions: combinedMissions,
        payoutRequests: payoutList,
      });

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
  }, [user, profile, balance, escrowBalance, walletId, transactions, bankName, accountNumber, accountName]);

  // Debounced fetch for rapid realtime Postgres updates
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchEarnings = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchEarningsData();
    }, 500);
  }, [fetchEarningsData]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    // SWR Cache Fast-Path: Restore cached earnings data instantly in 0ms (no loading spinner!)
    logisticsCache.getEarnings(user.id).then((cached) => {
      if (!isMounted || !cached?.data) {
        fetchEarningsData();
        return;
      }

      const { data, isStale } = cached;
      setBalance(data.balance || 0);
      setEscrowBalance(data.escrowBalance || 0);
      if (data.walletId) setWalletId(data.walletId);
      setTransactions(data.transactions || []);
      setCompletedMissions(data.completedMissions || []);
      setPayoutRequests(data.payoutRequests || []);
      setLoading(false);

      // If cache is stale, revalidate silently in background
      if (isStale) {
        fetchEarningsData();
      }
    });

    // Real-time synchronization with debouncing
    const channel = supabase
      .channel(`rider-earnings-tab-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        () => debouncedFetchEarnings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders', filter: `rider_id=eq.${user.id}` },
        () => debouncedFetchEarnings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments', filter: `rider_id=eq.${user.id}` },
        () => debouncedFetchEarnings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests', filter: `user_id=eq.${user.id}` },
        () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          debouncedFetchEarnings();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, fetchEarningsData, debouncedFetchEarnings]);

  const handleShareReceipt = async (req: any) => {
    if (!req) return;
    try {
      const dateStr = req.created_at
        ? format(new Date(req.created_at), 'MMM d, yyyy • h:mm a')
        : 'Pending';
      await Share.share({
        title: `LinkUp Withdrawal Receipt #${String(req.id).slice(0, 8).toUpperCase()}`,
        message: [
          `LINKUP LOGISTICS - WITHDRAWAL RECEIPT`,
          `Reference ID: #${String(req.id).slice(0, 13).toUpperCase()}`,
          `Status: ${String(req.status || 'pending').toUpperCase()}`,
          `Net Payout: ₦${Number(req.amount || 0).toLocaleString('en-NG')} NGN`,
          `Withdrawal Fee: ₦${Number(req.fee_amount || 0).toLocaleString('en-NG')} NGN`,
          `Destination Bank: ${req.bank_name || 'N/A'}`,
          `Account: ${req.account_name || 'Rider'} (${req.account_number || ''})`,
          `Date Requested: ${dateStr}`,
          req.admin_notes ? `Notes: ${req.admin_notes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch (e) {
      console.warn('Share receipt error:', e);
    }
  };

  const getPayoutStatusConfig = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'completed':
      case 'paid':
        return {
          bg: '#DCFCE7',
          text: '#15803D',
          border: '#BBF7D0',
          label: 'SETTLED & PAID',
          shortLabel: 'PAID',
          icon: CheckCircle2,
          desc: 'Disbursed and confirmed to your destination bank account.',
        };
      case 'approved':
      case 'processing':
        return {
          bg: '#DBEAFE',
          text: '#1D4ED8',
          border: '#BFDBFE',
          label: 'PROCESSING (IN TRANSIT)',
          shortLabel: 'PROCESSING',
          icon: Banknote,
          desc: 'Approved by finance. Bank transfer disbursement in transit.',
        };
      case 'rejected':
      case 'declined':
        return {
          bg: '#FEE2E2',
          text: '#B91C1C',
          border: '#FECACA',
          label: 'REJECTED',
          shortLabel: 'REJECTED',
          icon: XCircle,
          desc: 'Declined during review. Funds preserved in your wallet.',
        };
      case 'pending':
      default:
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          border: '#FDE68A',
          label: 'SECURITY REVIEW',
          shortLabel: 'PENDING',
          icon: Clock,
          desc: 'Queued for security review & verification by LinkUp finance.',
        };
    }
  };

  const getTrackerSteps = (payout: any) => {
    const status = (payout.status || 'pending').toLowerCase();
    const isRejected = status === 'rejected' || status === 'declined';
    const isCompleted = status === 'completed' || status === 'paid';
    const isProcessing = status === 'processing' || status === 'approved';

    return [
      {
        id: '1',
        title: 'Request Received',
        description: `₦${Number(payout.amount || 0).toLocaleString('en-NG')} withdrawal queued`,
        time: payout.created_at
          ? format(new Date(payout.created_at), 'MMM d, h:mm a')
          : 'Submitted',
        state: 'done',
        icon: Smartphone,
      },
      {
        id: '2',
        title: isRejected ? 'Verification Declined' : 'Security & Mission Review',
        description: isRejected
          ? (payout.admin_notes || 'Declined during verification')
          : 'Verifying completed deliveries and wallet safety',
        time: isRejected ? 'Declined' : status !== 'pending' ? 'Verified' : 'In Review',
        state: isRejected ? 'error' : status === 'pending' ? 'current' : 'done',
        icon: isRejected ? AlertCircle : ShieldCheck,
      },
      {
        id: '3',
        title: 'Bank Transfer Disbursement',
        description: `Disbursement to ${payout.bank_name || 'Bank'} (${payout.account_number || ''})`,
        time: isProcessing ? 'In Transit' : isCompleted ? 'Disbursed' : 'Awaiting',
        state: isRejected ? 'skipped' : isProcessing ? 'current' : isCompleted ? 'done' : 'upcoming',
        icon: Landmark,
      },
      {
        id: '4',
        title: 'Settled to Bank Account',
        description: isCompleted
          ? 'Funds available in your destination bank account'
          : 'Confirmed in 1-24 hours depending on your bank',
        time: isCompleted ? 'Completed' : 'Final Step',
        state: isRejected ? 'skipped' : isCompleted ? 'done' : 'upcoming',
        icon: CheckCircle2,
      },
    ];
  };

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

      // Attempt atomic RPC first to safeguard wallet balance and log transaction;
      // fallback to direct payout_requests insert if RPC is unavailable.
      const { error: rpcError } = await (supabase as any).rpc('request_wallet_payout', {
        p_amount: numAmount,
        p_bank_name: bankName.trim(),
        p_account_number: accountNumber.trim(),
        p_account_name: accountName.trim(),
      });

      if (rpcError) {
        if (
          rpcError.code === 'PGRST202' ||
          rpcError.message?.includes('request_wallet_payout')
        ) {
          const { error: insertError } = await (supabase as any).from('payout_requests').insert([
            {
              user_id: user?.id,
              wallet_id: walletId,
              amount: numAmount,
              bank_name: bankName.trim(),
              account_number: accountNumber.trim(),
              account_name: accountName.trim(),
              status: 'pending',
              admin_notes: 'Rider withdrawal request',
            },
          ]);
          if (insertError) throw insertError;
        } else {
          throw rpcError;
        }
      }

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

      {/* Segmented Switcher for History: Withdrawals vs Missions vs Ledger */}
      <View style={styles.historySegmentWrapper}>
        <TouchableOpacity
          style={[
            styles.historySegmentTab,
            activeSubTab === 'withdrawals' && styles.historySegmentTabActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveSubTab('withdrawals');
          }}
          activeOpacity={0.8}
        >
          <Receipt
            size={14}
            color={activeSubTab === 'withdrawals' ? colors.primary : '#64748b'}
            strokeWidth={2.5}
          />
          <Text
            style={[
              styles.historySegmentText,
              activeSubTab === 'withdrawals' && styles.historySegmentTextActive,
            ]}
          >
            Withdrawals
          </Text>
          {payoutRequests.length > 0 && (
            <View
              style={[
                styles.historySegmentBadge,
                activeSubTab === 'withdrawals' && styles.historySegmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.historySegmentBadgeText,
                  activeSubTab === 'withdrawals' && styles.historySegmentBadgeTextActive,
                ]}
              >
                {payoutRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.historySegmentTab,
            activeSubTab === 'missions' && styles.historySegmentTabActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveSubTab('missions');
          }}
          activeOpacity={0.8}
        >
          <Package
            size={14}
            color={activeSubTab === 'missions' ? colors.primary : '#64748b'}
            strokeWidth={2.5}
          />
          <Text
            style={[
              styles.historySegmentText,
              activeSubTab === 'missions' && styles.historySegmentTextActive,
            ]}
          >
            Missions
          </Text>
          {completedMissions.length > 0 && (
            <View
              style={[
                styles.historySegmentBadge,
                activeSubTab === 'missions' && styles.historySegmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.historySegmentBadgeText,
                  activeSubTab === 'missions' && styles.historySegmentBadgeTextActive,
                ]}
              >
                {completedMissions.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.historySegmentTab,
            activeSubTab === 'ledger' && styles.historySegmentTabActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveSubTab('ledger');
          }}
          activeOpacity={0.8}
        >
          <TrendingUp
            size={14}
            color={activeSubTab === 'ledger' ? colors.primary : '#64748b'}
            strokeWidth={2.5}
          />
          <Text
            style={[
              styles.historySegmentText,
              activeSubTab === 'ledger' && styles.historySegmentTextActive,
            ]}
          >
            Ledger
          </Text>
          {transactions.length > 0 && (
            <View
              style={[
                styles.historySegmentBadge,
                activeSubTab === 'ledger' && styles.historySegmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.historySegmentBadgeText,
                  activeSubTab === 'ledger' && styles.historySegmentBadgeTextActive,
                ]}
              >
                {transactions.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 1. Dedicated Withdrawal History & Tracking View */}
      {activeSubTab === 'withdrawals' && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Receipt size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>WITHDRAWAL HISTORY & TRACKING</Text>
            </View>
            {payoutRequests.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: 'rgba(235, 125, 48, 0.12)' }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {payoutRequests.length} total
                </Text>
              </View>
            )}
          </View>

          {payoutRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Receipt size={24} color="#64748b" />
              </View>
              <Text style={styles.emptyCardTitle}>No Withdrawal Requests Yet</Text>
              <Text style={styles.emptyCardSub}>
                When you request a payout from your ready balance, you can track the bank disbursement progress and receipts here.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPayoutModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <ArrowDownToLine size={14} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.emptyActionBtnText}>REQUEST WITHDRAWAL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {paginatedPayouts.map((req) => {
                const st = getPayoutStatusConfig(req.status);
                const StatusIcon = st.icon;
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={styles.payoutCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPayout(req);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.payoutCardTop}>
                      <View style={styles.payoutCardLeft}>
                        <View style={[styles.payoutCardIconWrap, { backgroundColor: st.bg }]}>
                          <StatusIcon size={18} color={st.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.payoutRef}>
                              REF: #{String(req.id).slice(0, 8).toUpperCase()}
                            </Text>
                            <View style={[styles.payoutBadge, { backgroundColor: st.bg }]}>
                              <Text style={[styles.payoutBadgeText, { color: st.text }]}>
                                {st.shortLabel}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.payoutBankInfo}>
                            {req.bank_name || 'Bank'} •••• {String(req.account_number || '').slice(-4)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.payoutCardRight}>
                        <Text style={styles.payoutAmountText}>
                          ₦{Number(req.amount || 0).toLocaleString('en-NG')}
                        </Text>
                        <Text style={styles.payoutDateText}>
                          {req.created_at
                            ? format(new Date(req.created_at), 'MMM d, h:mm a')
                            : 'Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.payoutCardBottom}>
                      <View style={styles.trackPrompt}>
                        <View style={[styles.liveDot, { backgroundColor: st.text }]} />
                        <Text style={styles.trackPromptText} numberOfLines={1}>
                          {st.desc}
                        </Text>
                      </View>
                      <View style={styles.trackActionBtn}>
                        <Text style={styles.trackActionText}>Track</Text>
                        <ChevronRight size={13} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Pagination Controls for Payout Requests */}
              {totalPayoutPages > 1 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[
                      styles.paginationBtn,
                      payoutPage === 1 && styles.paginationBtnDisabled,
                    ]}
                    disabled={payoutPage === 1}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPayoutPage((p) => Math.max(1, p - 1));
                    }}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={16} color={payoutPage === 1 ? '#cbd5e1' : '#0f172a'} />
                    <Text
                      style={[
                        styles.paginationBtnText,
                        payoutPage === 1 && styles.paginationBtnTextDisabled,
                      ]}
                    >
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.pageIndicatorWrap}>
                    <Text style={styles.pageIndicatorText}>
                      Page <Text style={styles.pageIndicatorBold}>{payoutPage}</Text> of{' '}
                      <Text style={styles.pageIndicatorBold}>{totalPayoutPages}</Text>
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.paginationBtn,
                      payoutPage >= totalPayoutPages && styles.paginationBtnDisabled,
                    ]}
                    disabled={payoutPage >= totalPayoutPages}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPayoutPage((p) => Math.min(totalPayoutPages, p + 1));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.paginationBtnText,
                        payoutPage >= totalPayoutPages && styles.paginationBtnTextDisabled,
                      ]}
                    >
                      Next
                    </Text>
                    <ChevronRight
                      size={16}
                      color={payoutPage >= totalPayoutPages ? '#cbd5e1' : '#0f172a'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* 2. Dedicated Completed Missions History View */}
      {activeSubTab === 'missions' && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Package size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>COMPLETED MISSIONS HISTORY</Text>
            </View>
            {completedMissions.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: 'rgba(235, 125, 48, 0.12)' }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {completedMissions.length} total
                </Text>
              </View>
            )}
          </View>

          {completedMissions.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <PackageX size={24} color="#64748b" />
              </View>
              <Text style={styles.emptyCardTitle}>No Completed Missions Yet</Text>
              <Text style={styles.emptyCardSub}>
                Packages delivered across Marketplace and LinkUp Send will be cataloged here with itemized earnings.
              </Text>
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
      )}

      {/* 3. Dedicated Real-Time Wallet Ledger View */}
      {activeSubTab === 'ledger' && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <TrendingUp size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>TRANSACTION LEDGER (REAL TIME)</Text>
            </View>
            {transactions.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: 'rgba(235, 125, 48, 0.12)' }]}>
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {transactions.length} total
                </Text>
              </View>
            )}
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <TrendingUp size={24} color="#64748b" />
              </View>
              <Text style={styles.emptyCardTitle}>No Ledger Entries</Text>
              <Text style={styles.emptyCardSub}>
                Wallet debits, credits, and escrow holds will be itemized here in real-time.
              </Text>
            </View>
          ) : (
            <>
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
            </>
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

      {/* Withdrawal Live Tracking & Receipt Modal */}
      <Modal
        visible={!!selectedPayout}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedPayout(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSelectedPayout(null)}
          />

          {selectedPayout && (() => {
            const st = getPayoutStatusConfig(selectedPayout.status);
            const StatusIcon = st.icon;
            const steps = getTrackerSteps(selectedPayout);
            const isRejected = (selectedPayout.status || '').toLowerCase() === 'rejected';

            return (
              <View style={styles.trackerSheet}>
                {/* Drag Indicator */}
                <View style={styles.modalDragWrap}>
                  <View style={styles.modalDragPill} />
                </View>

                {/* Tracker Modal Header */}
                <View style={styles.trackerHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.trackerHeaderTitle}>Withdrawal Tracker</Text>
                      <View style={[styles.trackerStatusPill, { backgroundColor: st.bg }]}>
                        <StatusIcon size={12} color={st.text} />
                        <Text style={[styles.trackerStatusPillText, { color: st.text }]}>
                          {st.shortLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.trackerHeaderSub}>
                      REF: #{String(selectedPayout.id).slice(0, 13).toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedPayout(null)}
                  >
                    <X size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.trackerScroll}
                  contentContainerStyle={styles.trackerScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Big Hero Amount Box */}
                  <View style={styles.trackerAmountBox}>
                    <Text style={styles.trackerAmountLabel}>NET DISBURSEMENT AMOUNT</Text>
                    <Text style={styles.trackerAmountValue}>
                      ₦{Number(selectedPayout.amount || 0).toLocaleString('en-NG')}
                    </Text>
                    <View style={styles.trackerBankRow}>
                      <Building2 size={13} color="#64748b" />
                      <Text style={styles.trackerBankText}>
                        {selectedPayout.bank_name || 'Bank'} • {selectedPayout.account_number}
                      </Text>
                    </View>
                  </View>

                  {/* If Rejected Banner */}
                  {isRejected && (
                    <View style={styles.rejectedBanner}>
                      <AlertCircle size={20} color="#dc2626" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectedTitle}>Payout Request Declined</Text>
                        <Text style={styles.rejectedSub}>
                          {selectedPayout.admin_notes ||
                            'This request was declined during admin security review. The requested funds remain in your ready balance.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 4-Step Vertical Tracker Timeline */}
                  <View style={styles.timelineCard}>
                    <Text style={styles.timelineCardTitle}>LIVE STATUS PROGRESSION</Text>
                    <View style={styles.timelineWrap}>
                      {steps.map((step, idx) => {
                        const isLast = idx === steps.length - 1;
                        const StepIcon = step.icon;
                        const isDone = step.state === 'done';
                        const isCurrent = step.state === 'current';
                        const isError = step.state === 'error';

                        return (
                          <View key={step.id} style={styles.timelineRow}>
                            {/* Left indicator column with line */}
                            <View style={styles.timelineLeftCol}>
                              <View
                                style={[
                                  styles.timelineNode,
                                  isDone && styles.timelineNodeDone,
                                  isCurrent && styles.timelineNodeCurrent,
                                  isError && styles.timelineNodeError,
                                ]}
                              >
                                {isDone ? (
                                  <CheckCircle2 size={15} color="#ffffff" strokeWidth={3} />
                                ) : isError ? (
                                  <AlertCircle size={15} color="#ffffff" strokeWidth={3} />
                                ) : (
                                  <StepIcon
                                    size={14}
                                    color={isCurrent ? '#ffffff' : '#94a3b8'}
                                    strokeWidth={isCurrent ? 2.5 : 2}
                                  />
                                )}
                              </View>
                              {!isLast && (
                                <View
                                  style={[
                                    styles.timelineConnector,
                                    isDone && styles.timelineConnectorDone,
                                  ]}
                                />
                              )}
                            </View>

                            {/* Right text description */}
                            <View style={[styles.timelineRightCol, !isLast && { paddingBottom: 20 }]}>
                              <View style={styles.timelineStepHeader}>
                                <Text
                                  style={[
                                    styles.timelineStepTitle,
                                    isCurrent && { color: colors.primary },
                                    isError && { color: '#dc2626' },
                                  ]}
                                >
                                  {step.title}
                                </Text>
                                <View
                                  style={[
                                    styles.timelineTimeBadge,
                                    isCurrent && { backgroundColor: 'rgba(235, 125, 48, 0.12)' },
                                    isDone && { backgroundColor: '#dcfce7' },
                                    isError && { backgroundColor: '#fee2e2' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.timelineTimeText,
                                      isCurrent && { color: colors.primary },
                                      isDone && { color: '#15803d' },
                                      isError && { color: '#b91c1c' },
                                    ]}
                                  >
                                    {step.time}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.timelineStepDesc}>{step.description}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Transfer Details / Specifications Card */}
                  <View style={styles.detailsCard}>
                    <Text style={styles.detailsCardTitle}>PAYMENT SPECIFICATIONS</Text>

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Destination Bank</Text>
                      <Text style={styles.detailsValue}>{selectedPayout.bank_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailsDivider} />

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Account Name</Text>
                      <Text style={styles.detailsValue}>{selectedPayout.account_name || 'Rider'}</Text>
                    </View>
                    <View style={styles.detailsDivider} />

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Account Number</Text>
                      <Text style={styles.detailsValue}>{selectedPayout.account_number || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailsDivider} />

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Withdrawal Fee</Text>
                      <Text style={styles.detailsValue}>
                        ₦{Number(selectedPayout.fee_amount || 0).toLocaleString('en-NG')}
                      </Text>
                    </View>
                    <View style={styles.detailsDivider} />

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Total Deducted</Text>
                      <Text style={[styles.detailsValue, { color: colors.primary, fontWeight: '900' }]}>
                        ₦{Number((selectedPayout.amount || 0) + (selectedPayout.fee_amount || 0)).toLocaleString('en-NG')}
                      </Text>
                    </View>
                    <View style={styles.detailsDivider} />

                    <View style={styles.detailsRow}>
                      <Text style={styles.detailsLabel}>Submission Date</Text>
                      <Text style={styles.detailsValue}>
                        {selectedPayout.created_at
                          ? format(new Date(selectedPayout.created_at), 'MMM d, yyyy • h:mm a')
                          : 'Pending'}
                      </Text>
                    </View>

                    {selectedPayout.admin_notes && (
                      <>
                        <View style={styles.detailsDivider} />
                        <View style={{ paddingTop: 8 }}>
                          <Text style={styles.detailsLabel}>Admin / Finance Notes</Text>
                          <Text style={styles.adminNoteText}>{selectedPayout.admin_notes}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.trackerActionsRow}>
                    <TouchableOpacity
                      style={styles.shareReceiptBtn}
                      onPress={() => handleShareReceipt(selectedPayout)}
                      activeOpacity={0.85}
                    >
                      <Share2 size={16} color="#ffffff" />
                      <Text style={styles.shareReceiptBtnText}>SHARE RECEIPT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.trackerCloseBtn}
                      onPress={() => setSelectedPayout(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.trackerCloseBtnText}>CLOSE</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            );
          })()}
        </View>
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
  // Payout Request Cards & Live Tracking Styles
  payoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  payoutCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  payoutCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutRef: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  payoutBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payoutBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  payoutBankInfo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  payoutCardRight: {
    alignItems: 'flex-end',
  },
  payoutAmountText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  payoutDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  payoutCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  trackPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trackPromptText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  trackActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  // Tracker Modal Styles
  trackerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  trackerHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  trackerHeaderSub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  trackerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trackerStatusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trackerScroll: {
    maxHeight: SCREEN_HEIGHT * 0.76,
  },
  trackerScrollContent: {
    padding: 20,
    gap: 16,
  },
  trackerAmountBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  trackerAmountLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  trackerAmountValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  trackerBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  trackerBankText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    padding: 12,
  },
  rejectedTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#991b1b',
  },
  rejectedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
    marginTop: 2,
    lineHeight: 16,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  timelineCardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  timelineWrap: {
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 28,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineNodeDone: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  timelineNodeCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  timelineNodeError: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 2,
  },
  timelineConnectorDone: {
    backgroundColor: '#16a34a',
  },
  timelineRightCol: {
    flex: 1,
    gap: 2,
  },
  timelineStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  timelineStepTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  timelineTimeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  timelineTimeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  timelineStepDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 15,
    marginTop: 1,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  detailsCardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  detailsValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  adminNoteText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 2,
    lineHeight: 16,
  },
  trackerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shareReceiptBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
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
  shareReceiptBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  trackerCloseBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  // Segmented switcher styles
  historySegmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  historySegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 5,
  },
  historySegmentTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  historySegmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  historySegmentTextActive: {
    fontWeight: '900',
    color: '#0f172a',
  },
  historySegmentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  historySegmentBadgeActive: {
    backgroundColor: colors.primary,
  },
  historySegmentBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#64748b',
  },
  historySegmentBadgeTextActive: {
    color: '#ffffff',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyCardSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
