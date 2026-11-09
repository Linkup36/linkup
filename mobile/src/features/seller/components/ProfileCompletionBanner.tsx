import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, ArrowRight } from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface ProfileCompletionBannerProps {
  onAction?: () => void;
  profile: any;
}

export function ProfileCompletionBanner({ onAction, profile }: ProfileCompletionBannerProps) {
  if (!profile) return null;

  // Strict check matching web
  const isComplete =
    Boolean(profile.display_name) &&
    Boolean(profile.phone) &&
    Boolean(profile.city_id) &&
    Boolean(profile.bio);

  if (isComplete) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <AlertCircle size={22} color="#b45309" strokeWidth={2.5} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Profile Incomplete</Text>
        <Text style={styles.subtitle}>
          Complete your profile to ensure smooth payouts and faster deliveries.
        </Text>
      </View>
      {onAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionBtnText}>Complete</Text>
          <ArrowRight size={13} color="#ffffff" strokeWidth={3} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#78350f',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d97706',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

