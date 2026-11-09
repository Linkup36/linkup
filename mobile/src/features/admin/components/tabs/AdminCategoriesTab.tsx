import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import {
  Grid,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminCategoriesTab() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.warn('[AdminCategoriesTab] Fetch error:', err);
      toast.error('Failed to load categories', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleToggleCategory = async (cat: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextState = !cat.is_active;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: nextState })
        .eq('id', cat.id);

      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextState } : c))
      );
      toast.success(nextState ? 'Category Visible' : 'Category Hidden');
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      toast.warning('Name Required', { description: 'Please enter category title.' });
      return;
    }

    setSaving(true);
    try {
      const slug = newCatName.trim().toLowerCase().replace(/\s+/g, '-');
      const { error } = await supabase.from('categories').insert({
        name: newCatName.trim(),
        slug,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Category Added');
      setNewCatName('');
      setIsAddOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast.error('Creation Failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId: string, name: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Category',
      `Delete "${name}" category? Existing products mapped to this category may lose their categorization.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', catId);

              if (error) throw error;
              toast.success('Category Deleted');
              fetchCategories();
            } catch (err: any) {
              toast.error('Delete Failed', { description: err.message });
            }
          },
        },
      ]
    );
  };

  const totalPages = Math.ceil(categories.length / PAGE_SIZE) || 1;
  const paginatedCategories = categories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <View style={styles.container}>
      <View style={styles.topActionRow}>
        <Button
          title="Add New Category"
          icon={Plus}
          onPress={() => setIsAddOpen(true)}
          style={{ height: 42 }}
        />
      </View>

      {/* Categories Grid */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading marketplace categories...</Text>
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Grid size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No categories</Text>
          <Text style={styles.emptyDesc}>Add product categories to organize marketplace items</Text>
        </View>
      ) : (
        <View style={styles.catGrid}>
          {paginatedCategories.map((cat) => (
            <View key={cat.id} style={styles.catCard}>
              <View style={styles.catCardLeft}>
                <View style={styles.iconBox}>
                  <Grid size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catSlug}>/{cat.slug || cat.name.toLowerCase()}</Text>
                </View>
              </View>

              <View style={styles.catCardRight}>
                <Switch
                  value={cat.is_active !== false}
                  onValueChange={() => handleToggleCategory(cat)}
                  trackColor={{ false: '#E2E8F0', true: colors.primaryBorder }}
                  thumbColor={cat.is_active !== false ? colors.primary : '#FFFFFF'}
                />

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteCategory(cat.id, cat.name)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={categories.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* Add Category Modal */}
      <AppModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Marketplace Category"
      >
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>Category Name</Text>
          <TextInput
            placeholder="e.g. Phones & Tablets, Fashion, Groceries..."
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
            value={newCatName}
            onChangeText={setNewCatName}
          />

          <Button
            title="Create Category"
            onPress={handleAddCategory}
            loading={saving}
            style={{ marginTop: 20 }}
          />
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  topActionRow: {
    marginBottom: 12,
  },
  loaderWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  catGrid: {
    gap: 10,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  catSlug: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  catCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: '#F8FAFC',
  },
});
