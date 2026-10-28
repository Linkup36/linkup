import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface SendProgressProps {
  currentStep: number;
}

const STEPS = [
  { num: 1, label: 'Package\nDetails' },
  { num: 2, label: 'Pickup\nLocation' },
  { num: 3, label: 'Drop-off\nLocation' },
  { num: 4, label: 'Review\n& Price' },
  { num: 5, label: 'Confirm\n& Pay' },
];

export function SendProgress({ currentStep }: SendProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {STEPS.map((s) => {
        const isActive = currentStep === s.num;
        const isCompleted = currentStep > s.num;

        return (
          <View key={s.num} style={styles.stepItem}>
            <View
              style={[
                styles.badge,
                isActive && styles.badgeActive,
                isCompleted && styles.badgeCompleted,
              ]}
            >
              {isCompleted ? (
                <Check size={13} color="#ffffff" strokeWidth={3} />
              ) : (
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {s.num}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.label,
                (isActive || isCompleted) && styles.labelActive,
              ]}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    position: 'relative',
    marginBottom: 8,
  },
  line: {
    position: 'absolute',
    top: 26,
    left: 28,
    right: 28,
    height: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 0,
  },
  stepItem: {
    alignItems: 'center',
    width: 60,
    zIndex: 1,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeActive: {
    backgroundColor: '#ffffff',
    borderColor: colors.primary,
    borderWidth: 2.5,
    transform: [{ scale: 1.1 }],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  badgeTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 11,
  },
  labelActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
});
