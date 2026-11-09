import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppModal } from '../../../components/ui/AppModal';
import { colors } from '../../../theme/colors';

interface EditProductModalProps {
  product: any;
  onClose: () => void;
  onSave: (product: any) => Promise<void> | void;
  isSaving?: boolean;
}

export function EditProductModal({
  product,
  onClose,
  onSave,
  isSaving = false,
}: EditProductModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    inventory: '',
    description: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title || '',
        price: product.price ? String(product.price) : '',
        inventory: product.inventory ? String(product.inventory) : '',
        description: product.description || '',
      });
    }
  }, [product]);

  const handleCommit = () => {
    if (!product) return;
    onSave({
      ...product,
      title: formData.title,
      price: parseFloat(formData.price) || 0,
      inventory: parseInt(formData.inventory, 10) || 0,
      description: formData.description,
    });
  };

  return (
    <AppModal
      visible={Boolean(product)}
      onClose={onClose}
      title="Edit Repository Item"
      subtitle="Asset Configuration & Stock Pricing"
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title Assignment</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(t) => setFormData((prev) => ({ ...prev, title: t }))}
            placeholder="Product title"
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Price & Inventory Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Market Price (₦)</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, price: t }))}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Registry Stock</Text>
            <TextInput
              style={styles.input}
              value={formData.inventory}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, inventory: t }))}
              placeholder="1"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Specification Log</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(t) => setFormData((prev) => ({ ...prev, description: t }))}
            placeholder="Detailed item description and specifications..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={onClose}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.commitBtn}
            onPress={handleCommit}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.commitBtnText}>Commit Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  commitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

