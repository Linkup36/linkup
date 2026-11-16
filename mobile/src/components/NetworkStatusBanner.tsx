import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wifi, WifiOff, X } from 'lucide-react-native';
import { useNetwork } from '../context/NetworkContext';

export function NetworkStatusBanner() {
  const { isOnline, wasOffline, isChecking, checkConnection } = useNetwork();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [dismissed, setDismissed] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowBackOnline(false);
    } else if (wasOffline && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setDismissed(false);
      setShowBackOnline(true);
      queryClient.invalidateQueries();

      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, queryClient]);

  const isVisible = !isOnline || showBackOnline;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-24);
      opacityAnim.setValue(0);
    }
  }, [isVisible, dismissed, showBackOnline, slideAnim, opacityAnim]);

  if (!isVisible) {
    return null;
  }

  const topOffset = Math.max(insets.top, Platform.OS === 'android' ? 12 : 8) + 6;

  // Minimized pill when user dismisses the offline banner
  if (!isOnline && dismissed) {
    return (
      <View pointerEvents="box-none" style={[styles.overlay, { top: topOffset }]}>
        <Animated.View
          style={{
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setDismissed(false)}
            style={styles.pill}
          >
            <WifiOff size={14} color="#B45309" />
            <Text style={styles.pillText}>Offline Mode</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: topOffset }]}>
      <Animated.View
        style={[
          styles.banner,
          isOnline ? styles.bannerOnline : styles.bannerOffline,
          {
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.contentRow}>
          <View
            style={[
              styles.iconWrap,
              isOnline ? styles.iconWrapOnline : styles.iconWrapOffline,
            ]}
          >
            {isOnline ? (
              <Wifi size={16} color="#059669" />
            ) : (
              <WifiOff size={16} color="#D97706" />
            )}
          </View>

          <View style={styles.textWrap}>
            {isOnline ? (
              <Text style={styles.onlineTitle}>
                Back Online! <Text style={styles.onlineSub}>Connection restored.</Text>
              </Text>
            ) : (
              <>
                <Text style={styles.offlineTitle}>You&apos;re offline</Text>
                <Text style={styles.offlineSub} numberOfLines={2}>
                  Check your internet connection. Some features may be limited.
                </Text>
              </>
            )}
          </View>
        </View>

        {!isOnline && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isChecking}
              onPress={() => {
                checkConnection();
              }}
              style={[styles.retryButton, isChecking && styles.retryButtonDisabled]}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#92400E" />
              ) : (
                <RefreshCw size={12} color="#92400E" />
              )}
              <Text style={styles.retryText}>{isChecking ? 'Checking' : 'Retry'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setDismissed(true)}
              style={styles.dismissButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#B45309" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  banner: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerOffline: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  bannerOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOffline: {
    backgroundColor: '#FEF3C7',
  },
  iconWrapOnline: {
    backgroundColor: '#D1FAE5',
  },
  textWrap: {
    flex: 1,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  offlineSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 1,
  },
  onlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  onlineSub: {
    fontWeight: '500',
    color: '#047857',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  retryButtonDisabled: {
    opacity: 0.65,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  dismissButton: {
    padding: 4,
    borderRadius: 8,
  },
});

