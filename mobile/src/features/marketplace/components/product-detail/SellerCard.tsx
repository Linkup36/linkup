import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

interface SellerCardProps {
  seller: any;
  onChatPress?: () => void;
}

export function SellerCard({ seller, onChatPress }: SellerCardProps) {
  const sellerDisplayName =
    seller?.display_name || seller?.full_name || 'Verified Merchant';
  const initial = (sellerDisplayName.trim()[0] || 'S').toUpperCase();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onChatPress}
      disabled={!onChatPress}
      activeOpacity={0.85}
    >
      <View style={styles.left}>
        {seller?.avatar_url ? (
          <Image source={{ uri: seller.avatar_url }} style={styles.avatarImg} />
        ) : (
          <View style={styles.initialBadge}>
            <Text style={styles.initialText}>{initial}</Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.label}>OFFERED BY</Text>
          <Text style={styles.name}>{sellerDisplayName}</Text>
        </View>
      </View>

      {onChatPress && (
        <View style={styles.chatIconWrap}>
          <MessageCircle size={18} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  initialBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  name: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  chatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
