import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Printer, Share2, ShieldCheck, X } from 'lucide-react-native';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { colors } from '../../../theme/colors';
import { AppModal } from '../../../components/ui/AppModal';
import * as Haptics from 'expo-haptics';

interface ReceiptItem {
  title: string;
  quantity: number;
  price: number;
  size?: string;
}

interface ReceiptProps {
  orderNumber?: string;
  date?: string;
  items: ReceiptItem[];
  total: number;
  deliveryFee?: number;
  shopName?: string;
  buyerName?: string;
}

export function Receipt({
  orderNumber = '#LK-001234',
  date = new Date().toLocaleString(),
  items = [],
  total = 0,
  deliveryFee = 0,
  shopName = 'Linkup Global',
  buyerName = 'Verified Buyer',
}: ReceiptProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: `Linkup Marketplace Official Receipt\nOrder: ${orderNumber}\nDate: ${date}\nMerchant: ${shopName}\nTotal Paid: ₦${total.toLocaleString('en-NG')}\nStatus: Escrow Secured`,
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.viewReceiptBtn}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
      >
        <Printer size={14} color="#0f172a" />
        <Text style={styles.viewReceiptText}>View Official Receipt</Text>
      </TouchableOpacity>

      <AppModal
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        title="Escrow Order Receipt"
        subtitle="Official proof of Linkup marketplace transaction"
        primaryButton={{
          label: 'Share Receipt',
          onPress: handleShare,
        }}
        secondaryButton={{
          label: 'Close',
          onPress: () => setIsOpen(false),
          variant: 'outline',
        }}
      >
        <View style={styles.receiptPaper}>
          <View style={styles.logoRow}>
            <BrandLogo size={36} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.brandTitle}>Linkup</Text>
              <Text style={styles.brandSub}>ESCROW REGISTRY</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Order Ref</Text>
            <Text style={styles.metaVal}>{orderNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaVal}>{date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Merchant</Text>
            <Text style={styles.metaVal}>{shopName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Buyer</Text>
            <Text style={styles.metaVal}>{buyerName}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.itemsHeader}>Purchased Items</Text>
          {items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {it.title} {it.size ? `(${it.size})` : ''} x{it.quantity}
              </Text>
              <Text style={styles.itemPrice}>
                ₦{Math.round(it.price * it.quantity).toLocaleString('en-NG')}
              </Text>
            </View>
          ))}

          {deliveryFee > 0 && (
            <View style={styles.itemRow}>
              <Text style={styles.itemTitle}>Verified Courier Delivery</Text>
              <Text style={styles.itemPrice}>
                ₦{Math.round(deliveryFee).toLocaleString('en-NG')}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL PAID</Text>
            <Text style={styles.totalVal}>₦{Math.round(total).toLocaleString('en-NG')}</Text>
          </View>

          <View style={styles.shieldFooter}>
            <ShieldCheck size={16} color="#16a34a" />
            <Text style={styles.shieldText}>
              Transaction Authenticated & Held by Linkup Escrow
            </Text>
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  viewReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'flex-start',
  },
  viewReceiptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptPaper: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginVertical: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  itemsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemTitle: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  shieldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
  },
  shieldText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '700',
    flex: 1,
  },
});
