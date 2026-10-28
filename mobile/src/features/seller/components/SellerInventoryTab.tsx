import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  Plus,
  ShieldCheck,
  Smartphone,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { getAvailableSizes } from '../utils/sellerUtils';

interface SellerInventoryTabProps {
  products: any[];
  totalProducts: number;
  productsPage: number;
  setProductsPage: (updater: (p: number) => number) => void;
  pageSize: number;
  onListProduct: () => void;
  onUpdateProduct: (product: any) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onToggleStatus: (productId: string, isActive: boolean) => Promise<void>;
  isUpdating?: boolean;
}

export function SellerInventoryTab({
  products,
  totalProducts,
  productsPage,
  setProductsPage,
  pageSize,
  onListProduct,
  onUpdateProduct,
  onDeleteProduct,
  onToggleStatus,
  isUpdating = false,
}: SellerInventoryTabProps) {
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeCount = products.filter((p) => p.is_active !== false).length;
  const lowStockCount = products.filter((p) => Number(p.inventory ?? p.stock ?? 0) < 5).length;

  const handleToggleSize = (size: string) => {
    if (!editingProduct) return;
    const currentSizes: string[] = Array.isArray(editingProduct.sizes) ? editingProduct.sizes : [];
    const newSizes = currentSizes.includes(size)
      ? currentSizes.filter((s) => s !== size)
      : [...currentSizes, size];
    setEditingProduct({ ...editingProduct, sizes: newSizes });
  };

  const handleConfirmDelete = (product: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.title}"? You cannot undo this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(product.id);
            try {
              await onDeleteProduct(product.id);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    await onUpdateProduct(editingProduct);
    setEditingProduct(null);
  };

  return (
    <View style={styles.container}>
      {/* Top Section Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>STOCK MANAGEMENT</Text>
          <Text style={styles.title}>Active Products</Text>
        </View>
        <TouchableOpacity
          style={styles.newProductBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            onListProduct();
          }}
          activeOpacity={0.85}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={3} />
          <Text style={styles.newProductBtnText}>NEW PRODUCT</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIconBox, { backgroundColor: '#FFF7F2' }]}>
            <Package size={18} color={colors.primary} />
          </View>
          <Text style={styles.metricLabel}>TOTAL STOCK</Text>
          <Text style={styles.metricValue}>{totalProducts}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
            <ShieldCheck size={18} color="#10B981" />
          </View>
          <Text style={styles.metricLabel}>ACTIVE LISTINGS</Text>
          <Text style={styles.metricValue}>{activeCount}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
            <AlertTriangle size={18} color="#D97706" />
          </View>
          <Text style={styles.metricLabel}>LOW STOCK</Text>
          <Text style={styles.metricValue}>{lowStockCount}</Text>
        </View>
      </View>

      {/* Product Cards List */}
      {products.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Package size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Products Listed Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start adding products to your store inventory so buyers in your zone can discover and order them.
          </Text>
          <TouchableOpacity
            style={[styles.newProductBtn, { marginTop: 14, alignSelf: 'center' }]}
            onPress={onListProduct}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.newProductBtnText}>LIST YOUR FIRST PRODUCT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardsGrid}>
          {products.map((p) => {
            const units = Number(p.inventory ?? p.stock ?? 0);
            const isLowStock = units < 5;
            const isAvailable = p.is_active !== false;
            const firstImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;

            return (
              <View key={p.id} style={styles.productCard}>
                {/* Product Image Header */}
                <View style={styles.imageContainer}>
                  {firstImage ? (
                    <Image source={{ uri: firstImage }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.noImagePlaceholder}>
                      <Smartphone size={26} color="#CBD5E1" />
                      <Text style={styles.noImageText}>NO IMAGE ADDED</Text>
                    </View>
                  )}

                  {/* Units Badge */}
                  <View
                    style={[
                      styles.unitBadge,
                      isLowStock ? styles.unitBadgeLow : styles.unitBadgeNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitBadgeText,
                        isLowStock ? styles.unitBadgeTextLow : styles.unitBadgeTextNormal,
                      ]}
                    >
                      {units} UNIT{units !== 1 ? 'S' : ''}
                    </Text>
                  </View>

                  {p.category ? (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{p.category}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Product Body */}
                <View style={styles.cardBody}>
                  <Text style={styles.productTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.productPrice}>
                    <Text style={styles.currencySymbol}>₦</Text>
                    {Number(p.price || 0).toLocaleString('en-NG')}
                  </Text>

                  {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                    <View style={styles.sizesRow}>
                      {p.sizes.slice(0, 6).map((sz: string) => (
                        <View key={sz} style={styles.sizeMiniChip}>
                          <Text style={styles.sizeMiniText}>{sz}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Availability Switch Row */}
                  <View style={styles.availabilityRow}>
                    <View style={styles.statusDotWrap}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isAvailable ? '#10B981' : '#94A3B8' },
                        ]}
                      />
                      <Text style={styles.availabilityLabel}>
                        {isAvailable ? 'Available' : 'Unavailable'}
                      </Text>
                    </View>
                    <Switch
                      value={isAvailable}
                      disabled={togglingId === p.id}
                      onValueChange={async (checked) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setTogglingId(p.id);
                        try {
                          await onToggleStatus(p.id, checked);
                        } finally {
                          setTogglingId(null);
                        }
                      }}
                      trackColor={{ false: '#E2E8F0', true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Card Footer Actions */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setEditingProduct({
                          ...p,
                          inventory: Number(p.inventory ?? p.stock ?? 1),
                          sizes: Array.isArray(p.sizes) ? p.sizes : [],
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Edit2 size={13} color="#0F172A" strokeWidth={2.5} />
                      <Text style={styles.editBtnText}>EDIT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleConfirmDelete(p)}
                      disabled={deletingId === p.id}
                      activeOpacity={0.8}
                    >
                      {deletingId === p.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Trash2 size={15} color="#EF4444" strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  </View>
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
            style={[styles.pageCircleBtn, productsPage === 0 && styles.pageBtnDisabled]}
            disabled={productsPage === 0}
            onPress={() => setProductsPage((p) => Math.max(0, p - 1))}
          >
            <ArrowLeft size={16} color={productsPage === 0 ? '#CBD5E1' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>PAGE {productsPage + 1}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pageCircleBtn,
              (productsPage + 1) * pageSize >= totalProducts && styles.pageBtnDisabled,
            ]}
            disabled={(productsPage + 1) * pageSize >= totalProducts}
            onPress={() => setProductsPage((p) => p + 1)}
          >
            <ChevronRight
              size={16}
              color={(productsPage + 1) * pageSize >= totalProducts ? '#CBD5E1' : '#0F172A'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Product Modal (Matches EditProductModal.tsx) */}
      <Modal
        visible={!!editingProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingProduct(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditingProduct(null)}
          />

          <View style={styles.sheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>ASSET CONFIGURATION</Text>
                <Text style={styles.sheetTitle}>Edit Repository Item</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setEditingProduct(null)}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {editingProduct && (
              <ScrollView
                style={{ maxHeight: 440 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>TITLE ASSIGNMENT</Text>
                <TextInput
                  style={styles.input}
                  value={String(editingProduct.title || '')}
                  onChangeText={(val) => setEditingProduct({ ...editingProduct, title: val })}
                  placeholder="Product title"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>MARKET PRICE (₦)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(editingProduct.price ?? '')}
                      onChangeText={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          price: val === '' ? 0 : parseFloat(val) || 0,
                        })
                      }
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>REGISTRY STOCK</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(editingProduct.inventory ?? 1)}
                      onChangeText={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          inventory: val === '' ? 0 : parseInt(val, 10) || 0,
                        })
                      }
                      placeholder="1"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {getAvailableSizes(editingProduct.category || '') && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.inputLabel}>AVAILABLE SIZES</Text>
                    <View style={styles.sizesPickerWrap}>
                      {getAvailableSizes(editingProduct.category || '')?.map((sz) => {
                        const selected = (editingProduct.sizes || []).includes(sz);
                        return (
                          <TouchableOpacity
                            key={sz}
                            style={[styles.sizeChip, selected && styles.sizeChipActive]}
                            onPress={() => handleToggleSize(sz)}
                          >
                            <Text
                              style={[
                                styles.sizeChipText,
                                selected && styles.sizeChipTextActive,
                              ]}
                            >
                              {sz}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>SPECIFICATION LOG</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={4}
                  value={String(editingProduct.description || '')}
                  onChangeText={(val) =>
                    setEditingProduct({ ...editingProduct, description: val })
                  }
                  placeholder="Describe your product specifications..."
                  placeholderTextColor="#94A3B8"
                />
              </ScrollView>
            )}

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => setEditingProduct(null)}
              >
                <Text style={styles.discardBtnText}>DISCARD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.commitBtn, isUpdating && { opacity: 0.6 }]}
                disabled={isUpdating}
                onPress={handleSaveEdit}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.commitBtnText}>COMMIT CHANGES</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  newProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  newProductBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  cardsGrid: {
    gap: 14,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  imageContainer: {
    height: 170,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noImageText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  unitBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unitBadgeNormal: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  unitBadgeLow: {
    backgroundColor: '#FEF3C7',
  },
  unitBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  unitBadgeTextNormal: {
    color: '#0F172A',
  },
  unitBadgeTextLow: {
    color: '#92400E',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardBody: {
    padding: 16,
    gap: 10,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  currencySymbol: {
    fontSize: 14,
    opacity: 0.7,
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeMiniChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  sizeMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  statusDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  editBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.4,
  },
  deleteBtn: {
    width: 42,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 12,
  },
  pageCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pagePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pagePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grabHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.8,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  sizesPickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sizeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  sizeChipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  discardBtn: {
    paddingHorizontal: 22,
    height: 50,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  commitBtn: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  commitBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});
