import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
} from 'react-native';
import {
  Heart,
  Star,
  ShoppingCart,
  MapPin,
  Share2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { haversineDistance, formatDistance } from '../../../utils/haversine';
import { toast } from '../../../components/ui/GooeyToast';
import { POPULAR_NIGERIAN_LOCATIONS } from '../../send/data/nigerianLocations';

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

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40) / 2; // Two columns with 14px outer padding and 12px gap

export interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  image?: string;
  sellerName?: string;
  likeCount?: number;
  isLiked?: boolean;
  cityName?: string;
  zoneName?: string;
  stockQuantity?: number;
  avgRating?: number;
  reviewsCount?: number;
  onLike?: (id: string) => void;
  onBuyNow?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  onPress?: () => void;
  index?: number;
  isPromoter?: boolean;
  promoterCode?: string | null;
  latitude?: number;
  longitude?: number;
  userLocation?: { latitude: number; longitude: number } | null;
}

export function ProductCard({
  id,
  title,
  price,
  oldPrice,
  image,
  sellerName,
  likeCount = 0,
  isLiked = false,
  cityName,
  zoneName,
  stockQuantity,
  avgRating = 0,
  reviewsCount = 0,
  onLike,
  onBuyNow,
  onAddToCart,
  onPress,
  isPromoter = false,
  promoterCode,
  latitude,
  longitude,
  userLocation,
}: ProductCardProps) {
  const isOutOfStock = stockQuantity !== undefined && stockQuantity <= 0;
  const isLowStock = !isOutOfStock && stockQuantity !== undefined && stockQuantity <= 5;

  // Format currency
  const formatPrice = (amount: number) => {
    return '₦' + Math.round(amount).toLocaleString('en-NG');
  };

  // Location & Distance calculation
  const zoneLabel = zoneName?.split('(')[0]?.trim() || cityName || 'ABUJA';
  const coords =
    latitude && longitude
      ? { latitude, longitude }
      : getZoneCoordinates(zoneLabel);

  let distanceInfo: string | null = null;
  if (userLocation && coords) {
    const dist = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      coords.latitude,
      coords.longitude
    );
    const minTime = Math.round(dist * 2.5 + 15);
    const maxTime = Math.round(dist * 4 + 25);
    distanceInfo = `${formatDistance(dist)} • ${minTime}-${maxTime}m`;
  }

  const handleLike = () => {
    if (isOutOfStock) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onLike) {
      onLike(id);
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onAddToCart) {
      onAddToCart(id);
    }
  };

  const handlePromoteShare = async () => {
    if (!promoterCode) return;
    try {
      const shareUrl = `https://linkupng.com/product/${id}?ref=${promoterCode}`;
      await Share.share({
        message: `Check out ${title} on LinkUp: ${shareUrl}`,
        title: `Share ${title}`,
      });
      toast.success('Referral link shared');
    } catch {
      toast.error('Could not share link');
    }
  };

  const placeholderImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.card}
    >
      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image || placeholderImage }}
          style={[styles.image, isOutOfStock && styles.imageOutOfStock]}
          resizeMode="cover"
        />

        {/* Location / Zone Tag (Top Left) */}
        {(zoneName || cityName) && (
          <View style={styles.locationBadge}>
            <MapPin size={9} color={colors.primary} />
            <View>
              <Text style={styles.locationText} numberOfLines={1}>
                {zoneLabel}
              </Text>
              {distanceInfo && (
                <Text style={styles.distanceText} numberOfLines={1}>
                  {distanceInfo}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Wishlist Heart Button (Top Right) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLike}
          disabled={isOutOfStock}
          style={[styles.heartButton, isOutOfStock && styles.heartDisabled]}
        >
          <Heart
            size={16}
            color={isLiked ? colors.error : '#ffffff'}
            fill={isLiked ? colors.error : 'transparent'}
          />
        </TouchableOpacity>

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
            </View>
          </View>
        )}

        {/* Low Stock Warning Pill */}
        {isLowStock && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockText}>Only {stockQuantity} left</Text>
          </View>
        )}
      </View>

      {/* Product Info Section */}
      <View style={styles.info}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Rating and Reviews */}
        <View style={styles.ratingRow}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={10}
                color={star <= Math.floor(avgRating) ? '#f59e0b' : '#cbd5e1'}
                fill={star <= Math.floor(avgRating) ? '#f59e0b' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.ratingText}>
            {avgRating > 0 ? avgRating.toFixed(1) : 'NEW'}
            {reviewsCount > 0 && ` (${reviewsCount})`}
          </Text>
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(price)}</Text>
          {oldPrice && oldPrice > price && (
            <View style={styles.discountContainer}>
              <Text style={styles.oldPrice}>{formatPrice(oldPrice)}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Button: Quick Add or Promoter Share */}
        {isPromoter && promoterCode ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePromoteShare}
            style={styles.promoteBtn}
          >
            <Share2 size={13} color="#ffffff" />
            <Text style={styles.promoteBtnText}>Share & Earn</Text>
          </TouchableOpacity>
        ) : !isOutOfStock && onAddToCart ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddToCart}
            style={styles.quickAddBtn}
          >
            <ShoppingCart size={13} color={colors.primary} />
            <Text style={styles.quickAddBtnText}>Quick Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.05,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOutOfStock: {
    opacity: 0.45,
  },
  locationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    maxWidth: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  locationText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  distanceText: {
    fontSize: 7.5,
    fontWeight: '600',
    color: '#64748b',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartDisabled: {
    opacity: 0.3,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  lowStockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowStockText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  info: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  discountContainer: {
    alignItems: 'flex-end',
  },
  oldPrice: {
    fontSize: 10,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 1,
  },
  discountText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16a34a',
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  quickAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
  },
  promoteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
