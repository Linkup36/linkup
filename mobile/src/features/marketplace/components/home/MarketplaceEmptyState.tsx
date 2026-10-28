import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';

interface MarketplaceEmptyStateProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode | React.ComponentType<any>;
}

export function MarketplaceEmptyState({
  title = 'No Products Found',
  subtitle = 'Try selecting "All Products" or a different delivery zone to discover available items.',
  icon,
}: MarketplaceEmptyStateProps) {
  const renderIcon = () => {
    if (!icon) {
      return <ShoppingBag size={32} color="#94a3b8" strokeWidth={1.8} />;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
    ) {
      const IconComponent = icon as any;
      return <IconComponent size={32} color="#94a3b8" strokeWidth={1.8} />;
    }
    return <ShoppingBag size={32} color="#94a3b8" strokeWidth={1.8} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        {renderIcon()}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
