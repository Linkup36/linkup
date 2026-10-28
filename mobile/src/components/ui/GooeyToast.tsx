import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

// Global listener pattern for imperative toast calls anywhere in mobile app
type ToastListener = (toast: ToastItem) => void;
type DismissListener = (id?: string) => void;

let addToastListener: ToastListener | null = null;
let dismissToastListener: DismissListener | null = null;

const normalizeToastOptions = (options?: ToastOptions | string): ToastOptions | undefined =>
  typeof options === 'string' ? { description: options } : options;

export const toast = {
  success: (title: string, options?: ToastOptions | string) => {
    const opts = normalizeToastOptions(options);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    addToastListener?.({
      id: Math.random().toString(),
      type: 'success',
      title,
      description: opts?.description,
      duration: opts?.duration || 3200,
      action: opts?.action,
    });
  },
  error: (title: string, options?: ToastOptions | string) => {
    const opts = normalizeToastOptions(options);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
    addToastListener?.({
      id: Math.random().toString(),
      type: 'error',
      title,
      description: opts?.description,
      duration: opts?.duration || 4000,
      action: opts?.action,
    });
  },
  warning: (title: string, options?: ToastOptions | string) => {
    const opts = normalizeToastOptions(options);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
    addToastListener?.({
      id: Math.random().toString(),
      type: 'warning',
      title,
      description: opts?.description,
      duration: opts?.duration || 3500,
      action: opts?.action,
    });
  },
  info: (title: string, options?: ToastOptions | string) => {
    const opts = normalizeToastOptions(options);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    addToastListener?.({
      id: Math.random().toString(),
      type: 'info',
      title,
      description: opts?.description,
      duration: opts?.duration || 3000,
      action: opts?.action,
    });
  },
  dismiss: (id?: string) => {
    dismissToastListener?.(id);
  },
};

export const gooeyToast = toast;

export function GooeyToaster() {
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);

  // Animated values for signature gooey spring morph & squish
  const translateY = useRef(new Animated.Value(-120)).current;
  const scaleX = useRef(new Animated.Value(0.75)).current;
  const scaleY = useRef(new Animated.Value(0.75)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;

  const timerRef = useRef<any>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Spring exit with upward morph
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scaleY, {
        toValue: 0.8,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentToast(null);
    });
  }, [opacity, translateY, scaleY]);

  const show = useCallback(
    (item: ToastItem) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setCurrentToast(item);

      // Reset values
      translateY.setValue(-80);
      scaleX.setValue(0.8);
      scaleY.setValue(1.2);
      opacity.setValue(0);
      progress.setValue(1);

      // Gooey landing: squish on arrival then spring bounce to (1, 1)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.sequence([
          // 1. Initial squish on impact
          Animated.timing(scaleX, {
            toValue: 1.08,
            duration: 160,
            useNativeDriver: true,
          }),
          // 2. Spring back to natural pill
          Animated.spring(scaleX, {
            toValue: 1,
            tension: 70,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: 0.92,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            tension: 70,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
        // Countdown progress bar
        Animated.timing(progress, {
          toValue: 0,
          duration: item.duration,
          useNativeDriver: false,
        }),
      ]).start();

      // Auto dismiss after duration
      timerRef.current = setTimeout(() => {
        dismiss();
      }, item.duration);
    },
    [dismiss, opacity, scaleX, scaleY, translateY, progress]
  );

  useEffect(() => {
    addToastListener = (item) => show(item);
    dismissToastListener = () => dismiss();
    return () => {
      addToastListener = null;
      dismissToastListener = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, dismiss]);

  if (!currentToast) return null;

  const getIcon = () => {
    switch (currentToast.type) {
      case 'success':
        return <CheckCircle2 size={19} color="#10b981" strokeWidth={2.5} />;
      case 'error':
        return <AlertCircle size={19} color="#ef4444" strokeWidth={2.5} />;
      case 'warning':
        return <AlertTriangle size={19} color="#f59e0b" strokeWidth={2.5} />;
      default:
        return <Info size={19} color={colors.primary} strokeWidth={2.5} />;
    }
  };

  const getBadgeColor = () => {
    switch (currentToast.type) {
      case 'success':
        return '#f0fdf4';
      case 'error':
        return '#fef2f2';
      case 'warning':
        return '#fffbeb';
      default:
        return '#FFF7ED';
    }
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          opacity,
          transform: [
            { translateY },
            { scaleX },
            { scaleY },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={dismiss}
      >
        <View style={styles.contentRow}>
          {/* Status Icon in Soft Circle */}
          <View style={[styles.iconWrap, { backgroundColor: getBadgeColor() }]}>
            {getIcon()}
          </View>

          {/* Text Content */}
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {currentToast.title}
            </Text>
            {currentToast.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {currentToast.description}
              </Text>
            ) : null}
          </View>

          {/* Optional Action or Close Button */}
          {currentToast.action ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                currentToast.action?.onPress();
                dismiss();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnText}>{currentToast.action.label}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={15} color="#94a3b8" strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>

        {/* Subtle Countdown Progress Line */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
                backgroundColor:
                  currentToast.type === 'success'
                    ? '#10b981'
                    : currentToast.type === 'error'
                      ? '#ef4444'
                      : colors.primary,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 18,
    right: 18,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  actionBtn: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 2.5,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
