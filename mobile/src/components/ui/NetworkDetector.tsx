import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radio, AlertCircle, RefreshCw, X, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNetwork } from '../../context/NetworkContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function NetworkDetector() {
  const insets = useSafeAreaInsets();
  const { isOffline, checkConnection, connectionType } = useNetwork();

  // Animation values
  const slideAnim = useRef(new Animated.Value(-160)).current;
  const [checking, setChecking] = useState(false);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  // Track state transitions (offline -> online)
  const wasOfflineRef = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    if (isOffline) {
      // 1. Just went OFFLINE
      wasOfflineRef.current = true;
      setShowReconnected(false);
      setManuallyDismissed(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else if (wasOfflineRef.current) {
      // 2. Just came BACK ONLINE after being offline
      wasOfflineRef.current = false;
      setShowReconnected(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();

      // Automatically glide up and dismiss after 2.6 seconds
      dismissTimerRef.current = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -160,
          duration: 260,
          useNativeDriver: true,
        }).start(() => {
          setShowReconnected(false);
        });
      }, 2600);
    } else {
      // App started while online or stayed online: keep off-screen
      Animated.timing(slideAnim, {
        toValue: -160,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isOffline, slideAnim]);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await checkConnection();
    } finally {
      setChecking(false);
    }
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setManuallyDismissed(true);
    Animated.timing(slideAnim, {
      toValue: -160,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // If dismissed manually and still offline, don't re-render
  if (manuallyDismissed && !showReconnected) {
    return null;
  }

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 14 : 10);

  return (
    <View style={[styles.outerContainer, { top: topInset }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.bannerCard,
          showReconnected ? styles.bannerOnline : styles.bannerOffline,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Left Status Icon with Circular Pulse Glow */}
        <View
          style={[
            styles.iconBadge,
            showReconnected ? styles.iconBadgeOnline : styles.iconBadgeOffline,
          ]}
        >
          {showReconnected ? (
            <CheckCircle2 size={18} color="#10B981" strokeWidth={2.6} />
          ) : (
            <AlertCircle size={18} color="#EF4444" strokeWidth={2.6} />
          )}
        </View>

        {/* Text Details */}
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>
              {showReconnected ? 'Back Online' : 'No Internet Connection'}
            </Text>
            {!showReconnected && (
              <View style={styles.livePulseDot} />
            )}
          </View>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {showReconnected
              ? 'Live synchronization restored'
              : `Running in cached mode${connectionType && connectionType !== 'none' ? ` (${connectionType})` : ''}`}
          </Text>
        </View>

        {/* Action Controls */}
        <View style={styles.actionRow}>
          {!showReconnected && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={handleRetry}
              activeOpacity={0.75}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={13} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={15} color="#94A3B8" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999999,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  bannerCard: {
    width: Math.min(SCREEN_WIDTH - 24, 460),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#0F172A', // Deep modern dark slate
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  bannerOffline: {
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  bannerOnline: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  iconBadgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  iconBadgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
