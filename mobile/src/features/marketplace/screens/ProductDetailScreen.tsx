import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Share,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { AppModal } from '../../../components/ui/AppModal';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { AccountMenuModal } from '../../user/components/AccountMenuModal';
import { useGeolocation } from '../../logistics/hooks/useGeolocation';
import { colors } from '../../../theme/colors';
import { haversineDistance, formatDistance, calculateDeliveryEta } from '../../../utils/haversine';
import { POPULAR_NIGERIAN_LOCATIONS } from '../../send/data/nigerianLocations';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Share2,
  Heart,
  ShieldCheck,
  Clock,
  Star,
  ShoppingCart,
  AlertCircle,
  Bell,
  Headphones,
  Send,
  MessageCircle,
  MapPin,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ProductDetailRouteProp = RouteProp<RootStackParamList, 'ProductDetail'>;

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

interface ProductReview {
  id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  profiles?: {
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export function ProductDetailScreen() {
  const route = useRoute<ProductDetailRouteProp>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const id = route.params?.id;

  const { addToCart, totalCount } = useCart();
  const { user, profile } = useAuth();
  const { position: userLocation } = useGeolocation();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);

  // Product & Seller Data
  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [markupRate, setMarkupRate] = useState<number>(0.10); // default 10%
  const [loading, setLoading] = useState<boolean>(true);
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);

  // Gallery & Options
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const galleryScrollRef = useRef<any>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [commentText, setCommentText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Report Product Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('Counterfeit / Fake');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  // Load Product, Fee Config, Seller, Reviews & Wishlist status
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setProduct(null);
        setSeller(null);
        setReviews([]);

        if (!id) {
          console.warn('[ProductDetailScreen] No id provided in route.params');
          setLoading(false);
          return;
        }

        // 1. Fetch Product & Fee Config (joining seller merchant profile)
        const [pRes, feeRes] = await Promise.all([
          supabase
            .from('products')
            .select(`
              *,
              delivery_zones:zone_id(name),
              cities:city_id(name),
              seller:seller_id(id, display_name, avatar_url, phone, bio)
            `)
            .eq('id', id)
            .maybeSingle(),
          supabase.from('fee_config').select('*').eq('is_active', true),
        ]);

        if (pRes.error) {
          console.error('[ProductDetailScreen] Supabase product error:', pRes.error);
        }

        const pData = pRes.data;
        if (pData) {
          const prodFee = feeRes.data?.find((f: any) => f.fee_type === 'platform_product');
          const rate = prodFee?.rate ?? 0.10;
          setMarkupRate(rate);

          const multiplier = 1 + rate;
          const calculatedPrice = Math.round(pData.price * multiplier);
          const calculatedOriginal = pData.original_price
            ? Math.round(pData.original_price * multiplier)
            : null;

          setProduct({
            ...pData,
            rawPrice: pData.price,
            price: calculatedPrice,
            original_price: calculatedOriginal,
          });

          if (pData.sizes && pData.sizes.length > 0) {
            setSelectedSize(pData.sizes[0]);
          }

          // 2. Fetch / Set Seller Profile (Merchant Store)
          if (pData.seller) {
            setSeller(pData.seller);
          } else if (pData.seller_id) {
            const { data: sData } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url, phone, bio')
              .eq('id', pData.seller_id)
              .maybeSingle();

            if (sData) setSeller(sData);
          }
        }

        // 3. Fetch Reviews
        const { data: rData } = await supabase
          .from('product_reviews')
          .select(`
            id,
            rating,
            review_text,
            created_at,
            profiles:user_id(full_name, display_name, avatar_url)
          `)
          .eq('product_id', id)
          .order('created_at', { ascending: false });

        if (rData) {
          setReviews(rData as any);
        }

        // 4. Check Wishlist
        if (user) {
          const { data: likeData } = await supabase
            .from('likes')
            .select('product_id')
            .eq('user_id', user.id)
            .eq('product_id', id)
            .maybeSingle();

          if (likeData) {
            setIsWishlisted(true);
          }
        }
      } catch (err) {
        console.warn('Error loading product details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, user]);

  // Gallery Horizontal Scroll Listener
  const handleGalleryScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== currentImageIndex) {
      setCurrentImageIndex(page);
    }
  };

