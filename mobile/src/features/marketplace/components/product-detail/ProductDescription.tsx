import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProductDescriptionProps {
  description?: string | null;
}

export function ProductDescription({ description }: ProductDescriptionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>About this item</Text>
      <Text style={styles.paragraph}>
        {description && description.trim().length > 0
          ? description.trim()
          : 'No description provided for this item.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  heading: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
});
