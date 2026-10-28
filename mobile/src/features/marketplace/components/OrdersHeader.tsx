import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ShieldCheck, Package } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../theme/colors';

export function OrdersHeader() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.titleWrap}>
        <Text style={styles.sub}>REGISTRY MANAGEMENT</Text>
        <Text style={styles.title}>My Orders</Text>
      </View>

      <View style={styles.badgesRow}>
        <TouchableOpacity
          style={styles.sentBtn}
          onPress={() => navigation.navigate('SendHistory')}
          activeOpacity={0.8}
        >
          <Package size={13} color={colors.primary} />
          <Text style={styles.sentBtnText}>Sent Packages History</Text>
        </TouchableOpacity>

        <View style={styles.escrowBadge}>
          <ShieldCheck size={14} color="#f59e0b" />
          <Text style={styles.escrowText}>Escrow Safe • Protected</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  titleWrap: {
    marginBottom: 8,
  },
  sub: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  sentBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  escrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
});
