import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  X,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AlertModalType = 'error' | 'success' | 'warning' | 'info' | 'location';

export interface CustomAlertModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: AlertModalType;
  primaryButtonText?: string;
  onPrimaryPress?: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  accentColor?: string; // defaults to #E86129
}

export function CustomAlertModal({
  visible,
  onClose,
  title,
  message,
  type = 'error',
  primaryButtonText = 'Got It',
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  accentColor = '#E86129',
}: CustomAlertModalProps) {
  // Framer-Motion style spring values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      // Trigger subtle haptics on entrance
      if (type === 'error' || type === 'warning' || type === 'location') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      // Smooth Framer Motion entrance spring
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 15,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, type]);

  const handlePrimaryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPrimaryPress) {
      onPrimaryPress();
    } else {
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onSecondaryPress) {
      onSecondaryPress();
    } else {
      onClose();
    }
  };

  // Render appropriate badge icon based on type
  const renderIcon = () => {
    switch (type) {
      case 'location':
        return <MapPin size={28} color="#ffffff" strokeWidth={2.4} />;
      case 'success':
        return <CheckCircle2 size={28} color="#ffffff" strokeWidth={2.4} />;
      case 'warning':
        return <AlertTriangle size={28} color="#ffffff" strokeWidth={2.4} />;
      case 'info':
        return <Info size={28} color="#ffffff" strokeWidth={2.4} />;
      case 'error':
      default:
        return <AlertCircle size={28} color="#ffffff" strokeWidth={2.4} />;
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
        {/* Backdrop overlay */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Modal Card with Framer-motion entrance */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: translateYAnim },
              ],
            },
          ]}
        >
          {/* Top Subtle Gradient Accent Line */}
          <View style={[styles.topBar, { backgroundColor: accentColor }]} />

          {/* Close X Button in top corner */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={18} color="#94a3b8" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Glowing Emblem Icon Badge */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconGlow,
                { backgroundColor: `${accentColor}18` },
              ]}
            />
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
              ]}
            >
              {renderIcon()}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Description Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {secondaryButtonText ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleSecondaryPress}
                activeOpacity={0.75}
              >
                <Text style={styles.secondaryBtnText}>
                  {secondaryButtonText}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
                !secondaryButtonText && styles.primaryBtnFull,
              ]}
              onPress={handlePrimaryPress}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {primaryButtonText}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconGlow: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
    paddingHorizontal: 4,
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnFull: {
    width: '100%',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
