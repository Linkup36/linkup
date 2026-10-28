import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Truck, ArrowRight, AlertTriangle, X, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CrossZoneItemDetail {
  id: string;
  title: string;
  sellerId: string;
  sellerZoneName: string;
  destinationZoneName: string;
  price: number;
}

export interface CrossZoneWarningProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  crossZoneFee?: number;
  perDispatchFee?: number;
  sellerCount?: number;
  shippingZoneName?: string;
  crossZoneItems?: CrossZoneItemDetail[];
  accentColor?: string;
}

export function CrossZoneWarning({
  open,
  onClose,
  onConfirm,
  crossZoneFee = 1000,
  perDispatchFee = 1000,
  sellerCount = 1,
  shippingZoneName = 'Your Zone',
  crossZoneItems = [],
  accentColor = '#E86129',
}: CrossZoneWarningProps) {
  // Framer-Motion style spring values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const translateYAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (open) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={handleClose}
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
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Modal Card with spring entrance */}
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
          {/* Top Decorative Accent Bar */}
          <View style={[styles.topBar, { backgroundColor: accentColor }]} />

          {/* Close X Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#94a3b8" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Emblem Icon Badge */}
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
              <Truck size={30} color="#ffffff" strokeWidth={2.4} />
            </View>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Cross-Zone Delivery Fee</Text>
          <Text style={styles.subtitle}>
            Verified Database Logistics Surcharge
          </Text>

          {/* Fee Callout Box */}
          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>ADDITIONAL INTER-ZONE SURCHARGE</Text>
            <Text style={[styles.feeAmount, { color: accentColor }]}>
              +₦{crossZoneFee.toLocaleString('en-NG')}
            </Text>
            <Text style={styles.feeBreakdown}>
              ₦{perDispatchFee.toLocaleString('en-NG')} × {sellerCount} cross-zone {sellerCount === 1 ? 'merchant dispatch' : 'merchant dispatches'}
            </Text>
          </View>

          {/* Cross-Zone Items List */}
          {crossZoneItems.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.itemsHeader}>AFFECTED ITEMS & FULFILLMENT ROUTES</Text>
              <ScrollView
                style={styles.itemsScroll}
                showsVerticalScrollIndicator={false}
              >
                {crossZoneItems.map((item, index) => (
                  <View key={item.id || index} style={styles.itemRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.routePill}>
                      <Text style={styles.routeOrigin}>{item.sellerZoneName}</Text>
                      <ArrowRight size={11} color="#64748b" style={{ marginHorizontal: 3 }} />
                      <Text style={[styles.routeDest, { color: accentColor }]}>
                        {item.destinationZoneName}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Explanatory Notice */}
          <View style={styles.noticeBox}>
            <AlertTriangle size={16} color={accentColor} style={{ marginTop: 1 }} />
            <Text style={styles.noticeText}>
              Sellers for these items are located in a different zone from your drop-off zone ({shippingZoneName}). This fee covers dedicated direct transit across zones.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonCol}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
              ]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                Accept & Proceed to Payment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>
                Change Zone / Review Cart
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
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 40, 380),
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 14,
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
    zIndex: 10,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconGlow: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
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
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 3,
    fontWeight: '600',
    marginBottom: 16,
  },
  feeBox: {
    width: '100%',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  feeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9a3412',
    letterSpacing: 0.8,
  },
  feeAmount: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  feeBreakdown: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c2d12',
  },
  itemsSection: {
    width: '100%',
    marginBottom: 14,
  },
  itemsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  itemsScroll: {
    maxHeight: 120,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginRight: 8,
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  routeOrigin: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  routeDest: {
    fontSize: 10,
    fontWeight: '800',
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
    width: '100%',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '500',
  },
  buttonCol: {
    width: '100%',
    gap: 10,
  },
  confirmBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
});
