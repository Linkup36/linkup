import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck, Clock } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

export function ProductTrustTags() {
  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <ShieldCheck size={20} color={colors.primary} />
        <Text style={styles.text}>AUTHENTICITY VERIFIED</Text>
      </View>
      <View style={styles.item}>
        <Clock size={20} color={colors.primary} />
        <Text style={styles.text}>FAST DELIVERY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 14,
    marginVertical: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.5,
  },
});
