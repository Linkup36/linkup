import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, MoreHorizontal, Truck, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { getStateMeta, normalizeState, orderStateMachine } from '../../../state-machines';

interface OrderTimelineProps {
  status: string;
  shipmentStatus?: string;
}

const STEP_IDS = ['pending', 'processing', 'transit', 'delivered'] as const;

export function OrderTimeline({ status: rawStatus }: OrderTimelineProps) {
  const status = normalizeState(orderStateMachine, rawStatus) ?? (rawStatus || 'pending').toLowerCase();
  const meta = getStateMeta(orderStateMachine, status);
  const currentStepIdx = meta.stepIndex ?? 0;

  const getStepStatus = (stepId: string) => {
    if (status === 'cancelled') return 'cancelled';
    if (status === 'refunded' || status === 'disputed') return 'complete';

    const targetIdx = STEP_IDS.indexOf(stepId as (typeof STEP_IDS)[number]);
    if (currentStepIdx >= targetIdx) return 'complete';
    if (currentStepIdx === targetIdx - 1) return 'current';
    return 'upcoming';
  };

  const getDynamicLabel = (stepId: string) => {
    if (status === 'refunded' || status === 'disputed') return meta.shortLabel || meta.label;
    const targetIdx = STEP_IDS.indexOf(stepId as (typeof STEP_IDS)[number]);
    if (currentStepIdx === targetIdx && meta.shortLabel) {
      return meta.shortLabel;
    }
    if (stepId === 'processing') return 'Processing';
    if (stepId === 'transit') return 'Transit';
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
