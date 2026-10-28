import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ShieldCheck,
  ShoppingBag,
  Home,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { Receipt } from '../Receipt';
import * as Haptics from 'expo-haptics';

interface SuccessStepProps {
  orderSummary?: {
    items: any[];
    total: number;
    orderNumber: string;
    orderIds?: string[];
    date?: string;
  } | null;
  orderId?: string;
  onViewOrders: () => void;
  onContinueShopping: () => void;
}

export function SuccessStep({
  orderSummary,
  orderId,
  onViewOrders,
  onContinueShopping,
}: SuccessStepProps) {
  const displayOrderNumber =
    orderSummary?.orderNumber ||
    (orderId ? `#ORD-${orderId.slice(0, 8).toUpperCase()}` : '#ORD-CONFIRMED');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        {/* Celebration Shield Emblem */}
        <View style={styles.emblemWrapper}>
          <View style={styles.emblemCircle}>
            <CheckCircle2 size={52} color="#16a34a" strokeWidth={2.4} />
          </View>
          <View style={styles.shieldBadge}>
            <ShieldCheck size={18} color="#ffffff" strokeWidth={3} />
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.title}>Payment Received!</Text>
        <Text style={styles.subtitle}>
          Order <Text style={styles.orderNumberHighlight}>{displayOrderNumber}</Text> is now being held safely in escrow.
        </Text>

        {/* Embedded Receipt Component */}
        {orderSummary ? (
          <View style={styles.receiptSection}>
            <Receipt
              orderNumber={orderSummary.orderNumber}
              date={orderSummary.date || new Date().toLocaleString()}
              items={orderSummary.items.map((i: any) => ({
                title: i.title || 'Product',
                quantity: i.quantity || 1,
                price: i.price || 0,
                size: i.size,
              }))}
              total={orderSummary.total}
            />
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.manageOrdersBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onViewOrders();
            }}
            activeOpacity={0.85}
          >
            <ShoppingBag size={20} color="#ffffff" />
            <Text style={styles.manageOrdersText}>Manage My Orders</Text>
            <ArrowRight size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onContinueShopping();
            }}
            activeOpacity={0.7}
          >
            <Home size={18} color="#64748b" />
            <Text style={styles.homeBtnText}>Return to Home</Text>
          </TouchableOpacity>
        </View>

        {/* Escrow release notice */}
        <Text style={styles.guaranteeNote}>
          Your payment will be released to the seller only after you confirm that your item has been delivered and meets your expectations.
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
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  emblemWrapper: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 20,
  },
  emblemCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#dcfce7',
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#16a34a',
    borderRadius: 14,
    padding: 6,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 300,
  },
  orderNumberHighlight: {
    color: colors.primary,
    fontWeight: '900',
  },
  receiptSection: {
    width: '100%',
    marginVertical: 16,
  },
  actions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  manageOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  manageOrdersText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    height: 50,
  },
  homeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  guaranteeNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
