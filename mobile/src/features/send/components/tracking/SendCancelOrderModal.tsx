import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { XCircle, Check, AlertTriangle, X } from 'lucide-react-native';
import { supabase } from '../../../../services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../../../components/ui/GooeyToast';
import { colors } from '../../../../theme/colors';

interface SendCancelOrderModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: () => void;
  onOpenSupport?: () => void;
}

const CANCELLATION_REASONS = [
  { id: 'too_long', label: 'Taking too long to find a dispatch rider' },
  { id: 'wrong_address', label: 'Entered incorrect pickup or drop-off address' },
  { id: 'recipient_unavailable', label: 'Recipient is unavailable / change of plans' },
  { id: 'rider_requested', label: 'Dispatch rider asked me to cancel' },
  { id: 'found_alternative', label: 'Found alternative delivery service' },
  { id: 'other', label: 'Other reason' },
];

export function SendCancelOrderModal({
  visible,
  onClose,
  order,
  onSuccess,
  onOpenSupport,
}: SendCancelOrderModalProps) {
  const queryClient = useQueryClient();
  const [selectedReason, setSelectedReason] = useState<string>('too_long');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const scrollRef = useRef<any>(null);

  if (!order) return null;

  const orderId = order.id;
  const status = order.status;
  const deliveryFee = Number(order.delivery_fee || 0);
  const isPaid = order.payment_status === 'paid';

  const isInTransit = status === 'pickup' || status === 'on_the_way';
  const isDelivered = status === 'delivered';
  const isAlreadyCancelled = status === 'cancelled';

  const handleCancelOrder = async () => {
    if (isInTransit || isDelivered || isAlreadyCancelled) return;

    setIsSubmitting(true);
    const finalReason =
      selectedReason === 'other' && customReason.trim()
        ? customReason.trim()
        : CANCELLATION_REASONS.find((r) => r.id === selectedReason)?.label || 'Cancelled by user';

    try {
      // 1. Try invoking atomic cancellation & wallet refund RPC
      const { error: rpcError } = await (supabase as any).rpc('cancel_send_order', {
        p_order_id: orderId,
        p_reason: finalReason,
      });

      if (rpcError) {
        // Fallback: Direct table update
        console.warn('RPC failed, falling back to direct table update:', rpcError);
        const { error: updateError } = await (supabase as any)
          .from('send_orders')
          .update({
            status: 'cancelled',
            package_details: {
              ...(order.package_details || {}),
              cancellation_reason: finalReason,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) throw updateError;
      }

      queryClient.invalidateQueries({ queryKey: ['send_order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });

      toast.success(
        isPaid && deliveryFee > 0
          ? `Order cancelled. ₦${deliveryFee.toLocaleString()} refunded to your wallet.`
          : 'Package order cancelled successfully.'
      );

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      toast.error('Failed to cancel order: ' + (err.message || 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <XCircle size={22} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Cancel Package Delivery</Text>
                <Text style={styles.subtitle}>Order ID: {orderId}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* If package is already picked up */}
            {isInTransit ? (
              <View style={styles.warningBox}>
                <AlertTriangle size={18} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Package in Transit</Text>
                  <Text style={styles.warningText}>
                    Your package has already been picked up by the courier. Please contact support to
                    request a reroute or return.
                  </Text>
                  {onOpenSupport && (
                    <TouchableOpacity style={styles.supportLink} onPress={onOpenSupport}>
                      <Text style={styles.supportLinkText}>Contact Dispatch Support</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Refund Notice */}
              <View style={styles.refundNotice}>
                <Text style={styles.refundTitle}>
                  {isPaid ? '100% Instant Wallet Refund' : 'Free Cancellation'}
                </Text>
                <Text style={styles.refundText}>
                  {isPaid
                    ? `₦${deliveryFee.toLocaleString()} will be immediately credited to your LinkUp Wallet.`
                    : 'No cancellation fee applies before a courier picks up.'}
                </Text>
              </View>

              <Text style={styles.reasonHeading}>Select reason for cancellation:</Text>
              <View style={styles.reasonsList}>
                {CANCELLATION_REASONS.map((r) => {
                  const isSelected = selectedReason === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                      onPress={() => setSelectedReason(r.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </View>
                      <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedReason === 'other' && (
                <TextInput
                  style={styles.customInput}
                  placeholder="Please state the reason..."
                  placeholderTextColor="#94a3b8"
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  numberOfLines={2}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, Platform.OS === 'ios' ? 70 : 120);
                  }}
                />
              )}

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.dismissBtnText}>Keep Delivery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmCancelBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleCancelOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmCancelBtnText}>Cancel Order</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 14,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  warningText: {
    fontSize: 11,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 16,
  },
  supportLink: {
    marginTop: 8,
  },
  supportLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    textDecorationLine: 'underline',
  },
  refundNotice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 14,
  },
  refundTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  refundText: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
  },
  reasonHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
    marginBottom: 8,
  },
  reasonsList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  reasonOptionSelected: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  reasonText: {
    fontSize: 11.5,
    color: '#334155',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#991b1b',
    fontWeight: '700',
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    marginTop: 8,
    minHeight: 50,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
