import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { AppModal } from '../../../components/ui/AppModal';
import { colors } from '../../../theme/colors';
import { ShieldCheck, MapPin, Store } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { toast } from '../../../components/ui/GooeyToast';

interface BuyNowModalProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout?: (orderPayload: any) => void;
}

export function BuyNowModal({
  product,
  isOpen,
  onClose,
  onProceedToCheckout,
}: BuyNowModalProps) {
  const { user, profile } = useAuth();
  const navigation = useNavigation<any>();
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product?.sizes?.[0] || null
  );

  const { data: feeConfigs = [] } = useQuery({
    queryKey: ['fee-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_config')
        .select('*')
        .eq('is_active', true);
      return data || [];
    },
    enabled: isOpen,
  });

  const riderFeeConfig = feeConfigs.find((f: any) => f.fee_type === 'rider');
  const dynamicDefaultFee = riderFeeConfig?.flat_fee ?? 1500;

  if (!product) return null;

  const finalPrice = product.price || 0;
  const deliveryFee = dynamicDefaultFee;
  const total = finalPrice + deliveryFee;
  const sellerName = product.seller?.display_name || product.seller?.full_name || 'Verified Merchant';
  const deliveryAddress = (profile as any)?.address || 'No address saved — please set in checkout';

  const handleProceed = () => {
    if (!user) {
      toast.info('Please sign in to proceed with your order');
      onClose();
      navigation.navigate('Login');
      return;
    }

    onClose();
    if (onProceedToCheckout) {
      onProceedToCheckout({
        directBuy: true,
        productId: product.id,
        quantity: 1,
        size: selectedSize,
      });
    } else {
      navigation.navigate('Checkout', {
        directBuy: true,
        productId: product.id,
        quantity: 1,
      });
    }
  };

  return (
    <AppModal
      visible={isOpen}
      onClose={onClose}
      title="Instant Escrow Buy"
      subtitle="Complete your order with verified buyer protection"
      primaryButton={{
        label: `Pay ₦${total.toLocaleString('en-NG')}`,
        onPress: handleProceed,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: onClose,
        variant: 'outline',
      }}
    >
      <View style={styles.container}>
        {/* Product Brief */}
        <View style={styles.productRow}>
          <Image
            source={{
              uri:
                product.images?.[0] ||
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150',
            }}
            style={styles.thumb}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {product.title}
            </Text>
            <View style={styles.storeRow}>
              <Store size={12} color="#64748b" />
              <Text style={styles.storeName}>{sellerName}</Text>
            </View>
            <Text style={styles.price}>
              ₦{finalPrice.toLocaleString('en-NG')}
            </Text>
          </View>
        </View>

        {/* Sizes if available */}
        {product.sizes && product.sizes.length > 0 && (
          <View style={styles.sizesSection}>
            <Text style={styles.sectionLabel}>Select Size</Text>
            <View style={styles.sizesRow}>
              {product.sizes.map((s: string) => {
                const isSelected = selectedSize === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sizePill, isSelected && styles.sizePillActive]}
                    onPress={() => setSelectedSize(s)}
                  >
                    <Text
                      style={[
                        styles.sizeText,
                        isSelected && styles.sizeTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Delivery Address Brief */}
        <View style={styles.addressBox}>
          <MapPin size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Destination</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {deliveryAddress}
            </Text>
          </View>
        </View>

        {/* Summary Breakdown */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Item Price</Text>
            <Text style={styles.summaryVal}>
              ₦{finalPrice.toLocaleString('en-NG')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Dispatch</Text>
            <Text style={styles.summaryVal}>
              ₦{deliveryFee.toLocaleString('en-NG')}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalVal}>₦{total.toLocaleString('en-NG')}</Text>
          </View>
        </View>

        {/* Escrow Badge */}
        <View style={styles.escrowPill}>
          <ShieldCheck size={16} color="#16a34a" />
          <Text style={styles.escrowText}>
            100% Escrow Protected: Funds held until you inspect the item.
          </Text>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  storeName: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  price: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 4,
  },
  sizesSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sizePillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  sizeTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  addressLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  addressText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  summaryBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  escrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  escrowText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '700',
    flex: 1,
  },
});
