import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Check,
  Copy,
  Search,
  Package,
  Bike,
  Truck,
  CheckCircle2,
  Navigation,
  RotateCcw,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { toast } from '../../../../components/ui/GooeyToast';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface StepPaymentSuccessProps {
  orderId: string;
  formData: SendOrderFormData;
  onReset: () => void;
}

export function StepPaymentSuccess({
  orderId,
  formData,
  onReset,
}: StepPaymentSuccessProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const nextSteps = [
    {
      icon: Search,
      title: 'Finding a rider',
      desc: "We're searching for the best rider near you.",
      active: true,
    },
    {
      icon: Bike,
      title: 'Rider assigned',
      desc: "We'll notify you once a rider accepts.",
      active: false,
    },
    {
      icon: Package,
      title: 'Pick up',
      desc: 'Rider will come to pick up your package.',
      active: false,
    },
    {
      icon: Truck,
      title: 'On the way',
      desc: 'Your package is on the way to recipient.',
      active: false,
    },
    {
      icon: CheckCircle2,
      title: 'Delivered',
      desc: 'Package delivered safely.',
      active: false,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Celebration Icon */}
      <View style={styles.checkCircleWrap}>
        <View style={styles.checkCirclePulse} />
        <View style={styles.checkCircle}>
          <Check size={36} color="#ffffff" strokeWidth={3.5} />
        </View>
      </View>

      <Text style={styles.heading}>Booking Confirmed!</Text>
      <Text style={styles.subheading}>
        Your package delivery has been placed successfully. We are searching for the nearest dispatch
        rider.
      </Text>

      {/* Order ID Card */}
      <View style={styles.orderIdCard}>
        <Text style={styles.orderIdLabel}>TRACKING ORDER ID</Text>
        <View style={styles.orderIdRow}>
          <Text style={styles.orderIdText}>{orderId}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
            {copied ? (
              <Check size={16} color="#16a34a" strokeWidth={2.8} />
            ) : (
              <Copy size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Next Steps Progress Card */}
      <View style={styles.timelineCard}>
        <Text style={styles.timelineHeading}>WHAT HAPPENS NEXT</Text>
        <View style={styles.timelineList}>
          {nextSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <View key={step.title} style={styles.timelineRow}>
                <View style={styles.iconColumn}>
                  <View
                    style={[
                      styles.stepIconWrap,
                      step.active && styles.stepIconWrapActive,
                    ]}
                  >
                    <Icon
                      size={15}
                      color={step.active ? '#ffffff' : '#94a3b8'}
                      strokeWidth={2.4}
                    />
                  </View>
                  {idx < nextSteps.length - 1 && <View style={styles.timelineConnector} />}
                </View>

                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Text style={[styles.stepTitle, step.active && styles.stepTitleActive]}>
                    {step.title}
                  </Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => navigation.navigate('SendTracking', { orderId })}
          activeOpacity={0.85}
        >
          <Navigation size={18} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.trackBtnText}>Track Live Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookAnotherBtn}
          onPress={onReset}
          activeOpacity={0.8}
        >
          <RotateCcw size={16} color="#475569" strokeWidth={2.2} />
          <Text style={styles.bookAnotherBtnText}>Send Another Package</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  checkCircleWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkCirclePulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320,
  },
  orderIdCard: {
    width: '100%',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  orderIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.5,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  copyBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  timelineCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 16,
  },
  timelineHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconColumn: {
    alignItems: 'center',
    width: 28,
  },
  stepIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconWrapActive: {
    backgroundColor: colors.primary,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 3,
  },
  stepTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  stepTitleActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  stepDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trackBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  bookAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bookAnotherBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
