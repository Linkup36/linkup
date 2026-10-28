import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Platform,
  Linking,
} from 'react-native';
import {
  Copy,
  Share2,
  Check,
  X,
  MessageCircle,
  Sparkles,
  DollarSign,
  TrendingUp,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { toast } from '../../../components/ui';
import { ProductToPromote } from '../hooks/usePromoterData';

const BRAND_ORANGE = '#EB7D30';

interface PromoteProductModalProps {
  visible: boolean;
  onClose: () => void;
  product: ProductToPromote | null;
  promoterCode: string;
}

export function PromoteProductModal({
  visible,
  onClose,
  product,
  promoterCode,
}: PromoteProductModalProps) {
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const commissionPercent = product.commission_percent || 5;
  const estimatedCommission = Math.round((product.price * commissionPercent) / 100);
  const referralLink = `https://linkupng.com/product/${product.id}?ref=${promoterCode || 'linkup'}`;

  const handleCopyLink = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.success('Affiliate Link Copied! 📋', {
      description: 'Paste it in your bio, WhatsApp status, or chats.',
    });
    setTimeout(() => setCopied(false), 2200);
  };

  const handleNativeShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        title: `Buy ${product.title} on LinkUp`,
        message: `Check out ${product.title} on LinkUp Marketplace for ₦${product.price.toLocaleString()} with rapid delivery: ${referralLink}`,
      });
    } catch (e) {
      console.warn('[PromoteModal] share error:', e);
    }
  };

  const handleWhatsAppShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg = encodeURIComponent(
      `Hey! Check out *${product.title}* on LinkUp Marketplace for just ₦${product.price.toLocaleString()}.\n\nBuy here: ${referralLink}`
    );
    const url = `whatsapp://send?text=${msg}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          handleNativeShare();
        }
      })
      .catch(() => handleNativeShare());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={18} color={BRAND_ORANGE} />
              <Text style={styles.sheetTitle}>Promote & Earn Commission</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Product Preview Card */}
          <View style={styles.productCard}>
            <Image
              source={{
                uri:
                  product.images?.[0] ||
                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
              }}
              style={styles.productThumb}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {product.title}
              </Text>
              <Text style={styles.productPrice}>₦{product.price.toLocaleString()}</Text>

              {/* Commission Tag */}
              <View style={styles.commissionTag}>
                <TrendingUp size={12} color={BRAND_ORANGE} />
                <Text style={styles.commissionText}>
                  Earn ₦{estimatedCommission.toLocaleString()} ({commissionPercent}%) per sale
                </Text>
              </View>
            </View>
          </View>

          {/* Referral Link Box */}
          <Text style={styles.fieldLabel}>YOUR UNIQUE AFFILIATE LINK</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>
              {referralLink}
            </Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.8}>
              {copied ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Check size={14} color={BRAND_ORANGE} />
                  <Text style={[styles.copyBtnText, { color: BRAND_ORANGE }]}>Copied</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Copy size={14} color={BRAND_ORANGE} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Share Action Buttons */}
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsAppShare} activeOpacity={0.85}>
              <MessageCircle size={18} color="#FFFFFF" />
              <Text style={styles.whatsappBtnText}>WhatsApp Status / Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nativeShareBtn} onPress={handleNativeShare} activeOpacity={0.85}>
              <Share2 size={18} color={BRAND_ORANGE} />
            </TouchableOpacity>
          </View>

          {/* Pro-Tip */}
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              💡 <Text style={{ fontWeight: '800' }}>Pro-Tip:</Text> When anyone clicks your link, they are automatically attributed to your promoter account. You earn the commission instantly when they check out!
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  productThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND_ORANGE,
    marginTop: 2,
  },
  commissionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  commissionText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
    marginBottom: 16,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  copyBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  whatsappBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  whatsappBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nativeShareBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
  },
  tipText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
});
