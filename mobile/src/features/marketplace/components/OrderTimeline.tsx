import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, MoreHorizontal, Truck, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface OrderTimelineProps {
  status: string;
  shipmentStatus?: string;
}

export function OrderTimeline({ status: rawStatus }: OrderTimelineProps) {
  const status = (rawStatus || 'pending').toLowerCase();

  const allStatuses = [
    'pending',
    'confirmed',
    'awaiting_agent',
    'accepted',
    'out_for_pickup',
    'arrived_at_seller',
    'picked_up',
    'out_for_delivery',
    'arrived_at_destination',
    'delivered',
    'completed',
    'refunded',
    'disputed',
  ];
  const currentIdx = allStatuses.indexOf(status);

  const getStepStatus = (stepId: string) => {
    if (status === 'cancelled') return 'cancelled';
    if (status === 'refunded' || status === 'disputed') return 'complete';

    let targetIdx = 0;
    if (stepId === 'pending') targetIdx = 0;
    else if (stepId === 'processing') targetIdx = 2;
    else if (stepId === 'transit') targetIdx = 6;
    else if (stepId === 'delivered') targetIdx = 9;

    if (currentIdx >= targetIdx) return 'complete';
    if (currentIdx === targetIdx - 1) return 'current';
    return 'upcoming';
  };

  const getDynamicLabel = (stepId: string) => {
    if (status === 'refunded') return 'Refunded';
    if (status === 'disputed') return 'Disputed';

    if (stepId === 'processing') {
      if (status === 'awaiting_agent') return 'Finding Rider';
      if (status === 'accepted') return 'Assigned';
      return 'Processing';
    }
    if (stepId === 'transit') {
      if (status === 'out_for_pickup') return 'To Seller';
      if (status === 'picked_up') return 'Picked Up';
      if (status === 'out_for_delivery') return 'On the Way';
      return 'Transit';
    }
    if (stepId === 'delivered') return 'Secured';
    return 'Logged';
  };

  const steps = [
    { id: 'pending', icon: CheckCircle2 },
    { id: 'processing', icon: MoreHorizontal },
    { id: 'transit', icon: Truck },
    { id: 'delivered', icon: ShieldCheck },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.lineContainer}>
        <View style={styles.bgLine} />
      </View>

      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const stepStatus = getStepStatus(step.id);
          const isComplete = stepStatus === 'complete';
          const isCurrent = stepStatus === 'current';
          const Icon = step.icon;

          return (
            <View key={idx} style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  isComplete && styles.circleComplete,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                <Icon
                  size={16}
                  color={isComplete ? '#ffffff' : isCurrent ? colors.primary : '#94a3b8'}
                  strokeWidth={isComplete ? 2.5 : 2}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  isComplete && styles.labelComplete,
                  isCurrent && styles.labelCurrent,
                ]}
              >
                {getDynamicLabel(step.id)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  lineContainer: {
    position: 'absolute',
    top: 30,
    left: 40,
    right: 40,
    height: 2,
  },
  bgLine: {
    height: 2,
    backgroundColor: '#e2e8f0',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepItem: {
    alignItems: 'center',
    width: 70,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleComplete: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  circleCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  label: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  labelComplete: {
    color: '#0f172a',
  },
  labelCurrent: {
    color: colors.primary,
  },
});
