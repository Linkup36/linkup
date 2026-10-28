import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { AppModal } from '../../../components/ui/AppModal';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../components/ui/GooeyToast';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface ProductReportModalProps {
  productId: string;
  sellerId?: string;
  productTitle: string;
  visible: boolean;
  onClose: () => void;
}

export function ProductReportModal({
  productId,
  sellerId,
  productTitle,
  visible,
  onClose,
}: ProductReportModalProps) {
  const { user } = useAuth();
  const [reportReason, setReportReason] = useState('Counterfeit / Fake');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = [
    'Counterfeit / Fake',
    'Incorrect Information',
    'Prohibited Item',
    'Defective / Damaged',
    'Scam / Fraud',
  ];

  const handleSubmit = async () => {
    if (!user) {
      toast.info('Please sign in to report a product');
      return;
    }

    if (!reportDetails.trim()) {
      toast.error('Please describe the issue found');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('issues' as any).insert([
        {
          reporter_id: user.id,
          product_id: productId,
          seller_id: sellerId,
          title: `[Product Report] ${reportReason}`,
          description: `Product: ${productTitle}\nReason: ${reportReason}\n\nDetails:\n${reportDetails.trim()}`,
          priority: 'high',
          status: 'open',
        },
      ]);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Report submitted to Trust & Safety team');
      setReportDetails('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Report Listing"
      subtitle="Help keep the Linkup marketplace secure and authentic"
      variant="warning"
      primaryButton={{
        label: isSubmitting ? 'Submitting...' : 'Submit Report',
        onPress: handleSubmit,
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: onClose,
        variant: 'outline',
      }}
    >
      <View style={styles.container}>
        <Text style={styles.fieldLabel}>Reason for Report</Text>
        <View style={styles.pillsRow}>
          {reasons.map((r) => {
            const isSelected = reportReason === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.pill, isSelected && styles.pillActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReportReason(r);
                }}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Additional Details</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Please describe why this item should be investigated..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          value={reportDetails}
          onChangeText={setReportDetails}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    textAlignVertical: 'top',
    height: 90,
    backgroundColor: '#f8fafc',
  },
});
