import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  Plus,
  ShieldCheck,
  Edit2,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Smartphone,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface InventoryTabProps {
  products: any[];
  totalProducts: number;
  productsPage: number;
  setProductsPage: (updater: (p: number) => number) => void;
  pageSize: number;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleStatus: (productId: string, isActive: boolean) => void;
  onListProduct: () => void;
  loading?: boolean;
}

export function InventoryTab({
  products,
  totalProducts,
  productsPage,
  setProductsPage,
  pageSize,
  onEditProduct,
  onDeleteProduct,
  onToggleStatus,
  onListProduct,
  loading = false,
}: InventoryTabProps) {
  const handleDeletePress = (product: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      'Remove Product',
      `Are you sure you want to delete "${product.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteProduct(product.id),
        },
      ]
    );
  };

  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.subtitle}>Stock Management</Text>
          <Text style={styles.title}>Active Products</Text>
        </View>
        <TouchableOpacity style={styles.newProductBtn} onPress={onListProduct} activeOpacity={0.8}>
          <Plus size={16} color="#ffffff" strokeWidth={3} />
          <Text style={styles.newProductBtnText}>New Product</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Package size={20} color={colors.primary} />
          <Text style={styles.metricLabel}>Total Stock</Text>
          <Text style={styles.metricValue}>{totalProducts}</Text>
        </View>

        <View style={styles.metricCard}>
          <ShieldCheck size={20} color="#16a34a" />
          <Text style={styles.metricLabel}>Active Listings</Text>
          <Text style={styles.metricValue}>{products.filter((p) => p.is_active !== false).length}</Text>
        </View>
      </View>

      {/* Products List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyCard}>
          <Package size={40} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Products in Inventory</Text>
          <Text style={styles.emptySubtitle}>
            Add items to your catalog to start receiving customer orders.
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={onListProduct}>
            <Plus size={16} color="#ffffff" strokeWidth={3} />
            <Text style={styles.emptyAddBtnText}>List Your First Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.productsList}>
          {products.map((product) => {
            const hasImage = product.images && product.images.length > 0;
            const isLowStock = (product.inventory || 0) < 5;
            const isAvailable = product.is_active !== false;

            return (
              <View key={product.id} style={styles.productCard}>
                {/* Image & Stock Badge */}
                <View style={styles.imageContainer}>
                  {hasImage ? (
                    <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                  ) : (
                    <View style={styles.noImagePlaceholder}>
                      <Smartphone size={24} color="#94a3b8" />
                      <Text style={styles.noImageText}>NO IMAGE</Text>
                    </View>
                  )}
                  <View style={[styles.stockBadge, isLowStock ? styles.stockLow : styles.stockNormal]}>
                    <Text style={[styles.stockBadgeText, isLowStock ? styles.stockTextLow : styles.stockTextNormal]}>
                      {product.inventory || 0} UNIT{product.inventory === 1 ? '' : 'S'}
                    </Text>
                  </View>
                </View>

                {/* Details & Switch */}
                <View style={styles.cardBody}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {product.title}
                  </Text>
                  <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>

                  {/* Availability Row */}
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, isAvailable ? styles.availableText : styles.unavailableText]}>
                      {isAvailable ? 'Available' : 'Unavailable'}
                    </Text>
                    <Switch
                      value={isAvailable}
                      onValueChange={(val) => onToggleStatus(product.id, val)}
                      trackColor={{ false: '#cbd5e1', true: colors.primaryLight }}
                      thumbColor={isAvailable ? colors.primary : '#94a3b8'}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => onEditProduct(product)}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={13} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeletePress(product)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color="#ef4444" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination */}
      {totalProducts > pageSize && (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageBtn, productsPage === 0 && styles.pageBtnDisabled]}
            onPress={() => setProductsPage((p) => Math.max(0, p - 1))}
            disabled={productsPage === 0}
          >
            <ArrowLeft size={16} color={productsPage === 0 ? '#cbd5e1' : '#0f172a'} />
          </TouchableOpacity>

          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>PAGE {productsPage + 1}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pageBtn,
              (productsPage + 1) * pageSize >= totalProducts && styles.pageBtnDisabled,
            ]}
            onPress={() => setProductsPage((p) => p + 1)}
            disabled={(productsPage + 1) * pageSize >= totalProducts}
          >
            <ChevronRight
              size={16}
              color={(productsPage + 1) * pageSize >= totalProducts ? '#cbd5e1' : '#0f172a'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  newProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  newProductBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  productsList: {
    gap: 14,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  imageContainer: {
    height: 160,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noImageText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  stockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockLow: {
    backgroundColor: '#fef3c7',
  },
  stockNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stockTextLow: {
    color: '#b45309',
  },
  stockTextNormal: {
    color: '#0f172a',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  availableText: {
    color: '#16a34a',
  },
  unavailableText: {
    color: '#94a3b8',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  pageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageIndicatorText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
});

