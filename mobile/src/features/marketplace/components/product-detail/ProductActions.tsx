import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ShoppingCart, Heart } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface ProductActionsProps {
  product: any;
  selectedSize: string | null;
  setSelectedSize: (size: string | null) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}

export function ProductActions({
  product,
  selectedSize,
  setSelectedSize,
  onAddToCart,
  onBuyNow,
  isWishlisted,
  onToggleWishlist,
}: ProductActionsProps) {
  const isOutOfStock = (product.inventory || 0) <= 0;

  return (
    <View style={styles.container}>
      {/* Optional Size Selection */}
      {product.sizes && product.sizes.length > 0 && (
        <View style={styles.sizeSection}>
          <Text style={styles.sizeLabel}>SELECT SIZE</Text>
          <View style={styles.sizesRow}>
            {product.sizes.map((size: string) => {
              const isSelected = selectedSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeBtn, isSelected && styles.sizeBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSize(size);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sizeBtnText, isSelected && styles.sizeBtnTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Dual Buttons: Add to Cart + Buy Now */}
      <View style={styles.dualRow}>
        <TouchableOpacity
          style={[styles.addToCartBtn, isOutOfStock && styles.disabledBtn]}
          onPress={onAddToCart}
          disabled={isOutOfStock}
          activeOpacity={0.85}
        >
          <ShoppingCart size={18} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.addToCartText}>ADD TO CART</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buyNowBtn, isOutOfStock && styles.disabledBtn]}
          onPress={onBuyNow}
          disabled={isOutOfStock}
          activeOpacity={0.85}
        >
          <Text style={styles.buyNowText}>BUY NOW</Text>
        </TouchableOpacity>
      </View>

      {/* Secondary Save to Wishlist Button */}
      <TouchableOpacity
        style={styles.wishlistBtn}
        onPress={onToggleWishlist}
        activeOpacity={0.85}
      >
        <Heart
          size={18}
          color={isWishlisted ? '#ef4444' : '#475569'}
          fill={isWishlisted ? '#ef4444' : 'none'}
        />
        <Text style={[styles.wishlistText, isWishlisted && styles.wishlistTextActive]}>
          {isWishlisted ? 'Saved to Wishlist' : 'Save to Wishlist'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  sizeSection: {
    marginBottom: 16,
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
  dualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  buyNowText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
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
  wishlistText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  wishlistTextActive: {
    color: '#ef4444',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
