import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  Package,
  TrendingUp,
  Share2,
  Filter,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { ProductToPromote } from '../hooks/usePromoterData';

const BRAND_ORANGE = '#EB7D30';

interface PromoterMarketplaceTabProps {
  products: ProductToPromote[];
  loading: boolean;
  onPromoteProduct: (product: ProductToPromote) => void;
}

export function PromoterMarketplaceTab({
  products,
  loading,
  onPromoteProduct,
}: PromoterMarketplaceTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high_val' | 'popular'>('all');

  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    if (selectedFilter === 'high_val') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (selectedFilter === 'popular') {
      result = [...result].sort((a, b) => (b.inventory || 0) - (a.inventory || 0));
    }

    return result;
  }, [products, searchQuery, selectedFilter]);

  return (
    <View style={styles.container}>
      {/* Intro explanation card */}
      <View style={styles.introCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color={BRAND_ORANGE} />
          <Text style={styles.introTitle}>Earn 5% On Every Product</Text>
        </View>
        <Text style={styles.introSub}>
          Select any verified marketplace item below to generate your unique tracking link. Share it with buyers on WhatsApp, TikTok, or Instagram.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products by title or category..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700' }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setSelectedFilter('all');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All Products ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'high_val' && styles.filterChipActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setSelectedFilter('high_val');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'high_val' && styles.filterChipTextActive,
            ]}
          >
            Highest Payout 💰
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'popular' && styles.filterChipActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setSelectedFilter('popular');
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'popular' && styles.filterChipTextActive,
            ]}
          >
            Popular 🔥
          </Text>
        </TouchableOpacity>
      </View>

      {/* Products Feed */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={BRAND_ORANGE} />
          <Text style={styles.loadingText}>Fetching marketplace products...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Package size={36} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySub}>
            Try adjusting your search query or check back soon for newly listed inventory.
          </Text>
        </View>
      ) : (
        filteredProducts.map((p) => {
          const commPercent = p.commission_percent || 5;
          const commAmt = Math.round((p.price * commPercent) / 100);

          return (
            <View key={p.id} style={styles.productCard}>
              <Image
                source={{
                  uri:
                    p.images?.[0] ||
                    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
                }}
                style={styles.productThumb}
              />

              <View style={styles.productInfo}>
                <View style={styles.topRow}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                </View>

                <Text style={styles.productPrice}>₦{p.price.toLocaleString()}</Text>

                {/* Commission Pill */}
                <View style={styles.commissionPill}>
                  <TrendingUp size={11} color={BRAND_ORANGE} />
                  <Text style={styles.commissionText}>
                    Earn ₦{commAmt.toLocaleString()} ({commPercent}%)
                  </Text>
                </View>

                <View style={styles.footerRow}>
                  <Text style={styles.stockText}>
                    {p.inventory ? `${p.inventory} in stock` : 'Available'}
                  </Text>

                  <TouchableOpacity
                    style={styles.promoteBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPromoteProduct(p);
                    }}
                    activeOpacity={0.85}
                  >
                    <Share2 size={13} color="#FFFFFF" />
                    <Text style={styles.promoteBtnText}>Promote</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  introCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  introTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  introSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  filterChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterChipActive: {
    backgroundColor: BRAND_ORANGE,
    borderColor: BRAND_ORANGE,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productThumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  commissionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  commissionText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  promoteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
