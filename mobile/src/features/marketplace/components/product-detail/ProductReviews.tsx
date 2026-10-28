import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

interface ReviewItem {
  id: string;
  rating: number;
  review_text?: string;
  created_at?: string;
  profiles?: {
    display_name?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface ProductReviewsProps {
  reviews: ReviewItem[];
  averageRating: number;
  onWriteReview: () => void;
}

export function ProductReviews({
  reviews,
  averageRating,
  onWriteReview,
}: ProductReviewsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Customer Reviews</Text>
          <Text style={styles.subtitle}>
            {reviews.length > 0
              ? `${averageRating.toFixed(1)} / 5.0 (${reviews.length} ${
                  reviews.length === 1 ? 'review' : 'reviews'
                })`
              : 'No customer reviews yet'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.writeBtn}
          onPress={onWriteReview}
          activeOpacity={0.8}
        >
          <Text style={styles.writeBtnText}>Write a Review</Text>
        </TouchableOpacity>
      </View>

      {reviews.length > 0 ? (
        reviews.map((rev) => (
          <View key={rev.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.reviewerName}>
                {rev.profiles?.display_name ||
                  rev.profiles?.full_name ||
                  'Verified Customer'}
              </Text>
              <View style={styles.starsGroup}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={12}
                    color="#f59e0b"
                    fill={s <= rev.rating ? '#f59e0b' : 'none'}
                  />
                ))}
              </View>
            </View>
            {rev.review_text ? (
              <Text style={styles.reviewText}>{rev.review_text}</Text>
            ) : null}
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Be the first to share your experience with this product!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 18,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  writeBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  writeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  starsGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
