import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  CreditCard,
  ShieldCheck,
  Truck,
  ChevronLeft,
  ShoppingBag,
  Lock,
  MapPin,
  Check,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface PaymentStepProps {
  items: any[];
  baseProductTotal: number;
  platformFee: number;
  deliveryFee: number;
  rawDeliveryFee?: number;
  crossZoneFee?: number;
  rawCrossZoneFee?: number;
  isFreeDelivery?: boolean;
  grandTotal: number;
  sellerCount?: number;
  onBack: () => void;
  onPay: () => void;
  isPending: boolean;
}

export function PaymentStep({
  items,
  baseProductTotal,
  platformFee,
  deliveryFee,
  rawDeliveryFee,
  crossZoneFee = 0,
  rawCrossZoneFee,
  isFreeDelivery = false,
  grandTotal,
  sellerCount = 1,
  onBack,
  onPay,
  isPending,
}: PaymentStepProps) {
  const handlePayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPay();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        {/* Top Back & Badge Row */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color="#475569" />
            <Text style={styles.backBtnText}>Back to Delivery</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>STEP 2 OF 2</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <CreditCard size={22} color={colors.primary} />
            <Text style={styles.title}>Secure Payment</Text>
          </View>
          <Text style={styles.subtitle}>Review your order and pay securely</Text>
        </View>

        {/* Items Brief */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <ShoppingBag size={14} color="#64748b" />
            <Text style={styles.sectionLabel}>
              REVIEW ITEMS ({items.reduce((s, i) => s + (i.quantity || 1), 0)})
            </Text>
          </View>

          <View style={styles.itemsBox}>
            {items.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  idx < items.length - 1 && styles.itemBorderBottom,
                ]}
              >
                <Image
                  source={{
                    uri:
                      item.image ||
                      item.images?.[0] ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100',
                  }}
                  style={styles.itemThumb}
                />
                <View style={styles.itemMeta}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.itemTagsRow}>
                    <Text style={styles.itemQty}>Qty: {item.quantity || 1}</Text>
                    {item.size ? (
                      <View style={styles.sizeBadge}>
                        <Text style={styles.sizeBadgeText}>Size: {item.size}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.itemPrice}>
                  ₦{Math.round((item.price || 0) * (item.quantity || 1)).toLocaleString('en-NG')}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Direct Payment Card */}
        <View style={styles.paystackCard}>
          <View style={styles.paystackRow}>
            <View style={styles.paystackIconWrap}>
              <CreditCard size={24} color="#09a5db" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paystackTitle}>Direct Payment</Text>
              <Text style={styles.paystackSub}>Secured by Linkup Escrow</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
          </View>

          <View style={styles.protectionRow}>
            <View style={styles.cardLogos}>
              <View style={styles.miniCard} />
              <View style={styles.miniCard} />
              <View style={styles.miniCard} />
            </View>
            <View style={styles.lockRow}>
              <Lock size={12} color="#09a5db" />
              <Text style={styles.lockText}>PROTECTED</Text>
            </View>
          </View>
        </View>

        {/* Escrow Guarantee Notice */}
        <View style={styles.escrowNotice}>
          <ShieldCheck size={18} color="#d97706" style={{ marginTop: 1 }} />
          <Text style={styles.escrowText}>
            <Text style={{ fontWeight: '800', color: '#92400e' }}>Secure Holding: </Text>
            Your payment is held safely and only released to sellers after you confirm you've received your items.
          </Text>
        </View>

        {/* Multi-Seller Notification */}
        {sellerCount > 1 && (
          <View style={styles.multiSellerNotice}>
            <View style={styles.multiSellerTitleRow}>
              <Truck size={14} color="#2563eb" />
              <Text style={styles.multiSellerTitle}>Different Deliveries</Text>
            </View>
            <Text style={styles.multiSellerText}>
              You are buying from {sellerCount} different sellers. Since each seller ships separately, multiple dispatch fees are included.
            </Text>
          </View>
        )}

        {/* Totals Breakdown */}
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Order Subtotal</Text>
            <Text style={styles.breakdownVal}>
              ₦{Math.round(baseProductTotal + platformFee).toLocaleString('en-NG')}
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Truck size={14} color="#3b82f6" />
              <Text style={styles.breakdownLabel}>
                Delivery {sellerCount > 1 ? `(${sellerCount} Packages)` : ''}
              </Text>
            </View>
            {deliveryFee === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.strikeFee}>
                  ₦{(rawDeliveryFee || 1500).toLocaleString('en-NG')}
                </Text>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>FREE PROMO</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.breakdownVal}>
                ₦{Math.round(deliveryFee).toLocaleString('en-NG')}
              </Text>
            )}
          </View>

          {(rawCrossZoneFee !== undefined ? rawCrossZoneFee > 0 : crossZoneFee > 0) && (
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.breakdownLabel}>Cross-Zone Surcharge</Text>
              </View>
              {crossZoneFee === 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.strikeFee}>
                    ₦{(rawCrossZoneFee || 0).toLocaleString('en-NG')}
                  </Text>
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>WAIVED</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.breakdownVal}>
                  ₦{Math.round(crossZoneFee).toLocaleString('en-NG')}
                </Text>
              )}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalSubLabel}>TOTAL TO PAY</Text>
              <Text style={styles.totalAmount}>
                ₦{Math.round(grandTotal).toLocaleString('en-NG')}
              </Text>
            </View>
            <View style={styles.authenticatedRow}>
              <Text style={styles.authenticatedText}>Authenticated</Text>
              <Lock size={12} color={colors.primary} />
            </View>
          </View>
        </View>

        {/* Pay Now Button */}
        <TouchableOpacity
          style={[styles.payNowBtn, isPending && styles.payNowBtnDisabled]}
          onPress={handlePayPress}
          disabled={isPending}
          activeOpacity={0.85}
        >
          {isPending ? (
            <View style={styles.btnLoadingRow}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.payNowBtnText}>Securing Payment...</Text>
            </View>
          ) : (
            <Text style={styles.payNowBtnText}>
              Pay Now — ₦{Math.round(grandTotal).toLocaleString('en-NG')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Footer disclaimer */}
        <Text style={styles.termsNote}>
          By completing payment, you agree to Linkup's escrow terms of service and buyer protection policy.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  header: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  itemMeta: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  itemQty: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  sizeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sizeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  paystackCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(9, 165, 219, 0.25)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#09a5db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  paystackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paystackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(9, 165, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paystackTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  paystackSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(9, 165, 219, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#09a5db',
    letterSpacing: 0.5,
  },
  protectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardLogos: {
    flexDirection: 'row',
    gap: 4,
  },
  miniCard: {
    width: 26,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#09a5db',
    letterSpacing: 0.5,
  },
  escrowNotice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  escrowText: {
    flex: 1,
    fontSize: 11,
    color: '#78350f',
    lineHeight: 16,
    fontWeight: '500',
  },
  multiSellerNotice: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  multiSellerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  multiSellerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },
  multiSellerText: {
    fontSize: 11,
    color: '#1e40af',
    lineHeight: 16,
    fontWeight: '500',
  },
  breakdownSection: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  strikeFee: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  promoBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803d',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  totalSubLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  authenticatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  authenticatedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    fontStyle: 'italic',
  },
  payNowBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  payNowBtnDisabled: {
    opacity: 0.7,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payNowBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  termsNote: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
  },
});
