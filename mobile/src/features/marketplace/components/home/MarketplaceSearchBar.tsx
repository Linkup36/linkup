import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { AppModal } from '../../../../components/ui/AppModal';

interface MarketplaceSearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  sortOption?: string;
  setSortOption?: (value: string) => void;
  selectedZone?: string;
  setSelectedZone?: (value: string) => void;
  zones?: any[];
  onReset?: () => void;
  onFilterPress?: () => void;
}

export function MarketplaceSearchBar({
  searchInput,
  setSearchInput,
  sortOption = 'newest',
  setSortOption,
  selectedZone = '',
  setSelectedZone,
  zones = [],
  onReset,
  onFilterPress,
}: MarketplaceSearchBarProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const handleOpenFilter = () => {
    if (onFilterPress) {
      onFilterPress();
    } else {
      setIsFilterModalOpen(true);
    }
  };

  const sortOptions = [
    { id: 'newest', label: 'Newest First' },
    { id: 'price_asc', label: 'Price: Low to High' },
    { id: 'price_desc', label: 'Price: High to Low' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          placeholder="Search products, brands..."
          placeholderTextColor="#94a3b8"
          value={searchInput}
          onChangeText={setSearchInput}
          style={styles.input}
          returnKeyType="search"
        />
      </View>

      <TouchableOpacity
        style={styles.filterBtn}
        onPress={handleOpenFilter}
        activeOpacity={0.75}
      >
        <SlidersHorizontal size={18} color="#0f172a" />
      </TouchableOpacity>

      {/* Embedded Filter Modal if not handled externally */}
      <AppModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Refine Marketplace"
        subtitle="Filter by sort order and delivery zones"
        primaryButton={{
          label: 'Apply Filters',
          onPress: () => setIsFilterModalOpen(false),
        }}
        secondaryButton={
          onReset
            ? {
                label: 'Reset',
                onPress: () => {
                  onReset();
                  setIsFilterModalOpen(false);
                },
                variant: 'outline',
              }
            : undefined
        }
      >
        <View style={styles.modalContent}>
          <Text style={styles.sectionTitle}>Sort Order</Text>
          <View style={styles.sortRow}>
            {sortOptions.map((opt) => {
              const isSelected = sortOption === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.sortChip, isSelected && styles.sortChipActive]}
                  onPress={() => setSortOption?.(opt.id)}
                >
                  <Text style={[styles.sortChipText, isSelected && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {zones.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Delivery Zone</Text>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortChip, !selectedZone && styles.sortChipActive]}
                  onPress={() => setSelectedZone?.('')}
                >
                  <Text style={[styles.sortChipText, !selectedZone && styles.sortChipTextActive]}>
                    All Zones
                  </Text>
                </TouchableOpacity>
                {zones.map((z: any) => {
                  const isSelected = selectedZone === z.id;
                  return (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.sortChip, isSelected && styles.sortChipActive]}
                      onPress={() => setSelectedZone?.(z.id)}
                    >
                      <Text
                        style={[
                          styles.sortChipText,
                          isSelected && styles.sortChipTextActive,
                        ]}
                      >
                        {z.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  sortChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
