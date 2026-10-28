import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { ProductCard, ProductItem } from '../../../components/ui/ProductCard';
import { AppModal, ModalVariant } from '../../../components/ui/AppModal';
import { AccountMenuModal } from '../../user/components/AccountMenuModal';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { colors } from '../../../theme/colors';
import { useGeolocation } from '../../logistics/hooks/useGeolocation';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Bell,
  ShoppingCart,
  SlidersHorizontal,
  Grid,
  MapPin,
  Headphones,
  Send,
  Sparkles,
  ShoppingBag,
  Shirt,
  UtensilsCrossed,
  Heart,
  Laptop,
  ChevronDown,
  LayoutDashboard,
  Store,
  ArrowRight,
  Megaphone,
  Truck,
  ShieldCheck,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
}

interface ZoneItem {
  id: string;
  name: string;
  is_active?: boolean;
}

const PAGE_SIZE = 20;

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const { user, profile, roles, activeRole, setActiveRole } = useAuth();
  const { totalCount, addToCart } = useCart();

  const userRoles = useMemo(() => {
    const list = [...(roles || [])];
    if (profile?.role && !list.includes(profile.role)) list.push(profile.role);
    if (activeRole && !list.includes(activeRole)) list.push(activeRole);
    return list;
  }, [roles, profile?.role, activeRole]);

  const isSeller = userRoles.includes('seller');
  const isPromoter = userRoles.includes('promoter');
  const isLogistics = userRoles.includes('logistics');
  const isAdmin = userRoles.includes('admin');

  // Main dashboard determination based on activeRole, then priority: promoter > seller > logistics > admin > buyer
  const mainDashboard = useMemo(() => {
    if (!user) return null;

    if (activeRole === 'promoter' || (!activeRole && isPromoter && !isSeller)) {
      return {
        screen: 'PromoterDashboard' as keyof RootStackParamList,
        title: 'Promoter Hub',
        activeTitle: 'Promoter Mode Active',
        subtitle: 'Track affiliate links, clicks & payouts',
        badge: 'PROMOTER',
        icon: Megaphone,
        role: 'promoter',
      };
    }

    if (activeRole === 'seller' || (!activeRole && isSeller)) {
      return {
        screen: 'SellerDashboard' as keyof RootStackParamList,
        title: 'Seller Dashboard',
        activeTitle: 'Seller Mode Active',
        subtitle: 'Manage inventory, orders & payouts',
        badge: 'SELLER',
        icon: Store,
        role: 'seller',
      };
    }

    if (activeRole === 'logistics' || (!activeRole && isLogistics)) {
      return {
        screen: 'LogisticsDashboard' as keyof RootStackParamList,
        title: 'Rider Hub',
        activeTitle: 'Logistics Fleet Active',
        subtitle: 'View delivery missions & dispatch feed',
        badge: 'RIDER',
        icon: Truck,
        role: 'logistics',
      };
    }

    if (activeRole === 'admin' || (!activeRole && isAdmin)) {
      return {
        screen: 'AdminDashboard' as keyof RootStackParamList,
        title: 'Admin Portal',
        activeTitle: 'Admin Portal Active',
        subtitle: 'Platform analytics, users & settings',
        badge: 'ADMIN',
        icon: ShieldCheck,
        role: 'admin',
      };
    }

    // Default authenticated buyer: buyers do NOT have a dashboard in the mobile version
    return null;
  }, [user, activeRole, isPromoter, isSeller, isLogistics, isAdmin]);

  const handleNavigateMainDashboard = useCallback(() => {
    if (!mainDashboard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (mainDashboard.role) {
      setActiveRole(mainDashboard.role);
    }
    navigation.navigate(mainDashboard.screen as any);
  }, [mainDashboard, navigation, setActiveRole]);
  const {
    position: userLocation,
    setPosition: setUserLocation,
    refresh: refreshLocation,
  } = useGeolocation();

  // Account Flyout Menu State
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);

  // Filter & Data States
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Products');
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markupRate, setMarkupRate] = useState<number>(0.10); // Default 10% platform product markup
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);

  // Pagination States
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Sync category if navigated from Menu screen with category param
  useEffect(() => {
    if (route.params?.category) {
      setSelectedCategory(route.params.category);
    }
  }, [route.params?.category]);

  // 1. Fetch Categories & Delivery Zones & Fee Config from real Supabase tables
  const fetchMetadata = async () => {
    try {
      const [catsRes, zonesRes, feeRes] = await Promise.all([
        supabase.from('categories').select('id, name, slug').order('name'),
        supabase.from('delivery_zones').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('fee_config').select('*').eq('is_active', true),
      ]);

      if (catsRes.data) {
        let cats = catsRes.data as CategoryItem[];
        // Sort food/restaurants to front if present
        const foodIdx = cats.findIndex(c => c.name.toLowerCase().includes('restaurant') || c.name.toLowerCase().includes('food'));
        if (foodIdx > -1) {
          const foodCat = cats.splice(foodIdx, 1)[0];
          cats.unshift(foodCat);
        }
        setCategories(cats);
      }

      if (zonesRes.data) {
        setZones(zonesRes.data as ZoneItem[]);
      }

      if (feeRes.data) {
        const prodFee = feeRes.data.find((f: any) => f.fee_type === 'platform_product');
        if (prodFee?.rate !== undefined) {
          setMarkupRate(prodFee.rate);
        }
      }
    } catch (err) {
      console.warn('[HomeScreen] Metadata fetch error:', err);
    }
  };

  // 2. Fetch User Wishlist Likes if logged in
  const fetchUserLikes = async () => {
    if (!user) {
      setUserLikes(new Set());
      return;
    }
    try {
      const { data } = await supabase
        .from('likes')
        .select('product_id')
        .eq('user_id', user.id);
      if (data) {
        setUserLikes(new Set(data.map((l: any) => l.product_id)));
      }
    } catch (err) {
      console.warn('[HomeScreen] Likes fetch error:', err);
    }
  };

  // 3. Fetch Real Products from Supabase with joins & filters
  const fetchProducts = async (pageToFetch = 0, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const from = pageToFetch * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select(`
          id, title, price, images, category, inventory, likes_count, seller_id, 
          latitude, longitude, avg_rating, reviews_count,
          delivery_zones:zone_id(name),
          cities:city_id(name)
        `)
        .eq('is_active', true)
        .gt('inventory', 0)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Category filter
      if (selectedCategory !== 'All Products') {
        query = query.eq('category', selectedCategory);
      }

      // Zone filter
      if (selectedZone !== 'All Zones') {
        const matchingZone = zones.find(z => z.name === selectedZone);
        if (matchingZone) {
          query = query.eq('zone_id', matchingZone.id);
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[HomeScreen] Supabase fetch products error:', error.message);
      }
      if (!error && data) {
        const multiplier = 1 + markupRate;
        const mappedProducts: ProductItem[] = data.map((p: any) => ({
          ...p,
          price: p.price * multiplier,
          original_price: null,
          zone_name: p.delivery_zones?.name || null,
          city_name: p.cities?.name || null,
        }));

        if (isLoadMore) {
          setProducts(prev => [...prev, ...mappedProducts]);
          setPage(pageToFetch);
        } else {
          setProducts(mappedProducts);
          setPage(0);
        }

        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('[HomeScreen] Fetch products error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchProducts(page + 1, true);
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchUserLikes();
  }, [user]);

  useEffect(() => {
    setPage(0);
    fetchProducts(0, false);
  }, [selectedCategory, selectedZone, searchQuery, markupRate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetadata();
    fetchUserLikes();
    fetchProducts(0, false);
  };

  // Toggle Wishlist Like
  const handleToggleLike = async (productId: string) => {
    if (!user) {
      showAlert({
        variant: 'info',
        title: 'Sign In Required',
        subtitle: 'Wishlist & Saved Items',
        message: 'Please sign in to your Linkup account to save products to your wishlist.',
        primaryButtonText: 'Sign In / Register',
        onPrimaryPress: () => {
          closeAlert();
          navigation.navigate('Login');
        },
        secondaryButtonText: 'Cancel',
      });
      return;
    }

    const isCurrentlyLiked = userLikes.has(productId);
    const updated = new Set(userLikes);

    if (isCurrentlyLiked) {
      updated.delete(productId);
      setUserLikes(updated);
      await supabase.from('likes').delete().match({ user_id: user.id, product_id: productId });
    } else {
      updated.add(productId);
      setUserLikes(updated);
      await supabase.from('likes').insert({ user_id: user.id, product_id: productId });
    }
  };

  // Detect Location & Auto-Select Zone with AppModal (#E86129)
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    message: string;
    variant?: ModalVariant;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }>({
    visible: false,
    title: '',
    subtitle: '',
    message: '',
    variant: 'info',
  });

  const showAlert = (config: {
    title: string;
    subtitle?: string;
    message: string;
    type?: 'error' | 'success' | 'warning' | 'info' | 'location';
    variant?: ModalVariant;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }) => {
    let resolvedVariant: ModalVariant = config.variant || 'default';
    if (config.type === 'error') resolvedVariant = 'danger';
    else if (config.type === 'warning' || config.type === 'location') resolvedVariant = 'warning';
    else if (config.type === 'info') resolvedVariant = 'info';
    else if (config.type === 'success') resolvedVariant = 'success';

    setAlertConfig({
      visible: true,
      title: config.title,
      subtitle: config.subtitle,
      message: config.message,
      variant: resolvedVariant,
      primaryButtonText: config.primaryButtonText,
      onPrimaryPress: config.onPrimaryPress,
      secondaryButtonText: config.secondaryButtonText,
      onSecondaryPress: config.onSecondaryPress,
    });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleDetectLocation = async () => {
    try {
      setDetectingLocation(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Check if device location services are enabled
      const isServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isServicesEnabled) {
        setDetectingLocation(false);
        showAlert({
          type: 'location',
          title: 'Location Disabled',
          message: 'Please enable Location / GPS on your device to detect your delivery zone.',
          primaryButtonText: 'OK, Got It',
        });
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectingLocation(false);
        showAlert({
          type: 'location',
          title: 'Permission Required',
          message: 'Please allow location permissions to auto-detect your delivery zone.',
          primaryButtonText: 'Understood',
        });
        return;
      }

      let loc: Location.LocationObject | null = null;
      try {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
        ]);
      } catch {
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
      }

      if (!loc) {
        throw new Error('Could not acquire GPS position.');
      }

      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: Date.now(),
      });

      let detectedName = '';
      try {
        const geoResults = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geoResults && geoResults.length > 0) {
          const address = geoResults[0];
          detectedName = address.district || address.city || address.subregion || address.name || '';
        }
      } catch (nativeErr) {
        console.warn('[HomeScreen] Native geocode fallback:', nativeErr);
      }

      // Match with delivery zones
      const matched = zones.find(z =>
        detectedName.toLowerCase().includes(z.name.toLowerCase().trim()) ||
        z.name.toLowerCase().includes(detectedName.toLowerCase().trim())
      );

      if (matched) {
        setSelectedZone(matched.name);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert({
          type: 'location',
          title: 'Zone Detected',
          message: `Switched your active marketplace delivery zone to ${matched.name}.`,
          primaryButtonText: 'Explore Zone Products',
        });
      } else {
        showAlert({
          type: 'info',
          title: 'Location Found',
          message: `You are near ${detectedName || 'Abuja'}. Showing all nearby verified zones.`,
          primaryButtonText: 'View Products',
        });
      }
    } catch (err: any) {
      showAlert({
        type: 'location',
        title: 'Location Notice',
        message: 'Could not detect your exact location right now. Please verify device GPS is active.',
        primaryButtonText: 'OK',
      });
    } finally {
      setDetectingLocation(false);
    }
  };

  // Category Icon helper
  const renderCategoryIcon = (catName: string, isActive: boolean) => {
    const iconColor = isActive ? '#FFFFFF' : '#64748B';
    const lower = catName.toLowerCase();
    if (lower.includes('all')) return <Grid size={13} color={iconColor} />;
    if (lower.includes('food') || lower.includes('restaurant')) return <UtensilsCrossed size={13} color={iconColor} />;
    if (lower.includes('cloth') || lower.includes('fashion') || lower.includes('shoe')) return <Shirt size={13} color={iconColor} />;
    if (lower.includes('health') || lower.includes('beauty')) return <Heart size={13} color={iconColor} />;
    if (lower.includes('supermarket') || lower.includes('grocery')) return <ShoppingBag size={13} color={iconColor} />;
    return <Sparkles size={13} color={iconColor} />;
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Main Header Bar */}
      <View style={styles.header}>
        {/* Left: Linkup Brand */}
        <TouchableOpacity
          style={styles.brandGroup}
          onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' })}
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
            onPress={() => navigation.navigate('MainTabs', { screen: 'CartTab', params: {} })}
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
            <View style={styles.headerProfileContainer}>
              <View style={styles.headerDivider} />
              <TouchableOpacity
                style={styles.profileTriggerBtn}
                onPress={() => setIsAccountMenuOpen(true)}
                activeOpacity={0.75}
              >
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {(profile?.display_name || profile?.full_name || user.email || 'B').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.profileMetaWrap}>
                  <Text style={styles.profileNameText} numberOfLines={1}>
                    {profile?.display_name || (profile?.full_name ? profile.full_name.split(' ')[0] : (activeRole ? activeRole.charAt(0).toUpperCase() + activeRole.slice(1) : 'Buyer'))}
                  </Text>
                  <View style={styles.premiumTagRow}>
                    <View style={styles.premiumDot} />
                    <Text style={styles.premiumText}>{mainDashboard?.badge || (activeRole ? activeRole.toUpperCase() : 'BUYER')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
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

      {/* Active Dashboard Quick Return Bar for Authenticated Users */}
      {Boolean(user && mainDashboard) && (
        <View style={styles.sellerReturnBarWrap}>
          <TouchableOpacity
            style={styles.sellerReturnBar}
            onPress={handleNavigateMainDashboard}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Navigate to ${mainDashboard.title}`}
          >
            <View style={styles.sellerReturnLeft}>
              <View style={styles.sellerReturnIconBadge}>
                {React.createElement(mainDashboard.icon, {
                  size: 15,
                  color: '#ffffff',
                  strokeWidth: 2.5,
                })}
              </View>
              <View style={styles.sellerReturnTextCol}>
                <Text style={styles.sellerReturnTitle} numberOfLines={1}>
                  {mainDashboard.activeTitle}
                </Text>
                <Text style={styles.sellerReturnSub} numberOfLines={1}>
                  {mainDashboard.subtitle}
                </Text>
              </View>
            </View>
            <View style={styles.sellerReturnCtaPill}>
              {React.createElement(mainDashboard.icon, {
                size: 12,
                color: '#ffffff',
                strokeWidth: 2.5,
              })}
              <Text style={styles.sellerReturnCtaText}>{mainDashboard.title}</Text>
              <ArrowRight size={13} color="#ffffff" strokeWidth={2.6} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input Bar with Filter Button */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Search size={17} color="#94a3b8" />
          <TextInput
            placeholder="Search products, brands..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'SearchTab', params: {} })}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={17} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Horizontal Categories Nav */}
      <View style={styles.categoriesNav}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {/* All Products Tab */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedCategory('All Products');
            }}
            style={[
              styles.categoryPill,
              selectedCategory === 'All Products' && styles.categoryPillActive,
            ]}
            activeOpacity={0.75}
          >
            {renderCategoryIcon('All Products', selectedCategory === 'All Products')}
            <Text
              style={[
                styles.categoryText,
                selectedCategory === 'All Products' && styles.categoryTextActive,
              ]}
            >
              All Products
            </Text>
          </TouchableOpacity>

          {/* Dynamic Categories from Supabase */}
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(cat.name);
                }}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                activeOpacity={0.75}
              >
                {renderCategoryIcon(cat.name, isActive)}
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Horizontal Delivery Zones & Location Detect */}
      <View style={styles.zonesNav}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.zonesScroll}
        >
          {/* Detect Location Button */}
          <TouchableOpacity
            style={styles.detectLocationBtn}
            onPress={handleDetectLocation}
            disabled={detectingLocation}
            activeOpacity={0.75}
          >
            {detectingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MapPin size={13} color="#0f172a" />
            )}
            <Text style={styles.detectLocationText}>
              {detectingLocation ? 'DETECTING...' : 'DETECT LOCATION'}
            </Text>
          </TouchableOpacity>

          {/* All Zones Pill */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedZone('All Zones');
            }}
            style={[
              styles.zonePill,
              selectedZone === 'All Zones' && styles.zonePillActive,
            ]}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.zoneText,
                selectedZone === 'All Zones' && styles.zoneTextActive,
              ]}
            >
              All Zones
            </Text>
          </TouchableOpacity>

          {/* Dynamic Delivery Zones from Supabase */}
          {zones.map((zone) => {
            const isActive = selectedZone === zone.name;
            return (
              <TouchableOpacity
                key={zone.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedZone(zone.name);
                }}
                style={[styles.zonePill, isActive && styles.zonePillActive]}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.zoneText, isActive && styles.zoneTextActive]}
                >
                  {zone.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2-Column Product Grid */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading marketplace items...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              userLocation={userLocation}
              isLiked={userLikes.has(item.id)}
              onPress={() =>
                navigation.navigate('ProductDetail', { id: item.id, title: item.title })
              }
              onLike={handleToggleLike}
              onAddToCart={() => addToCart(item.id, 1)}
            />
          )}
          ListFooterComponent={
            products.length > 0 ? (
              <View style={styles.paginationFooter}>
                {hasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                    activeOpacity={0.8}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreBtnText}>Load More Products</Text>
                        <ChevronDown size={16} color="#ffffff" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.endOfResults}>
                    <View style={styles.endLine} />
                    <Text style={styles.endText}>Showing all {products.length} products</Text>
                    <View style={styles.endLine} />
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShoppingBag size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubtitle}>
                Try selecting "All Products" or a different delivery zone.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button: Left Support Headset */}
      <TouchableOpacity
        style={styles.floatingSupportBtn}
        onPress={() => navigation.navigate('Support')}
        activeOpacity={0.8}
        accessibilityLabel="Contact customer support"
      >
        <Headphones size={22} color="#ffffff" strokeWidth={2.4} />
      </TouchableOpacity>

      {/* Modern Professional Bottom-Sheet Modal */}
      <AppModal
        visible={alertConfig.visible}
        onClose={closeAlert}
        title={alertConfig.title}
        subtitle={alertConfig.subtitle}
        variant={alertConfig.variant}
        primaryButton={
          alertConfig.primaryButtonText
            ? {
              label: alertConfig.primaryButtonText,
              onPress: () => {
                if (alertConfig.onPrimaryPress) {
                  alertConfig.onPrimaryPress();
                } else {
                  closeAlert();
                }
              },
            }
            : undefined
        }
        secondaryButton={
          alertConfig.secondaryButtonText
            ? {
              label: alertConfig.secondaryButtonText,
              onPress: () => {
                if (alertConfig.onSecondaryPress) {
                  alertConfig.onSecondaryPress();
                } else {
                  closeAlert();
                }
              },
              variant: 'outline',
            }
            : undefined
        }
      >
        <Text style={styles.modalMessageText}>{alertConfig.message}</Text>
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
  safeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topStatusStrip: {
    height: Platform.OS === 'android' ? 0 : 2,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primary, // Orange #EB7D30
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: colors.primary, // Orange #EB7D30
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
  headerProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 1,
  },
  profileTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 2,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileMetaWrap: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  profileNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 16,
  },
  premiumTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  premiumDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E86129',
  },
  premiumText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
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
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesNav: {
    paddingVertical: 6,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: colors.primary, // Orange #EB7D30
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  zonesNav: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  zonesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  detectLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detectLocationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  zonePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  zonePillActive: {
    backgroundColor: colors.primary, // Orange #EB7D30
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  zoneTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  productList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 90,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
  },
  floatingSupportBtn: {
    position: 'absolute',
    bottom: 82,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary, // Orange #EB7D30
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  floatingSendBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary, // Orange #EB7D30
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
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
  paginationFooter: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 200,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  endOfResults: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
  },
  endLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  endText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 12,
  },
  sellerReturnBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
  },
  sellerReturnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(233, 111, 40, 0.35)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
    gap: 10,
  },
  sellerReturnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sellerReturnIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(233, 111, 40, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(233, 111, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerReturnTextCol: {
    flex: 1,
  },
  sellerReturnTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  sellerReturnSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  sellerReturnCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  sellerReturnCtaText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
