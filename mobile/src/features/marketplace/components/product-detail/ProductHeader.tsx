import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

interface ProductHeaderProps {
  product: any;
  averageRating?: number;
  reviewsCount?: number;
}

export function ProductHeader({
  product,
  averageRating = 0,
  reviewsCount = 0,
}: ProductHeaderProps) {
  const isInStock = (product.inventory || 0) > 0;

  return (
    <View style={styles.container}>
      {/* Stock Status Badge */}
      <View style={[styles.stockBadge, !isInStock && styles.stockBadgeOut]}>
        <Text style={[styles.stockText, !isInStock && styles.stockTextOut]}>
          {isInStock ? `IN STOCK: ${product.inventory}` : 'OUT OF STOCK'}
        </Text>
      </View>

      {/* Product Title */}
      <Text style={styles.title}>{product.title}</Text>

      {/* Rating & Review Count */}
      <View style={styles.ratingRow}>
        <View style={styles.starsGroup}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              color="#f59e0b"
              fill={star <= Math.round(averageRating) ? '#f59e0b' : 'none'}
            />
          ))}
        </View>
        <Text style={styles.ratingText}>
          {averageRating > 0
            ? `${averageRating.toFixed(1)} (${reviewsCount})`
            : 'New'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  stockBadgeOut: {
    backgroundColor: '#fef2f2',
  },
  stockText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stockTextOut: {
    color: '#dc2626',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  starsGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
});
