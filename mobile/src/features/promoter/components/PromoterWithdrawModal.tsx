import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X, ArrowDownToLine, Landmark, CreditCard, User, AlertCircle } from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { toast } from '../../../components/ui';

const BRAND_ORANGE = '#EB7D30';

interface PromoterWithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  availableBalance: number;
  onSubmit: (params: {
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function PromoterWithdrawModal({
  visible,
  onClose,
  availableBalance,
  onSubmit,
}: PromoterWithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount >= 1000 && parsedAmount <= availableBalance;
  const isFormValid =
    isAmountValid &&
    bankName.trim().length >= 2 &&
    accountNumber.trim().length === 10 &&
    accountName.trim().length >= 3;

  const handleUseMax = () => {
    Haptics.selectionAsync();
    setAmount(String(availableBalance));
  };

  const handleFormSubmit = async () => {
    if (!isFormValid) {
      if (parsedAmount < 1000) {
        toast.warning('Minimum Withdrawal', { description: 'Minimum payout threshold is ₦1,000.' });
      } else if (parsedAmount > availableBalance) {
        toast.warning('Insufficient Balance', { description: `You have ₦${availableBalance.toLocaleString()} available.` });
      } else if (accountNumber.trim().length !== 10) {
        toast.warning('Invalid Account Number', { description: 'Nigerian bank account numbers must be 10 digits.' });
      } else {
        toast.warning('Missing Fields', { description: 'Please complete all bank details.' });
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmit({
        amount: parsedAmount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });

      if (res.success) {
        setAmount('');
        setBankName('');
        setAccountNumber('');
        setAccountName('');
        onClose();
      }
    } catch (e: any) {
      console.warn('[PromoterWithdrawModal] submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <ArrowDownToLine size={16} color={BRAND_ORANGE} />
              </View>
              <Text style={styles.sheetTitle}>Request Bank Payout</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Balance Card Banner */}
            <View style={styles.balanceBanner}>
              <View>
                <Text style={styles.balanceBannerLabel}>AVAILABLE FOR WITHDRAWAL</Text>
                <Text style={styles.balanceBannerValue}>₦{availableBalance.toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={styles.useMaxChip} onPress={handleUseMax} activeOpacity={0.8}>
                <Text style={styles.useMaxText}>Use Max</Text>
              </TouchableOpacity>
            </View>

            {/* Amount Field */}
            <Text style={styles.inputLabel}>AMOUNT (₦)</Text>
            <View style={styles.inputBox}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Min. 1,000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {/* Bank Name */}
            <Text style={styles.inputLabel}>BANK NAME</Text>
            <View style={styles.inputBox}>
              <Landmark size={18} color="#94A3B8" />
              <TextInput
                style={styles.inputField}
                placeholder="e.g. GTBank, Kuda, Zenith, OPay"
                placeholderTextColor="#94A3B8"
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            {/* Account Number */}
            <Text style={styles.inputLabel}>ACCOUNT NUMBER (10 DIGITS)</Text>
            <View style={styles.inputBox}>
              <CreditCard size={18} color="#94A3B8" />
              <TextInput
                style={styles.inputField}
                placeholder="0123456789"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={10}
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/\D/g, ''))}
              />
            </View>

            {/* Account Name */}
            <Text style={styles.inputLabel}>ACCOUNT HOLDER NAME</Text>
            <View style={styles.inputBox}>
              <User size={18} color="#94A3B8" />
              <TextInput
                style={styles.inputField}
                placeholder="Full name as registered with bank"
                placeholderTextColor="#94A3B8"
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            {/* Notice */}
            <View style={styles.noticeBox}>
              <AlertCircle size={14} color="#6B7280" />
              <Text style={styles.noticeText}>
                Payouts are verified and sent via instant NIP bank transfer. Minimum threshold is ₦1,000.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, !isFormValid && styles.submitBtnDisabled]}
              onPress={handleFormSubmit}
              disabled={submitting || !isFormValid}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Confirm Withdrawal</Text>
                  <ArrowDownToLine size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  balanceBannerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: BRAND_ORANGE,
    letterSpacing: 0.5,
  },
  balanceBannerValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C25E1A',
    marginTop: 2,
  },
  useMaxChip: {
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  useMaxText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '900',
    color: BRAND_ORANGE,
  },
  inputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  submitBtn: {
    backgroundColor: BRAND_ORANGE,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
