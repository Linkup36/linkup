import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  showText?: boolean;
  showGlobal?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BrandLogo({
  size = 'md',
  showText = false,
  showGlobal = true,
  style,
}: BrandLogoProps) {
  let dimension = 64;
  if (typeof size === 'number') {
    dimension = size;
  } else if (size === 'sm') {
    dimension = 36;
  } else if (size === 'lg') {
    dimension = 84;
  }

  const borderRadius = Math.round(dimension * 0.28);

  return (
    <View style={[styles.container, style]}>
      {/* Official Emblem Logo Image */}
      <View
        style={[
          styles.imageContainer,
          {
            width: dimension,
            height: dimension,
            borderRadius,
            shadowColor: colors.primary,
          },
        ]}
      >
        <Image
          source={require('../../../assets/logo.png')}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius,
            },
          ]}
          resizeMode="cover"
        />
      </View>

      {/* Optional Brand Text */}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, { fontSize: dimension > 60 ? 24 : 17 }]}>
            Linkup
          </Text>
          {showGlobal && (
            <Text style={[styles.globalSubtitle, { fontSize: dimension > 60 ? 10 : 8 }]}>
              GLOBAL
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    backgroundColor: colors.primary,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  globalSubtitle: {
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 2,
    marginTop: 1,
  },
});
