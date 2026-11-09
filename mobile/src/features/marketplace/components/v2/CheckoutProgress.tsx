import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

interface CheckoutProgressProps {
  currentStep: number; // 1: Delivery, 2: Payment, 3: Success
}

const steps = [
  { id: 1, name: 'Delivery' },
  { id: 2, name: 'Payment' },
  { id: 3, name: 'Confirm' },
];

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.lineContainer}>
        <View style={styles.bgLine} />
        <View
          style={[
            styles.activeLine,
            { width: `${((Math.min(currentStep, 3) - 1) / 2) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.stepsRow}>
        {steps.map((step) => {
          const isDone = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <View key={step.id} style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                {isDone ? (
                  <Check size={16} color="#ffffff" strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      isCurrent && styles.circleTextCurrent,
                    ]}
                  >
                    {step.id}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  (isCurrent || isDone) && styles.labelActive,
                ]}
              >
                {step.name}
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
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineContainer: {
    position: 'absolute',
    top: 36,
    left: 54,
    right: 54,
    height: 2,
  },
  bgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
  },
  activeLine: {
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepItem: {
    alignItems: 'center',
    width: 72,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  circleCurrent: {
    borderColor: '#0f172a',
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
  },
  circleDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  circleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  circleTextCurrent: {
    color: '#0f172a',
    fontWeight: '900',
  },
  label: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
});
