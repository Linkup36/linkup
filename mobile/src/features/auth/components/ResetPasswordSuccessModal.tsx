import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Mail, ArrowRight, X, Check, ExternalLink, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface ResetPasswordSuccessModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onReturnToSignIn: () => void;
  onResend?: () => Promise<void> | void;
}

export function ResetPasswordSuccessModal({
  visible,
  email,
  onClose,
  onReturnToSignIn,
  onResend,
}: ResetPasswordSuccessModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const translateYAnim = useRef(new Animated.Value(24)).current;

  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (visible) {
      setCooldown(30); // 30s resend cooldown on first open
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7.5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 7.5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 16,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleReturnToSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onReturnToSignIn();
  };

  const handleOpenMailApp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      if (Platform.OS === 'ios') {
        const canOpen = await Linking.canOpenURL('message:');
        if (canOpen) {
          await Linking.openURL('message:');
          return;
        }
      }
      await Linking.openURL('mailto:');
    } catch {
      // Graceful fallback
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !onResend) return;
    try {
      setResending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await onResend();
      setCooldown(45);
    } finally {
      setResending(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop Scrim */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
            },
          ]}
        >
          {/* Top Brand Accent Bar */}
          <View style={styles.topAccentBar} />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#94A3B8" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Concentric Halo Hero Icon */}
          <View style={styles.iconHaloOuter}>
            <View style={styles.iconHaloMid}>
              <View style={styles.iconBadge}>
                <Mail size={28} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>
            {/* Green Check Sub-badge */}
            <View style={styles.checkSubBadge}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Check Your Email</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            We've sent password reset instructions and a verification link to:
          </Text>

          {/* User Email Pill Chip */}
          <View style={styles.emailChip}>
            <Mail size={14} color="#FA7E2B" strokeWidth={2.4} />
            <Text style={styles.emailChipText} numberOfLines={1} ellipsizeMode="middle">
              {email || 'your email'}
            </Text>
          </View>

          {/* Explanatory Body */}
          <Text style={styles.helperText}>
            Click the link in the email to set a new password. If you don't see it shortly, please check your spam or junk folder.
          </Text>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleReturnToSignIn}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Return to Sign In</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>

          {/* Secondary Quick Action: Open Email App */}
          <TouchableOpacity
            style={styles.openMailBtn}
            onPress={handleOpenMailApp}
            activeOpacity={0.75}
          >
            <ExternalLink size={16} color="#0F172A" strokeWidth={2.2} />
            <Text style={styles.openMailBtnText}>Open Email App</Text>
          </TouchableOpacity>

          {/* Resend Link Row */}
          {onResend && (
            <View style={styles.resendRow}>
              <Text style={styles.resendHint}>Didn't receive the email? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0 || resending}
                activeOpacity={0.7}
                style={styles.resendBtn}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#FA7E2B" />
                ) : (
                  <View style={styles.resendInner}>
                    {cooldown === 0 && <RefreshCw size={12} color="#FA7E2B" strokeWidth={2.5} />}
                    <Text
                      style={[
                        styles.resendBtnText,
                        cooldown > 0 && styles.resendBtnTextDisabled,
                      ]}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Link'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 36, 400),
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#FA7E2B',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Concentric Hero Badge
  iconHaloOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(250, 126, 43, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 18,
    position: 'relative',
  },
  iconHaloMid: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(250, 126, 43, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  checkSubBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },

  // Typography
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 12,
    maxWidth: '100%',
  },
  emailChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  helperText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 22,
  },

  // Action Buttons
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#FA7E2B',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  openMailBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  openMailBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  resendHint: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  resendBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  resendInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  resendBtnTextDisabled: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