  // Share Product
  const handleShare = async () => {
    if (!product) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: `Check out ${product.title} on Linkup Marketplace! linkup://product/${product.id}`,
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  // Toggle Wishlist Like
  const handleToggleWishlist = async () => {
    if (!user) {
      toast.info('Please sign in to save items to your wishlist');
      navigation.navigate('Login');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextState = !isWishlisted;
    setIsWishlisted(nextState);

    try {
      if (nextState) {
        await supabase.from('likes').insert({ user_id: user.id, product_id: product.id });
        toast.success('Saved to Wishlist');
      } else {
        await supabase.from('likes').delete().match({ user_id: user.id, product_id: product.id });
        toast.info('Removed from Wishlist');
      }
    } catch (err) {
      console.warn('Wishlist toggle error:', err);
    }
  };

  // Add To Cart Handler
  const handleAddToCart = () => {
    if (!product) return;

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast.error('Please select a size first');
      return;
    }

    if ((product.inventory || 0) <= 0) {
      toast.error('This item is currently out of stock');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart({
      id: product.id,
      productId: product.id,
      title: product.title,
      price: product.price,
      originalPrice: product.original_price,
      image: product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      sellerId: product.seller_id || '',
      sellerName: seller?.display_name || seller?.full_name || 'Seller',
      stock: product.inventory,
    });
    toast.success('Added to Cart');
  };

  // Direct Buy Now Handler
  const handleBuyNow = () => {
    if (!product) return;

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast.error('Please select a size first');
      return;
    }

    if ((product.inventory || 0) <= 0) {
      toast.error('This item is currently out of stock');
      return;
    }

    handleAddToCart();
    navigation.navigate('Checkout', {
      directBuy: true,
      productId: product.id,
      quantity: 1,
    });
  };

  // Submit Product Review
  const handleSubmitReview = async () => {
    if (!user) {
      toast.info('Please sign in to write a review');
      navigation.navigate('Login');
      return;
    }

    if (!commentText.trim()) {
      toast.error('Please write a brief comment');
      return;
    }

    setSubmittingReview(true);
    try {
      const { error } = await (supabase as any)
        .from('product_reviews')
        .upsert(
          {
            user_id: user.id,
            product_id: id,
            rating: selectedRating,
            review_text: commentText.trim(),
          },
          { onConflict: 'user_id,product_id' }
        );

      if (error) throw error;

      toast.success('Review Submitted!');
      setIsReviewModalOpen(false);
      setCommentText('');

      // Refresh reviews
      const { data: rData } = await supabase
        .from('product_reviews')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          profiles:user_id(full_name, display_name, avatar_url)
        `)
        .eq('product_id', id)
        .order('created_at', { ascending: false });

      if (rData) setReviews(rData as any);
    } catch (err: any) {
      toast.error(err.message || 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Submit Report Product Issue
  const handleSubmitReport = async () => {
    if (!user) {
      toast.info('Please sign in to report a product');
      navigation.navigate('Login');
      return;
    }

    if (!reportDetails.trim()) {
      toast.error('Please describe the issue found');
      return;
    }

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('issues' as any).insert([
        {
          reporter_id: user.id,
          product_id: product.id,
          seller_id: product.seller_id,
          title: `[Product Report] ${reportReason}`,
          description: `Product: ${product.title}\nReason: ${reportReason}\n\nDetails:\n${reportDetails.trim()}`,
          priority: 'high',
          status: 'open',
        },
      ]);

      if (error) throw error;

      toast.success('Report submitted to Trust & Safety team');
      setIsReportModalOpen(false);
      setReportDetails('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <SafeView>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading product details...</Text>
        </View>
      </SafeView>
    );
  }

  if (!product) {
    return (
      <SafeView>
        <View style={styles.centerContainer}>
          <AlertCircle size={44} color="#ef4444" />
          <Text style={styles.notFoundTitle}>Product Not Found</Text>
          <TouchableOpacity
            style={styles.backBtnPill}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnPillText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeView>
    );
  }

  const images: string[] =
    product.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];

  const finalPrice = product.price || 0;
  const sellerDisplayName =
    seller?.display_name?.trim() || 'Merchant Store';
  const sellerInitial = (sellerDisplayName.trim()[0] || 'M').toUpperCase();

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

  const zoneTitle =
    product.delivery_zones?.name ||
    product.zone_name ||
    product.cities?.name ||
    product.city_name ||
    'ABUJA';

  const productCoords =
    product.latitude && product.longitude
      ? { latitude: product.latitude, longitude: product.longitude }
      : getZoneCoordinates(zoneTitle);

  let distanceText: string | null = null;
  let deliveryEtaText: string | null = null;
  if (userLocation && productCoords) {
    const rawDist = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      productCoords.latitude,
      productCoords.longitude
    );
    distanceText = formatDistance(rawDist);
    const { label } = calculateDeliveryEta(rawDist);
    deliveryEtaText = label;
  }

  return (
    <SafeView>
      {/* 1. Top Navbar Header matching App Design */}
      <View style={styles.header}>
        {/* Left: Linkup Brand */}
        <TouchableOpacity
          style={styles.brandGroup}
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
          activeOpacity={0.8}
        >
          <BrandLogo size="sm" />
          <View style={styles.brandTitleWrap}>
            <Text style={styles.brandTitle}>Linkup</Text>
            <Text style={styles.brandGlobal}>GLOBAL</Text>
          </View>
        </TouchableOpacity>

        {/* Right: Notifications, Cart & Sign In / Profile */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Bell size={20} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'CartTab' })}
            activeOpacity={0.7}
          >
            <ShoppingCart size={20} color="#0f172a" />
            {totalCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {totalCount > 9 ? '9+' : totalCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => setIsAccountMenuOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.avatarText}>
                {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        {/* 2. Hero Image Gallery with Floating Controls */}
        <View style={styles.galleryContainer}>
          <ScrollView
            ref={galleryScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleGalleryScroll}
            scrollEventThrottle={16}
            style={styles.galleryScroll}
          >
            {images.map((imgUri, idx) => (
              <Image
                key={idx}
                source={{ uri: imgUri }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Floating Back Button (Top Left) */}
          <TouchableOpacity
            style={styles.floatingNavBtnLeft}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Floating Share Button (Top Right) */}
          <TouchableOpacity
            style={styles.floatingNavBtnRight}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Share2 size={20} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Floating Pagination Dots Pill (Bottom Center / Left) */}
          {images.length > 1 && (
            <View style={styles.paginationPill}>
              {images.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.paginationDot,
                    idx === currentImageIndex
                      ? styles.paginationDotActive
                      : styles.paginationDotInactive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Floating Price Badge (Bottom Right) */}
          <View style={styles.floatingPriceBadge}>
            <Text style={styles.floatingPriceText}>
              ₦{finalPrice.toLocaleString('en-NG')}
            </Text>
          </View>
        </View>

        {/* 3. Product Info Section */}
        <View style={styles.infoSection}>
          {/* Stock Status Pill */}
          <View
            style={[
              styles.stockBadge,
              (product.inventory || 0) <= 0 && styles.outOfStockBadge,
            ]}
          >
            <Text
              style={[
                styles.stockBadgeText,
                (product.inventory || 0) <= 0 && styles.outOfStockBadgeText,
              ]}
            >
              {(product.inventory || 0) > 0
                ? `IN STOCK: ${product.inventory}`
                : 'OUT OF STOCK'}
            </Text>
          </View>

          {/* Product Title */}
          <Text style={styles.productTitle}>{product.title}</Text>

          {/* Rating Stars & Status */}
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
            <Text style={styles.ratingStatusText}>
              {averageRating > 0
                ? `${averageRating.toFixed(1)} (${reviews.length})`
                : 'New'}
            </Text>
          </View>

          {/* Optional Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <View style={styles.sizeSection}>
              <Text style={styles.sizeLabel}>SELECT SIZE</Text>
              <View style={styles.sizesRow}>
                {product.sizes.map((size: string) => {
                  const isSelected = selectedSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeBtn,
                        isSelected && styles.sizeBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSize(size);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.sizeBtnText,
                          isSelected && styles.sizeBtnTextActive,
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Dual Action Buttons: Add To Cart + Buy Now */}
          <View style={styles.dualButtonsRow}>
            <TouchableOpacity
              style={styles.addToCartBtn}
              onPress={handleAddToCart}
              activeOpacity={0.85}
            >
              <ShoppingCart size={18} color="#ffffff" strokeWidth={2.4} />
              <Text style={styles.addToCartText}>ADD TO CART</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buyNowBtn}
              onPress={handleBuyNow}
              activeOpacity={0.85}
            >
              <Text style={styles.buyNowBtnText}>BUY NOW</Text>
            </TouchableOpacity>
          </View>

          {/* Save to Wishlist Secondary Button */}
          <TouchableOpacity
            style={styles.wishlistBtn}
            onPress={handleToggleWishlist}
            activeOpacity={0.85}
          >
            <Heart
              size={18}
              color={isWishlisted ? '#ef4444' : '#475569'}
              fill={isWishlisted ? '#ef4444' : 'none'}
            />
            <Text
              style={[
                styles.wishlistBtnText,
                isWishlisted && styles.wishlistBtnTextActive,
              ]}
            >
              {isWishlisted ? 'Saved to Wishlist' : 'Save to Wishlist'}
            </Text>
          </TouchableOpacity>

          {/* Location & Distance Intel Banner */}
          <View style={styles.locationBanner}>
            <View style={styles.locationBannerIconWrap}>
              <MapPin size={16} color={colors.primary} />
            </View>
            <View style={styles.locationBannerTextWrap}>
              <View style={styles.locationBannerTitleRow}>
                <Text style={styles.locationBannerTitle} numberOfLines={1}>
                  {zoneTitle.split('(')[0].trim().toUpperCase()}
                </Text>
                {distanceText ? (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>{distanceText}</Text>
                  </View>
                ) : null}
              </View>
              {deliveryEtaText ? (
                <Text style={styles.locationBannerSubtitle}>
                  Estimated arrival time in {deliveryEtaText} to your current location
                </Text>
              ) : (
                <Text style={styles.locationBannerSubtitle}>
                  Verified marketplace delivery zone
                </Text>
              )}
            </View>
          </View>

          {/* 4. Trust Badges Row */}
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustItem}>
              <ShieldCheck size={20} color={colors.primary} />
              <Text style={styles.trustItemText}>AUTHENTICITY VERIFIED</Text>
            </View>
            <View style={styles.trustItem}>
              <Clock size={20} color={colors.primary} />
              <Text style={styles.trustItemText}>
                {deliveryEtaText ? `FAST DELIVERY (${deliveryEtaText})` : 'FAST DELIVERY'}
              </Text>
            </View>
          </View>

          {/* 5. About This Item */}
          <View style={styles.aboutSection}>
            <Text style={styles.aboutHeading}>About this item</Text>
            <Text style={styles.aboutParagraph}>
              {product.description && product.description.trim().length > 0
                ? product.description.trim()
                : 'No description provided for this item.'}
            </Text>
          </View>

          {/* 6. Offered By Seller Card */}
          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: product.id,
                recipientName: sellerDisplayName,
                productId: product.id,
              })
            }
            activeOpacity={0.85}
          >
            <View style={styles.sellerLeft}>
              {seller?.avatar_url ? (
                <Image
                  source={{ uri: seller.avatar_url }}
                  style={styles.sellerAvatarImg}
                />
              ) : (
                <View style={styles.sellerInitialBadge}>
                  <Text style={styles.sellerInitialText}>{sellerInitial}</Text>
                </View>
              )}
              <View style={styles.sellerMeta}>
                <Text style={styles.offeredByLabel}>OFFERED BY</Text>
                <Text style={styles.sellerNameText} numberOfLines={1}>{sellerDisplayName}</Text>
                {Boolean(seller?.bio?.trim()) && (
                  <Text style={styles.sellerBioText} numberOfLines={1}>
                    {seller.bio.trim()}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.sellerChatIconWrap}>
              <MessageCircle size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* 7. Report Product Row */}
          <TouchableOpacity
            style={styles.reportProductRow}
            onPress={() => setIsReportModalOpen(true)}
            activeOpacity={0.7}
          >
            <AlertCircle size={15} color="#64748b" />
            <Text style={styles.reportProductText}>Report Product</Text>
          </TouchableOpacity>

          {/* 8. Customer Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeaderRow}>
              <View>
                <Text style={styles.reviewsTitle}>Customer Reviews</Text>
                <Text style={styles.reviewsSubtitle}>
                  {reviews.length > 0
                    ? `${averageRating.toFixed(1)} / 5.0 (${reviews.length} ${
                        reviews.length === 1 ? 'review' : 'reviews'
                      })`
                    : 'No customer reviews yet'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setIsReviewModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.writeReviewBtnText}>Write a Review</Text>
              </TouchableOpacity>
            </View>

            {reviews.length > 0 ? (
              reviews.map((rev) => (
                <View key={rev.id} style={styles.reviewCard}>
                  <View style={styles.reviewCardTop}>
                    <Text style={styles.reviewerName}>
                      {rev.profiles?.display_name ||
                        rev.profiles?.full_name ||
                        'Verified Customer'}
                    </Text>
                    <View style={styles.reviewCardStars}>
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
              <View style={styles.emptyReviewsCard}>
                <Text style={styles.emptyReviewsText}>
                  Be the first to share your experience with this product!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 9. Floating Support & Send Buttons (Positioned Above Sticky Checkout Bar) */}
      <TouchableOpacity
        style={[
          styles.floatingSupportBtn,
          { bottom: Math.max(insets.bottom, 12) + 76 },
        ]}
        onPress={() => navigation.navigate('Support')}
        activeOpacity={0.8}
      >
        <Headphones size={22} color="#ffffff" strokeWidth={2.4} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.floatingSendBtn,
          { bottom: Math.max(insets.bottom, 12) + 76 },
        ]}
        onPress={() =>
          navigation.navigate('MainTabs', { screen: 'SendTab', params: {} })
        }
        activeOpacity={0.8}
      >
        <Send size={18} color="#ffffff" strokeWidth={2.4} />
        <Text style={styles.floatingSendText}>SEND</Text>
      </TouchableOpacity>

      {/* 10. Sticky Bottom Checkout Bar (Fixed at bottom) */}
      <View
        style={[
          styles.bottomCheckoutBar,
          { bottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.checkoutPriceColumn}>
          <Text style={styles.checkoutFeeLabel}>
            TOTAL DUE (+{Math.round(markupRate * 100)}% FEE)
          </Text>
          <Text style={styles.checkoutPriceValue}>
            ₦{finalPrice.toLocaleString('en-NG')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBuyNowBtn}
          onPress={handleBuyNow}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBuyNowText}>BUY NOW</Text>
        </TouchableOpacity>
      </View>

      {/* 11. Write Review Modal */}
      <AppModal
        visible={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Leave a Review"
        subtitle="Share your feedback with other shoppers"
        primaryButton={{
          label: submittingReview ? 'Submitting...' : 'Submit Review',
          onPress: handleSubmitReview,
          loading: submittingReview,
          disabled: submittingReview,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setIsReviewModalOpen(false),
          variant: 'outline',
        }}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalFieldLabel}>Rating</Text>
          <View style={styles.starPickerRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedRating(star);
                }}
                style={styles.starPickItem}
              >
                <Star
                  size={32}
                  color="#f59e0b"
                  fill={star <= selectedRating ? '#f59e0b' : 'none'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalFieldLabel, { marginTop: 14 }]}>
            Your Review
          </Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="Tell us about the product quality, fit, and speed of delivery..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            value={commentText}
            onChangeText={setCommentText}
          />
        </View>
      </AppModal>

      {/* 12. Report Product Modal */}
      <AppModal
        visible={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Report Product"
        subtitle="Help us keep the marketplace safe and trustworthy"
        variant="warning"
        primaryButton={{
          label: submittingReport ? 'Submitting...' : 'Submit Report',
          onPress: handleSubmitReport,
          loading: submittingReport,
          disabled: submittingReport,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setIsReportModalOpen(false),
          variant: 'outline',
        }}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalFieldLabel}>Reason for Report</Text>
          <View style={styles.reasonPillsRow}>
            {['Counterfeit / Fake', 'Incorrect Information', 'Prohibited Item', 'Defective'].map(
              (r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.reasonPill,
                    reportReason === r && styles.reasonPillActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReportReason(r);
                  }}
                >
                  <Text
                    style={[
                      styles.reasonPillText,
                      reportReason === r && styles.reasonPillTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <Text style={[styles.modalFieldLabel, { marginTop: 14 }]}>
            Additional Details
          </Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="Describe the issue you noticed with this listing..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            value={reportDetails}
            onChangeText={setReportDetails}
          />
        </View>
      </AppModal>

      {/* Account Flyout Menu Modal */}
      <AccountMenuModal
        visible={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
        accentColor="#E86129"
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  // Center / Loading states
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 12,
  },
  backBtnPill: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  backBtnPillText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },

  // 1. Top Navbar Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitleWrap: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    lineHeight: 18,
  },
  brandGlobal: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    padding: 6,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  signInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  // Main Scroll Container
  scrollContainer: {
    backgroundColor: '#ffffff',
  },

  // 2. Hero Image Gallery
  galleryContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#f1f5f9',
  },
  galleryScroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  galleryImage: {
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
  paginationDot: {
    height: 5,
    borderRadius: 2.5,
  },
  paginationDotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  paginationDotInactive: {
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

  // 3. Product Info Section
  infoSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  outOfStockBadge: {
    backgroundColor: '#fef2f2',
  },
  stockBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outOfStockBadgeText: {
    color: '#dc2626',
  },
  productTitle: {
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
  ratingStatusText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },

  // Sizes Row
  sizeSection: {
    marginTop: 16,
  },
  sizeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  sizeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sizeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  sizeBtnTextActive: {
    color: colors.primary,
  },

  // Dual Action Buttons: Add To Cart + Buy Now
  dualButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  addToCartBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  buyNowBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Save to Wishlist Button
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
  },
  wishlistBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  wishlistBtnTextActive: {
    color: '#ef4444',
  },

  // Location & Distance Banner
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    marginTop: 16,
  },
  locationBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBannerTextWrap: {
    flex: 1,
  },
  locationBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  locationBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  distanceBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  distanceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  locationBannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 15,
  },

  // 4. Trust Badges Row
  trustBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 14,
    marginVertical: 20,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustItemText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.5,
  },

  // 5. About this item
  aboutSection: {
    marginBottom: 18,
  },
  aboutHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  aboutParagraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },

  // 6. Offered By Seller Card
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  sellerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sellerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  sellerInitialBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitialText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  sellerMeta: {
    flex: 1,
  },
  offeredByLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  sellerNameText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  sellerBioText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  sellerChatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Report Product Row
  reportProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  reportProductText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },

  // 8. Reviews Section
  reviewsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 18,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  reviewsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  reviewsSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  writeReviewBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  writeReviewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  reviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewCardStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyReviewsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyReviewsText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // 9. Floating Buttons
  floatingSupportBtn: {
    position: 'absolute',
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  floatingSendBtn: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  floatingSendText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 1,
    letterSpacing: 0.5,
  },

  // 10. Sticky Bottom Checkout Bar
  bottomCheckoutBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 90,
  },
  checkoutPriceColumn: {
    flexDirection: 'column',
  },
  checkoutFeeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.8,
  },
  checkoutPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  checkoutBuyNowBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  checkoutBuyNowText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Modal Styles
  modalContent: {
    paddingVertical: 6,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  starPickItem: {
    padding: 6,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    textAlignVertical: 'top',
    height: 90,
    backgroundColor: '#f8fafc',
  },
  reasonPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  reasonPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  reasonPillTextActive: {
    color: colors.primary,
  },
});
