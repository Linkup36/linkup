import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../theme/colors';

interface MobileActionFooterProps {
  finalPrice: number;
  markupRate?: number;
  onBuyNow: () => void;
}

export function MobileActionFooter({
  finalPrice,
  markupRate = 0.10,
  onBuyNow,
}: MobileActionFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.priceCol}>
        <Text style={styles.feeLabel}>
          TOTAL DUE (+{Math.round(markupRate * 100)}% FEE)
        </Text>
        <Text style={styles.priceValue}>
          ₦{Math.round(finalPrice).toLocaleString('en-NG')}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.buyNowBtn}
        onPress={onBuyNow}
        activeOpacity={0.85}
      >
        <Text style={styles.buyNowText}>BUY NOW</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 90,
  },
  priceCol: {
    flexDirection: 'column',
  },
  feeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.8,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  buyNowBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyNowText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
