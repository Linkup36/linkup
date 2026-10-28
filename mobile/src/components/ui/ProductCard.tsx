import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MapPin, Heart, Star, ShoppingCart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { haversineDistance, formatDistance, calculateDeliveryEta } from '../../utils/haversine';
import { POPULAR_NIGERIAN_LOCATIONS } from '../../features/send/data/nigerianLocations';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40) / 2; // Two columns with 14px gutters and 12px gap

export interface ProductItem {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  images?: string[] | null;
  category?: string | null;
  seller_id?: string;
  seller_name?: string;
  condition?: string | null;
  avg_rating?: number | null;
  reviews_count?: number | null;
  inventory?: number | null;
  delivery_zones?: { name?: string | null } | null;
  cities?: { name?: string | null } | null;
  zone_name?: string | null;
  city_name?: string | null;
  is_liked?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProductCardProps {
  product: ProductItem;
  onPress: () => void;
  onLike?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  isLiked?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
}

function getZoneCoordinates(
  zoneOrCityName?: string | null
): { latitude: number; longitude: number } | null {
  if (!zoneOrCityName) return null;
  const clean = zoneOrCityName.toLowerCase().replace(/\(.*?\)/g, '').trim();
  if (!clean || clean === 'all zones') return null;

  const match = POPULAR_NIGERIAN_LOCATIONS.find((loc) => {
    const area = loc.area.toLowerCase();
    const title = loc.primaryTitle.toLowerCase();
    const name = loc.name.toLowerCase();
    return (
      clean.includes(area) ||
      area.includes(clean) ||
      clean.includes(title) ||
      title.includes(clean) ||
      name.includes(clean)
    );
  });

  return match ? { latitude: match.latitude, longitude: match.longitude } : null;
}

export function ProductCard({
  product,
  onPress,
  onLike,
  onAddToCart,
  isLiked = false,
  userLocation,
}: ProductCardProps) {
  const imageUrl =
    product.images && product.images.length > 0 && product.images[0]
      ? product.images[0]
      : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';

  const zoneTitle =
    product.delivery_zones?.name ||
    product.zone_name ||
    product.cities?.name ||
    product.city_name ||
    'ABUJA';

  // Coordinate resolution (database coordinates or zone fallback)
  const productCoords =
    product.latitude && product.longitude
      ? { latitude: product.latitude, longitude: product.longitude }
      : getZoneCoordinates(zoneTitle);

  let distanceInfo: string | null = null;
  if (userLocation && productCoords) {
    const dist = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      productCoords.latitude,
      productCoords.longitude
    );
    const { label } = calculateDeliveryEta(dist);
    distanceInfo = `${formatDistance(dist)} • ${label}`;
  }

  const formatPrice = (amount: number) => {
    return '₦' + Math.round(amount).toLocaleString('en-NG');
  };

  const handleLike = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onLike) {
      onLike(product.id);
    }
  };

  const handleAddToCart = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onAddToCart) {
      onAddToCart(product.id);
    }
  };

  const rating = product.avg_rating || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.card}
    >
      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Top-Left Location & Distance Tag */}
        <View style={styles.locationBadge}>
          <MapPin
            size={distanceInfo ? 10 : 9}
            color={colors.primary}
            style={distanceInfo ? styles.pinWithDistance : undefined}
          />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationText} numberOfLines={1}>
              {zoneTitle.split('(')[0].trim().toUpperCase()}
            </Text>
            {distanceInfo ? (
              <Text style={styles.distanceText} numberOfLines={1}>
                {distanceInfo}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Top-Right Wishlist Heart Button */}
        <TouchableOpacity
          style={styles.likeButton}
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <Heart
            size={13}
            color={isLiked ? colors.destructive : '#0f172a'}
            fill={isLiked ? colors.destructive : 'transparent'}
            strokeWidth={2.2}
          />
        </TouchableOpacity>
      </View>

      {/* Product Information */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {product.title}
        </Text>

        {/* Rating Row with 5 Stars + NEW Badge */}
        <View style={styles.ratingRow}>
          <View style={styles.starsWrap}>
            {[1, 2, 3, 4, 5].map((starIndex) => (
              <Star
                key={starIndex}
                size={11}
                color={starIndex <= rating ? colors.accent : '#cbd5e1'}
                fill={starIndex <= rating ? colors.accent : 'transparent'}
                strokeWidth={1.8}
              />
            ))}
          </View>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {product.original_price && product.original_price > product.price ? (
            <Text style={styles.originalPrice}>
              {formatPrice(product.original_price)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.95,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  locationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    maxWidth: CARD_WIDTH - 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2.5,
    elevation: 3,
  },
  pinWithDistance: {
    marginTop: 1,
  },
  locationTextContainer: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  locationText: {
    color: '#0f172a',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 11,
  },
  distanceText: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: 10,
    marginTop: 0.5,
  },
  likeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 17,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  starsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary, // Vibrant Orange #EB7D30
    letterSpacing: -0.3,
  },
  originalPrice: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
});
