import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { AppModal } from '../../../components/ui/AppModal';
import { PaystackWebViewModal } from '../../../components/ui/PaystackWebViewModal';
import { useAuth } from '../../../context/AuthContext';
import { supabase, invokeEdgeFunction } from '../../../services/supabase';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  ArrowLeft,
  X,
  CreditCard,
  Building2,
  CheckCircle2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../theme/colors';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  reference: string;
  created_at: string;
}

export function WalletScreen() {
  const navigation = useNavigation();
  const { user, profile } = useAuth();

  const [wallet, setWallet] = useState<{ id: string; balance: number; escrow_balance: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      // 1. Fetch or create wallet
      let { data: wData, error: wError } = await supabase
        .from('wallets')
        .select('id, balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!wData && !wError) {
        const { data: created } = await supabase
          .from('wallets')
          .insert({ user_id: user.id, balance: 0, escrow_balance: 0 })
          .select('id, balance, escrow_balance')
          .single();
        wData = created;
      }

      setWallet(wData);

      // 2. Fetch transactions
      if (wData?.id) {
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('id, amount, type, reference, created_at')
          .eq('wallet_id', wData.id)
          .order('created_at', { ascending: false })
          .limit(30);

        if (txData) {
          setTransactions(txData as Transaction[]);
        }
      }
    } catch (err) {
      console.warn('[WalletScreen] Error loading wallet:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [user]);

  useEffect(() => {
    if (isWithdrawOpen && profile) {
      if ((profile as any).payout_bank_name && !bankName) {
        setBankName((profile as any).payout_bank_name);
      }
      if ((profile as any).payout_account_number && !accountNumber) {
        setAccountNumber((profile as any).payout_account_number);
      }
      if ((profile as any).payout_account_name && !accountName) {
        setAccountName((profile as any).payout_account_name);
      }
    }
  }, [isWithdrawOpen, profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  const handleStartDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt < 500) {
      Alert.alert('Invalid Amount', 'Minimum wallet deposit is ₦500.');
      return;
    }
    setIsDepositOpen(false);
    setIsPaystackOpen(true);
  };

  const handlePaystackDepositSuccess = async (reference: string) => {
    setIsPaystackOpen(false);
    const amt = parseFloat(depositAmount);
    setLoading(true);

    try {
      // Credit wallet via Edge Function or Supabase table
      const { data, error } = await invokeEdgeFunction('credit-wallet', {
        reference,
        amount: amt,
        userId: user?.id,
      });

      if (error) {
        // Fallback direct insert if function not deployed
        if (wallet?.id) {
          await supabase.from('wallets').update({ balance: (wallet.balance || 0) + amt }).eq('id', wallet.id);
          await supabase.from('wallet_transactions').insert({
            wallet_id: wallet.id,
            amount: amt,
            type: 'credit',
            reference,
          });
        }
      }

      setDepositAmount('');
      Alert.alert('Deposit Successful', `₦${amt.toLocaleString()} credited to your wallet.`);
      fetchWalletData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not verify deposit.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 1000) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal amount is ₦1,000.');
      return;
    }
    if (!wallet || amt > wallet.balance) {
      Alert.alert('Insufficient Balance', 'Withdrawal amount exceeds your available balance.');
      return;
    }
    if (!bankName || !accountNumber || accountNumber.length < 10) {
      Alert.alert('Invalid Bank Details', 'Please provide a valid 10-digit Nigerian bank account.');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const { error } = await supabase.from('payout_requests').insert({
        user_id: user?.id,
        wallet_id: wallet.id,
        amount: amt,
        fee_amount: 0,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim() || profile?.full_name || 'Account Holder',
        status: 'pending',
      });

      if (error) throw error;

      // Save bank details to user profile
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            payout_bank_name: bankName.trim(),
            payout_account_number: accountNumber.trim(),
            payout_account_name: accountName.trim(),
          })
          .eq('id', user.id);
      }

      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');

      Alert.alert('Withdrawal Requested', 'Your payout request is being processed (typically within 1-2 hours).');
      fetchWalletData();
    } catch (e: any) {
      Alert.alert('Withdrawal Error', e.message || 'Failed to submit payout request.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const formatPrice = (amount: number) => '₦' + (amount || 0).toLocaleString('en-NG');

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Linkup Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.walletIconWrap}>
              <Wallet size={20} color="#ffffff" />
            </View>
            <View style={styles.escrowChip}>
              <ShieldCheck size={14} color="#16a34a" />
              <Text style={styles.escrowText}>Escrow Protected</Text>
            </View>
          </View>

          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            {loading ? '₦...' : formatPrice(wallet?.balance || 0)}
          </Text>

          {wallet && wallet.escrow_balance > 0 && (
            <View style={styles.escrowRow}>
              <Clock size={14} color="#cbd5e1" />
              <Text style={styles.escrowPendingText}>
                ₦{wallet.escrow_balance.toLocaleString()} in pending escrow
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setIsDepositOpen(true)}
              activeOpacity={0.8}
            >
              <ArrowDownToLine size={18} color={colors.primary} />
              <Text style={styles.actionBtnText}>Add Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => setIsWithdrawOpen(true)}
              activeOpacity={0.8}
            >
              <ArrowUpRight size={18} color="#ffffff" />
              <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <Text style={styles.sectionCount}>{transactions.length} records</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Wallet size={40} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>Your deposits, payouts, and order payments will appear here.</Text>
          </View>
        ) : (
          transactions.map((tx) => {
            const isCredit = tx.type === 'credit';
            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, isCredit ? styles.creditIcon : styles.debitIcon]}>
                  {isCredit ? (
                    <ArrowDownToLine size={18} color="#16a34a" />
                  ) : (
                    <ArrowUpRight size={18} color="#ef4444" />
                  )}
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txRef}>{tx.reference || (isCredit ? 'Wallet Top-Up' : 'Payout/Debit')}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, isCredit ? styles.creditAmount : styles.debitAmount]}>
                  {isCredit ? '+' : '-'} {formatPrice(tx.amount)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Deposit Modal */}
      <AppModal
        visible={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        title="Fund Wallet"
        subtitle="Add funds securely via Paystack debit card / bank transfer"
      >
        <Text style={styles.inputLabel}>Enter Amount (₦)</Text>
        <TextInput
          placeholder="e.g. 5,000"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
          style={styles.modalInput}
          value={depositAmount}
          onChangeText={setDepositAmount}
        />

        <View style={styles.quickPills}>
          {['1000', '2000', '5000', '10000', '20000'].map((preset) => (
            <TouchableOpacity
              key={preset}
              style={styles.pill}
              onPress={() => setDepositAmount(preset)}
            >
              <Text style={styles.pillText}>₦{parseInt(preset).toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Continue to Paystack"
          onPress={handleStartDeposit}
          style={{ marginTop: 20 }}
        />
      </AppModal>

      {/* Paystack In-App Modal for Wallet Funding */}
      <PaystackWebViewModal
        visible={isPaystackOpen}
        email={user?.email || 'customer@linkupng.com'}
        amount={parseFloat(depositAmount) || 0}
        onSuccess={handlePaystackDepositSuccess}
        onCancel={() => setIsPaystackOpen(false)}
      />

      {/* Withdraw Modal */}
      <AppModal
        visible={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        title="Withdraw to Bank"
        subtitle="Transfer funds to your Nigerian bank account"
      >
        <View style={styles.modalBody}>
          {/* Available balance indicator */}
          <View style={styles.availableRow}>
            <Text style={styles.availableLabel}>Available Balance:</Text>
            <Text style={styles.availableAmount}>
              ₦{(wallet?.balance || 0).toLocaleString()}
            </Text>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Withdrawal Amount (₦)</Text>
          <View style={styles.amountInputWrap}>
            <TextInput
              placeholder="Min ₦1,000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              style={[styles.modalInput, styles.amountInput]}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {wallet && wallet.balance > 0 && (
              <TouchableOpacity
                style={styles.maxPill}
                onPress={() => {
                  Keyboard.dismiss();
                  setWithdrawAmount(String(wallet.balance));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.maxPillText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Percentage Presets */}
          {wallet && wallet.balance >= 1000 && (
            <View style={styles.quickPills}>
              {[
                { label: '₦1,000', val: 1000 },
                { label: '50%', val: Math.floor(wallet.balance * 0.5) },
                { label: 'MAX', val: wallet.balance },
              ].map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.pill}
                  onPress={() => {
                    Keyboard.dismiss();
                    setWithdrawAmount(String(item.val));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pillText}>
                    {item.label} (₦{item.val.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bank Name */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Bank Name</Text>
          <TextInput
            placeholder="e.g. GTBank, Access Bank, Kuda, OPay"
            placeholderTextColor="#94a3b8"
            style={styles.modalInput}
            value={bankName}
            onChangeText={setBankName}
            returnKeyType="next"
          />

          {/* 10-Digit Account Number */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>10-Digit Account Number</Text>
          <TextInput
            placeholder="0123456789"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            maxLength={10}
            style={styles.modalInput}
            value={accountNumber}
            onChangeText={setAccountNumber}
            returnKeyType="next"
          />

          {/* Account Name */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Account Name</Text>
          <TextInput
            placeholder="Account holder name"
            placeholderTextColor="#94a3b8"
            style={styles.modalInput}
            value={accountName}
            onChangeText={setAccountName}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          {/* Dismiss Keyboard Shortcut */}
          <TouchableOpacity
            style={styles.dismissKbdRow}
            onPress={() => Keyboard.dismiss()}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissKbdText}>Tap here to collapse keyboard</Text>
          </TouchableOpacity>

          <Button
            title="Confirm Withdrawal"
            onPress={handleRequestWithdrawal}
            loading={submittingWithdraw}
            style={{ marginTop: 16 }}
          />
        </View>
      </AppModal>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  escrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  escrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },
  balanceLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  escrowPendingText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
  },
  actionBtnOutline: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditIcon: {
    backgroundColor: '#dcfce7',
  },
  debitIcon: {
    backgroundColor: '#fee2e2',
  },
  txInfo: {
    flex: 1,
    marginLeft: 12,
  },
  txRef: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  txDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  creditAmount: {
    color: '#16a34a',
  },
  debitAmount: {
    color: '#ef4444',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  quickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  modalBody: {
    paddingVertical: 6,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  availableLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  availableAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#15803d',
  },
  amountInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  amountInput: {
    paddingRight: 68,
  },
  maxPill: {
    position: 'absolute',
    right: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  maxPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  dismissKbdRow: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  dismissKbdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
});
