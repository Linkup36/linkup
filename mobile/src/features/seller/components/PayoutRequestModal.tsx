import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { AppModal } from '../../../components/ui/AppModal';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { ArrowDownToLine, Landmark, Clock, ShieldCheck, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface PayoutRequestModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: any;
  onSuccess?: () => void;
}

export function PayoutRequestModal({
  visible,
  onClose,
  wallet,
  onSuccess,
}: PayoutRequestModalProps) {
  const { user, profile } = useAuth();

  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableBalance = wallet?.balance || 0;

  // Auto-fill from profile bank details
  useEffect(() => {
    if (visible && profile) {
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
  }, [visible, profile]);

  const handleRequest = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1000) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal amount is ₦1,000.');
      return;
    }
    if (amt > availableBalance) {
      Alert.alert('Insufficient Balance', 'Amount exceeds your available wallet balance.');
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || accountNumber.length < 10) {
      Alert.alert('Invalid Bank Details', 'Please provide a valid 10-digit Nigerian bank account.');
      return;
    }

    setSubmitting(true);
    try {
      Haptics.selectionAsync().catch(() => {});

      // 1. Resolve target wallet ID
      let targetWalletId = wallet?.id;
      if (!targetWalletId && user?.id) {
        const { data: w } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', user.id)
          .maybeSingle();
        if (w?.id) {
          targetWalletId = w.id;
        }
      }

      if (!targetWalletId) {
        Alert.alert('Wallet Error', 'Could not locate your active wallet. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      // 2. Insert payout request with wallet_id and fee_amount (database trigger validates balance, deducts wallet balance, and creates transaction)
      const { error } = await supabase.from('payout_requests').insert({
        user_id: user?.id,
        wallet_id: targetWalletId,
        amount: amt,
        fee_amount: 0,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim() || profile?.display_name || 'Account Holder',
        status: 'pending',
      });

      if (error) throw error;

      // 3. Save bank details to user profile for future auto-fill
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Payout Requested',
        'Your withdrawal request has been placed and is being processed by escrow settlements.'
      );

      setAmount('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      Alert.alert('Withdrawal Error', e.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Request Payout"
      subtitle="Withdraw cleared store earnings to your bank account"
    >
      <View style={styles.container}>
        {/* Available Balance Header */}
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Cleared Available Balance</Text>
          <Text style={styles.balanceValue}>₦{availableBalance.toLocaleString()}</Text>
        </View>

        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Withdrawal Amount (₦)</Text>
          <View style={styles.amountInputRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="Min ₦1,000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {availableBalance > 0 && (
              <TouchableOpacity
                style={styles.maxBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setAmount(String(availableBalance));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Amount Pills */}
        {availableBalance >= 1000 && (
          <View style={styles.quickPills}>
            {[
              { label: '₦1,000', val: 1000 },
              { label: '50%', val: Math.floor(availableBalance * 0.5) },
              { label: 'MAX', val: availableBalance },
            ].map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.pill}
                onPress={() => {
                  Keyboard.dismiss();
                  setAmount(String(p.val));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.pillText}>
                  {p.label} (₦{p.val.toLocaleString()})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bank Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Settlement Bank Name</Text>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. GTBank, Access Bank, Kuda, OPay"
            placeholderTextColor="#94a3b8"
            returnKeyType="next"
          />
        </View>

        {/* Account Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>10-Digit Account Number</Text>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="0123456789"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            maxLength={10}
            returnKeyType="next"
          />
        </View>

        {/* Account Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Account Name</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Account holder name"
            placeholderTextColor="#94a3b8"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>

        {/* Dismiss keyboard prompt */}
        <TouchableOpacity
          style={styles.dismissRow}
          onPress={() => Keyboard.dismiss()}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Tap to collapse keyboard</Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleRequest}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <ArrowDownToLine size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.submitBtnText}>Confirm Payout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    gap: 14,
  },
  balanceBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803d',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  amountInputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  amountInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    paddingRight: 72,
  },
  maxBtn: {
    position: 'absolute',
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  quickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
  },
  pill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dismissRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dismissText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

