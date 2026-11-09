import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { AppModal, toast } from '../../../components/ui';
import * as Haptics from 'expo-haptics';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Tag,
  Check,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';

export function CartScreen() {
  const { items, updateQuantity, removeFromCart, clearCart, subtotal, totalCount } = useCart();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [couponCode, setCouponCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [applyingPromo, setApplyingPromo] = useState(false);

  const formatPrice = (val: number) => '₦' + Math.max(0, val).toLocaleString('en-NG');

  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Empty Code', 'Please enter a valid coupon or promoter referral code.');
      return;
    }

    setApplyingPromo(true);
    try {
      // 1. Check promoter codes
      const { data: pCode } = await supabase
        .from('promoter_codes')
        .select('code, user_id')
        .eq('code', trimmed)
        .maybeSingle();

      if (pCode) {
        setAppliedPromo(pCode.code);
        // 5% discount for referral
        const discount = Math.round(subtotal * 0.05);
        setDiscountAmount(discount);
        Alert.alert('Promo Applied!', `Promoter code "${pCode.code}" applied. 5% discount added!`);
        return;
      }

      // 2. Special free delivery or test vouchers
      if (trimmed === 'LINKUP10' || trimmed === 'WELCOME10') {
        setAppliedPromo(trimmed);
        const discount = Math.round(subtotal * 0.10);
        setDiscountAmount(discount);
        Alert.alert('Promo Applied!', `10% discount voucher "${trimmed}" applied successfully.`);
        return;
      }

      if (trimmed === 'FREEDELIVERY' || trimmed === 'FREE') {
        setAppliedPromo('FREEDELIVERY');
        Alert.alert('Promo Applied!', 'Free Delivery perk registered for checkout!');
        return;
      }

      Alert.alert('Invalid Code', 'The coupon or promoter code entered is invalid or expired.');
    } catch {
      Alert.alert('Error', 'Could not verify coupon code right now. Please try again.');
    } finally {
      setApplyingPromo(false);
    }
  };

  const [showClearModal, setShowClearModal] = useState(false);

  const handleClearCart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowClearModal(true);
  };

  const confirmClearCart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearCart();
    setShowClearModal(false);
    toast.success('Cart Cleared', {
      description: 'All items have been removed from your cart.',
    });
  };

  const finalTotal = Math.max(0, subtotal - discountAmount);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Cart</Text>
          <Text style={styles.itemCount}>
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Cart</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={56} color="#4f46e5" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Explore thousands of products with verified buyer protection and instant delivery.
          </Text>
          <Button
            title="Browse Marketplace"
            onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
            style={{ marginTop: 24, paddingHorizontal: 32 }}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.productId}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.trustBanner}>
                <ShieldCheck size={18} color="#16a34a" />
                <Text style={styles.trustBannerText}>
                  Linkup Escrow Protection active. Funds held securely until delivery.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.cartCard}>
                <Image
                  source={{
                    uri: item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
                  }}
                  style={styles.thumbnail}
                />
                <View style={styles.info}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>

                  <View style={styles.controlsRow}>
                    <View style={styles.qtyContainer}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                        style={styles.qtyBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Minus size={14} color="#475569" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                        style={styles.qtyBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Plus size={14} color="#475569" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeFromCart(item.productId)}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.promoSection}>
                <Text style={styles.promoHeader}>Promoter Code or Coupon</Text>
                <View style={styles.promoRow}>
                  <View style={styles.inputWrap}>
                    <Tag size={16} color="#94a3b8" style={{ marginLeft: 12 }} />
                    <TextInput
                      style={styles.promoInput}
                      placeholder="e.g. LINKUP10 or PROMO"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      value={couponCode}
                      onChangeText={setCouponCode}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={handleApplyCoupon}
                    disabled={applyingPromo}
                  >
                    {applyingPromo ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.applyBtnText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {appliedPromo && (
                  <View style={styles.appliedBadge}>
                    <Sparkles size={14} color="#16a34a" />
                    <Text style={styles.appliedBadgeText}>
                      Applied promo: <Text style={{ fontWeight: '800' }}>{appliedPromo}</Text>
                      {discountAmount > 0 ? ` (-${formatPrice(discountAmount)})` : ''}
                    </Text>
                  </View>
                )}
              </View>
            }
          />

          {/* Sticky Checkout Footer */}
          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </View>

            {discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>Discount</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                  -{formatPrice(discountAmount)}
                </Text>
              </View>
            )}

            <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
              <Text style={[styles.summaryLabel, { fontSize: 16, fontWeight: '800', color: '#0f172a' }]}>
                Estimated Total
              </Text>
              <Text style={[styles.summaryValue, { fontSize: 18, fontWeight: '900', color: colors.primary }]}>
                {formatPrice(finalTotal)}
              </Text>
            </View>

            <Button
              title="Proceed to Checkout"
              onPress={() => {
                if (!user) {
                  navigation.navigate('Login');
                } else {
                  navigation.navigate('Checkout', {});
                }
              }}
              style={{ marginTop: 14 }}
            />
          </View>
        </>
      )}

      {/* Modern Confirmation Modal for Clearing Cart */}
      <AppModal
        visible={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Cart"
        subtitle="Are you sure you want to remove all items from your cart? This action cannot be undone."
        variant="danger"
        primaryButton={{
          label: 'Clear All Items',
          variant: 'danger',
          onPress: confirmClearCart,
        }}
        secondaryButton={{
          label: 'Cancel',
          variant: 'outline',
          onPress: () => setShowClearModal(false),
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemCount: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  trustBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 12,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  info: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4f46e5',
    marginVertical: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyBtn: {
    padding: 6,
    paddingHorizontal: 8,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 8,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  promoSection: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  promoHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  promoInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  appliedBadgeText: {
    fontSize: 12,
    color: '#166534',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
});
