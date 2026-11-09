import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../../../theme/colors';
import { MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface MarketplaceZoneNavProps {
  zones: any[];
  selectedZone: string;
  setSelectedZone: (value: string) => void;
  geoLoading?: boolean;
  onRefreshGeo?: () => void;
}

export function MarketplaceZoneNav({
  zones,
  selectedZone,
  setSelectedZone,
  geoLoading = false,
  onRefreshGeo,
}: MarketplaceZoneNavProps) {
  if (zones.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {onRefreshGeo && (
          <TouchableOpacity
            style={styles.detectBtn}
            onPress={onRefreshGeo}
            disabled={geoLoading}
            activeOpacity={0.7}
          >
            <MapPin size={13} color={colors.primary} />
            <Text style={styles.detectBtnText}>
              {geoLoading ? 'Detecting...' : 'Detect Zone'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setSelectedZone('');
          }}
          style={[styles.zonePill, !selectedZone && styles.zonePillActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.zoneText, !selectedZone && styles.zoneTextActive]}>
            All Zones
          </Text>
        </TouchableOpacity>

        {zones.map((z: any) => {
          const isActive = selectedZone === z.id || selectedZone === z.name;
          return (
            <TouchableOpacity
              key={z.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedZone(z.id);
              }}
              style={[styles.zonePill, isActive && styles.zonePillActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.zoneText, isActive && styles.zoneTextActive]}>
                {z.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  detectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  zonePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  zonePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  zoneTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
