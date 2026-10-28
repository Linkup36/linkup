import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  Headphones,
  Phone,
  MessageSquare,
  FileText,
  ArrowUpRight,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import { colors } from '../../../../theme/colors';

interface SendSupportModalProps {
  visible: boolean;
  onClose: () => void;
  orderId?: string;
  orderStatus?: string;
}

export function SendSupportModal({
  visible,
  onClose,
  orderId,
  orderStatus,
}: SendSupportModalProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const supportPhone = '08144445693';
  const supportPhoneTel = '+2348144445693';
  const whatsappUrl = 'https://wa.link/cpb3fe';

  const handleOpenTicket = () => {
    onClose();
    navigation.navigate('Support');
  };

  const handleCall = () => {
    Linking.openURL(`tel:${supportPhoneTel}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    Linking.openURL(whatsappUrl).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Headphones size={22} color={colors.primary} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>LinkUp Dispatch Support</Text>
              <Text style={styles.subtitle}>
                We're here 24/7 to help you with your package delivery.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Order Reference Pill if available */}
          {orderId && (
            <View style={styles.orderPill}>
              <View style={styles.orderPillLeft}>
                <FileText size={14} color={colors.primary} />
                <Text style={styles.orderIdText}>{orderId}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {orderStatus?.replace('_', ' ') || 'ACTIVE'}
                </Text>
              </View>
            </View>
          )}

          {/* Support Channels */}
          <View style={styles.channelsList}>
            {/* WhatsApp */}
            <TouchableOpacity
              style={[styles.channelItem, styles.whatsappItem]}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
            >
              <View style={[styles.channelIcon, { backgroundColor: '#16a34a' }]}>
                <MessageSquare size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>Chat on WhatsApp</Text>
                <Text style={styles.channelDesc}>Instant live response from dispatch agent</Text>
              </View>
              <ArrowUpRight size={16} color="#16a34a" />
            </TouchableOpacity>

            {/* Direct Call */}
            <TouchableOpacity
              style={[styles.channelItem, styles.callItem]}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <View style={[styles.channelIcon, { backgroundColor: '#2563eb' }]}>
                <Phone size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>Direct Helpline ({supportPhone})</Text>
                <Text style={styles.channelDesc}>Speak directly with our logistics team</Text>
              </View>
              <ArrowUpRight size={16} color="#2563eb" />
            </TouchableOpacity>

            {/* In-App Ticket */}
            <TouchableOpacity
              style={[styles.channelItem, styles.ticketItem]}
              onPress={handleOpenTicket}
              activeOpacity={0.8}
            >
              <View style={[styles.channelIcon, { backgroundColor: colors.primary }]}>
                <Headphones size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>Open Support Ticket</Text>
                <Text style={styles.channelDesc}>File a dispute, tracking delay, or claim</Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  orderPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ea580c',
    textTransform: 'uppercase',
  },
  channelsList: {
    marginTop: 14,
    gap: 10,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  whatsappItem: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  callItem: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  ticketItem: {
    backgroundColor: '#fafaf9',
    borderColor: '#e7e5e4',
  },
  channelIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  channelDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});
