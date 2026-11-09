import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { ProductCard, ProductItem } from '../../../components/ui/ProductCard';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useGeolocation } from '../../logistics/hooks/useGeolocation';
import { supabase } from '../../../services/supabase';
import { Heart, ArrowLeft, ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

export function WishlistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { position: userLocation } = useGeolocation();

  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          id,
          product_id,
          product:products(
            id, title, price, images, category, seller_id, latitude, longitude,
            delivery_zones:zone_id(name),
            cities:city_id(name)
          )
        `)
        .eq('user_id', user.id);

      if (!error && data) {
        const mapped = data
          .map((w: any) => {
            if (!w.product) return null;
            return {
              ...w.product,
              zone_name: w.product.delivery_zones?.name || null,
              city_name: w.product.cities?.name || null,
            };
          })
          .filter(Boolean) as ProductItem[];
        setItems(mapped);
      }
    } catch (e) {
      console.warn('Error fetching wishlist:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWishlist();
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.colWrapper}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              userLocation={userLocation}
              isLiked={true}
              onPress={() => navigation.navigate('ProductDetail', { id: item.id, title: item.title })}
              onAddToCart={() =>
                addToCart({
                  id: item.id,
                  productId: item.id,
                  title: item.title,
                  price: item.price,
                  image: item.images?.[0],
                  sellerId: item.seller_id || '',
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Heart size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
              <Text style={styles.emptySubtitle}>Tap the heart icon on any product to save items you love.</Text>
            </View>
          }
        />
      )}
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  list: {
    padding: 16,
  },
  colWrapper: {
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
  },
});
