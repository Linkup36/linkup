import React, { useRef } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductGalleryProps {
  images: string[];
  currentImageIndex: number;
  setCurrentImageIndex: (index: number) => void;
  price: number;
  onBack?: () => void;
  onShare?: () => void;
}

export function ProductGallery({
  images,
  currentImageIndex,
  setCurrentImageIndex,
  price,
  onBack,
  onShare,
}: ProductGalleryProps) {
  const scrollRef = useRef<any>(null);
  const displayImages = images && images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];

  const handleScroll = (e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (page !== currentImageIndex) {
      setCurrentImageIndex(page);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {displayImages.map((uri, idx) => (
          <Image
            key={idx}
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Floating Back Button */}
      {onBack && (
        <TouchableOpacity
          style={styles.floatingNavBtnLeft}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Floating Share Button */}
      {onShare && (
        <TouchableOpacity
          style={styles.floatingNavBtnRight}
          onPress={onShare}
          activeOpacity={0.8}
        >
          <Share2 size={20} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Pagination Indicators */}
      {displayImages.length > 1 && (
        <View style={styles.paginationPill}>
          {displayImages.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentImageIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Floating Price Badge */}
      <View style={styles.floatingPriceBadge}>
        <Text style={styles.floatingPriceText}>
          ₦{Math.round(price).toLocaleString('en-NG')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#f1f5f9',
  },
  scroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#f1f5f9',
  },
  floatingNavBtnLeft: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  floatingNavBtnRight: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  paginationPill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  floatingPriceBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  floatingPriceText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
