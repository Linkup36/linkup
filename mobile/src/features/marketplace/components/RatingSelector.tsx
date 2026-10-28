import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface RatingSelectorProps {
  rating: number;
  setRating: (rating: number) => void;
  size?: number;
}

export function RatingSelector({
  rating,
  setRating,
  size = 32,
}: RatingSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((num) => {
          const isFilled = num <= rating;
          return (
            <TouchableOpacity
              key={num}
              onPress={() => {
                Haptics.selectionAsync();
                setRating(num);
              }}
              style={styles.starTouch}
              activeOpacity={0.7}
            >
              <Star
                size={size}
                color="#f59e0b"
                fill={isFilled ? '#f59e0b' : 'none'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.scoreText}>{rating} of 5 Stars</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starTouch: {
    padding: 6,
  },
  scoreText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
