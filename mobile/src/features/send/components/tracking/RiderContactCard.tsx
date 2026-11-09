import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native';
import { Phone, MessageSquare, Star, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

interface RiderContactCardProps {
  name: string;
  phone: string;
  avatar?: string | null;
  riderId?: string | null;
  estimatedArrival?: string;
  statusText?: string;
}

export function RiderContactCard({
  name,
  phone,
  avatar,
  riderId,
  estimatedArrival = '8 mins',
  statusText = 'Rider is on the way to pick up your package',
}: RiderContactCardProps) {
  const handleCall = () => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleSms = () => {
    if (phone) Linking.openURL(`sms:${phone}`).catch(() => {});
  };

  const formattedId = riderId
    ? `RID-${riderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`
    : 'RID-78345';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.riderLabel}>YOUR DISPATCH COURIER</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.ratingBadge}>
              <Star size={11} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>
          <Text style={styles.riderId}>{formattedId}</Text>
        </View>

        <View style={styles.etaWrap}>
          <Text style={styles.etaLabel}>EST. ARRIVAL</Text>
          <Text style={styles.etaText}>{estimatedArrival}</Text>
        </View>
      </View>

      <Text style={styles.statusLine}>{statusText}</Text>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.8}>
          <Phone size={15} color="#ffffff" />
          <Text style={styles.callBtnText}>Call {phone}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smsBtn} onPress={handleSms} activeOpacity={0.8}>
          <MessageSquare size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  riderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  riderId: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  etaWrap: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  etaText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16a34a',
    marginTop: 2,
  },
  statusLine: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  callBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  smsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
