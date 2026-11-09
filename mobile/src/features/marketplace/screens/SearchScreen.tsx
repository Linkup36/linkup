import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { ProductCard, ProductItem } from '../../../components/ui/ProductCard';
import { Button } from '../../../components/ui/Button';
import { AppModal } from '../../../components/ui/AppModal';
import { supabase } from '../../../services/supabase';
import { useCart } from '../../../context/CartContext';
import { colors } from '../../../theme/colors';
import { useGeolocation } from '../../logistics/hooks/useGeolocation';
import { Search, Filter, X, SlidersHorizontal, ArrowUpDown, ChevronDown } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import * as Haptics from 'expo-haptics';

const CONDITIONS = ['All', 'Brand New', 'Refurbished', 'Used'];
const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

const PAGE_SIZE = 20;

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addToCart } = useCart();
  const { position: userLocation } = useGeolocation();

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [sortOption, setSortOption] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [markupRate, setMarkupRate] = useState<number>(0.10);

  const [results, setResults] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch real categories and markup
  useEffect(() => {
    async function loadMeta() {
      try {
        const [catsRes, feeRes] = await Promise.all([
          supabase.from('categories').select('name').order('name'),
          supabase.from('fee_config').select('*').eq('is_active', true),
        ]);
        if (catsRes.data) {
          setCategories(['All', ...catsRes.data.map((c: any) => c.name)]);
        }
        if (feeRes.data) {
          const prodFee = feeRes.data.find((f: any) => f.fee_type === 'platform_product');
          if (prodFee?.rate !== undefined) setMarkupRate(prodFee.rate);
        }
      } catch (err) {
        console.warn('[SearchScreen] Load meta error:', err);
      }
    }
    loadMeta();
  }, []);

  const executeSearch = async (pageToFetch = 0, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const from = pageToFetch * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let qb = supabase
        .from('products')
        .select(`
          id, title, price, images, category, seller_id, latitude, longitude,
          delivery_zones:zone_id(name),
          cities:city_id(name)
        `)
        .eq('is_active', true)
        .gt('inventory', 0);

      if (query.trim()) {
        qb = qb.ilike('title', `%${query.trim()}%`);
      }

      if (selectedCategory !== 'All') {
        qb = qb.eq('category', selectedCategory);
      }

      if (minPrice) {
        const min = parseFloat(minPrice);
        if (!isNaN(min)) qb = qb.gte('price', min);
      }

      if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (!isNaN(max)) qb = qb.lte('price', max);
      }

      switch (sortOption) {
        case 'price_asc':
          qb = qb.order('price', { ascending: true });
          break;
        case 'price_desc':
          qb = qb.order('price', { ascending: false });
          break;
        default:
          qb = qb.order('created_at', { ascending: false });
          break;
      }

      qb = qb.range(from, to);

      const { data, error } = await qb;
      if (error) {
        console.error('[SearchScreen] Supabase search error:', error.message);
      }
      if (!error && data) {
        const mult = 1 + markupRate;
        const mapped: ProductItem[] = data.map((p: any) => ({
          ...p,
          price: p.price * mult,
          original_price: null,
          zone_name: p.delivery_zones?.name || null,
          city_name: p.cities?.name || null,
        }));
        
        if (isLoadMore) {
          setResults(prev => [...prev, ...mapped]);
          setPage(pageToFetch);
        } else {
          setResults(mapped);
          setPage(0);
        }

        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('[SearchScreen] Search failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    executeSearch(page + 1, true);
  };

  useEffect(() => {
    executeSearch(0, false);
  }, [selectedCategory, selectedCondition, sortOption]);

  const handleApplyFilters = () => {
    setIsFilterModalOpen(false);
    executeSearch(0, false);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedCondition('All');
    setSortOption('newest');
    setMinPrice('');
    setMaxPrice('');
    setIsFilterModalOpen(false);
    executeSearch(0, false);
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Top Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchInputWrap}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            placeholder="Search all marketplace products..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => executeSearch(0, false)}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); executeSearch(0, false); }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setIsFilterModalOpen(true)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Horizontal Category Strip */}
      <View style={styles.categoryWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.catChip, isActive && styles.catChipActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.catChipText,
                    isActive && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results View */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.colWrapper}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              userLocation={userLocation}
              onPress={() =>
                navigation.navigate('ProductDetail', { id: item.id, title: item.title })
              }
              onAddToCart={() => addToCart(item.id, 1)}
            />
          )}
          ListFooterComponent={
            results.length > 0 ? (
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
                    <Text style={styles.endText}>Showing all {results.length} products</Text>
                    <View style={styles.endLine} />
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Search size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No matching products</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search keywords, category filters, or price range.
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Bottom Sheet Modal */}
      <AppModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filter Products"
        subtitle="Refine marketplace search results"
      >
        {/* Sort By */}
        <Text style={styles.filterSectionTitle}>Sort Order</Text>
        <View style={styles.pillWrap}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSortOption(opt.value)}
              style={[
                styles.filterPill,
                sortOption === opt.value && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  sortOption === opt.value && styles.filterPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Range */}
        <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
          Price Range (₦)
        </Text>
        <View style={styles.priceInputsRow}>
          <TextInput
            placeholder="Min"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
            style={styles.priceInput}
          />
          <Text style={styles.priceDash}>-</Text>
          <TextInput
            placeholder="Max"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
            style={styles.priceInput}
          />
        </View>

        {/* Condition */}
        <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
          Condition
        </Text>
        <View style={styles.pillWrap}>
          {CONDITIONS.map((cond) => (
            <TouchableOpacity
              key={cond}
              onPress={() => setSelectedCondition(cond)}
              style={[
                styles.filterPill,
                selectedCondition === cond && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCondition === cond && styles.filterPillTextActive,
                ]}
              >
                {cond}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.filterActions}>
          <Button
            title="Reset"
            variant="outline"
            style={{ flex: 1 }}
            onPress={handleResetFilters}
          />
          <Button
            title="Apply"
            style={{ flex: 1 }}
            onPress={handleApplyFilters}
          />
        </View>
      </AppModal>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryWrap: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catChipActive: {
    backgroundColor: colors.primary, // Orange #EB7D30
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
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
    maxWidth: 260,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: colors.primary, // Orange #EB7D30
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  priceInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  priceDash: {
    fontSize: 16,
    color: '#94a3b8',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
});
