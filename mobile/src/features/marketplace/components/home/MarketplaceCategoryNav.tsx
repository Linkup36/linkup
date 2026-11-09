import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';
import {
  Grid,
  Heart,
  Sparkles,
  Shirt,
  Laptop,
  Home as HomeIcon,
  ShoppingBag,
  Apple,
  MapPin,
  UtensilsCrossed,
} from 'lucide-react-native';

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Grid,
  Heart,
  Sparkles,
  Shirt,
  Laptop,
  Home: HomeIcon,
  ShoppingBag,
  Apple,
  MapPin,
  Food: UtensilsCrossed,
  Restaurant: UtensilsCrossed,
};

interface MarketplaceCategoryNavProps {
  categories: any[];
  selectedTab: string;
  setSelectedTab: (category: string) => void;
}

export function MarketplaceCategoryNav({
  categories,
  selectedTab,
  setSelectedTab,
}: MarketplaceCategoryNavProps) {
  const sortedCategories = [...categories];
  const foodIndex = sortedCategories.findIndex(
    (c) =>
      (c.name || '').toLowerCase().includes('restaurant') ||
      (c.name || '').toLowerCase().includes('food')
  );
  if (foodIndex > -1) {
    const foodCat = sortedCategories.splice(foodIndex, 1)[0];
    sortedCategories.unshift(foodCat);
  }

  const CATEGORY_TABS = [{ name: 'All Products', icon: 'Grid' }, ...sortedCategories];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {CATEGORY_TABS.map((tab) => {
          const tabName = (tab as any).name;
          const isActive = selectedTab === tabName;
          const Icon =
            CATEGORY_ICON_MAP[(tab as any).icon] ||
            (tabName.toLowerCase().includes('food') ? UtensilsCrossed : Grid);

          return (
            <TouchableOpacity
              key={tabName}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedTab(tabName);
              }}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              activeOpacity={0.75}
            >
              <Icon
                size={14}
                color={isActive ? '#ffffff' : '#64748b'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tabName}
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
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});
