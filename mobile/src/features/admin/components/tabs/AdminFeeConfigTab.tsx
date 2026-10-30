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
  Wallet,
  Settings,
  Edit2,
  CheckCircle2,
  Package,
  ShoppingBag,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminFeeConfigTab() {
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'send' | 'marketplace' | 'all'>('send');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [editRate, setEditRate] = useState('');
  const [editFlatFee, setEditFlatFee] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFees = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('fee_config')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setFees(data || []);
    } catch (err: any) {
      console.warn('[AdminFeeConfigTab] Fetch error:', err);
      toast.error('Failed to load fee configuration', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const handleToggleActive = async (fee: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextState = !fee.is_active;
    try {
      const { error } = await (supabase as any)
        .from('fee_config')
        .update({ is_active: nextState })
        .eq('id', fee.id);

      if (error) throw error;
      setFees((prev) =>
        prev.map((f) => (f.id === fee.id ? { ...f, is_active: nextState } : f))
      );
      toast.success(nextState ? 'Fee Rule Enabled' : 'Fee Rule Disabled');
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    }
  };

  const handleSaveFeeEdit = async () => {
    if (!editingFee) return;
    const isPercentage =
      editingFee.fee_type === 'send_rider_payout_rate' ||
      (editingFee.fee_type?.includes('rate') && !editingFee.fee_type?.includes('per_km'));

    let rateVal = parseFloat(editRate) || 0;
    if (isPercentage && rateVal > 1) {
      rateVal = rateVal / 100;
    }
    const flatVal = parseFloat(editFlatFee) || 0;

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('fee_config')
        .update({
          rate: rateVal,
          flat_fee: flatVal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingFee.id);

      if (error) throw error;
      toast.success('Fee Config Saved');
      setEditingFee(null);
      fetchFees();
    } catch (err: any) {
      toast.error('Save Failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  const filteredFees = fees.filter((f) => {
    if (activeCategory === 'send') return f.fee_type?.startsWith('send_');
    if (activeCategory === 'marketplace') return !f.fee_type?.startsWith('send_');
    return true;
  });

  const totalPages = Math.ceil(filteredFees.length / PAGE_SIZE) || 1;
  const paginatedFees = filteredFees.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  return (
    <View style={styles.container}>
      {/* Category Toggle */}
      <View style={styles.tabToggleRow}>
        <TouchableOpacity
          style={[styles.tabToggleBtn, activeCategory === 'send' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveCategory('send');
          }}
          activeOpacity={0.8}
        >
          <Package size={15} color={activeCategory === 'send' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              activeCategory === 'send' && styles.tabToggleTextActive,
            ]}
          >
            SEND Parcels
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabToggleBtn, activeCategory === 'marketplace' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveCategory('marketplace');
          }}
          activeOpacity={0.8}
        >
          <ShoppingBag size={15} color={activeCategory === 'marketplace' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              activeCategory === 'marketplace' && styles.tabToggleTextActive,
            ]}
          >
            Marketplace
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabToggleBtn, activeCategory === 'all' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveCategory('all');
          }}
          activeOpacity={0.8}
        >
          <Settings size={15} color={activeCategory === 'all' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              activeCategory === 'all' && styles.tabToggleTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fees List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading fee calculation rules...</Text>
        </View>
      ) : filteredFees.length === 0 ? (
        <View style={styles.emptyState}>
          <Wallet size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No fee rules found</Text>
          <Text style={styles.emptyDesc}>No configurations under this category</Text>
        </View>
      ) : (
        <View style={styles.feesList}>
          {paginatedFees.map((fee) => (
            <View key={fee.id} style={styles.feeCard}>
              <View style={styles.feeCardTop}>
                <View style={styles.feeTitleWrap}>
                  <Text style={styles.feeName}>{fee.name || fee.fee_type}</Text>
                  <Text style={styles.feeTypeKey}>{fee.fee_type}</Text>
                </View>
                <Switch
                  value={fee.is_active}
                  onValueChange={() => handleToggleActive(fee)}
                  trackColor={{ false: '#E2E8F0', true: colors.primaryBorder }}
                  thumbColor={fee.is_active ? colors.primary : '#FFFFFF'}
                />
              </View>

              <View style={styles.feeValuesRow}>
                <View style={styles.valChip}>
                  <Text style={styles.valChipLabel}>FLAT FEE</Text>
                  <Text style={styles.valChipAmount}>{formatNaira(fee.flat_fee)}</Text>
                </View>

                <View style={styles.valChip}>
                  <Text style={styles.valChipLabel}>RATE (%)</Text>
                  <Text style={styles.valChipAmount}>
                    {((fee.rate || 0) * 100).toFixed(1)}%
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEditingFee(fee);
                    const isPercentage =
                      fee.fee_type === 'send_rider_payout_rate' ||
                      (fee.fee_type?.includes('rate') && !fee.fee_type?.includes('per_km'));
                    setEditRate(
                      isPercentage
                        ? Math.round((fee.rate || 0) * 100).toString()
                        : (fee.rate || 0).toString()
                    );
                    setEditFlatFee((fee.flat_fee || 0).toString());
                  }}
                  activeOpacity={0.7}
                >
                  <Edit2 size={14} color={colors.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredFees.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* Edit Fee Modal */}
      <AppModal
        visible={editingFee !== null}
        onClose={() => setEditingFee(null)}
        title="Edit Fee Configuration"
      >
        {editingFee && (() => {
          const isRiderRate = editingFee.fee_type === 'send_rider_payout_rate';
          const isRiderMin = editingFee.fee_type === 'send_rider_min_payout';
          const isPercentage =
            isRiderRate ||
            (editingFee.fee_type?.includes('rate') && !editingFee.fee_type?.includes('per_km'));

          const parsedRatePct = parseFloat(editRate) || 0;
          const normalizedRate = parsedRatePct > 1 ? parsedRatePct / 100 : parsedRatePct;
          const sampleDeliveryFee = 750;
          const sampleRiderCut = Math.round(sampleDeliveryFee * (normalizedRate || 0.8));
          const samplePlatformCut = Math.max(0, sampleDeliveryFee - sampleRiderCut);

          return (
            <View style={styles.modalContent}>
              <Text style={styles.modalFeeName}>{editingFee.name}</Text>
              <Text style={styles.modalFeeType}>{editingFee.fee_type}</Text>

              {isRiderRate ? (
                <>
                  <Text style={styles.inputLabel}>Rider Earnings Share (% of Delivery Fee)</Text>
                  <Text style={styles.helperText}>
                    Percentage of total delivery fee paid directly into rider's wallet upon delivery.
                  </Text>
                  <TextInput
                    placeholder="e.g. 80"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={editRate}
                    onChangeText={setEditRate}
                  />

                  {/* Live Simulation Box */}
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Live Commission Preview (₦750 Delivery)</Text>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Rider Take-Home:</Text>
                      <Text style={styles.previewRiderVal}>₦{sampleRiderCut.toLocaleString()}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>LinkUp Retained Cut:</Text>
                      <Text style={styles.previewPlatformVal}>₦{samplePlatformCut.toLocaleString()}</Text>
                    </View>
                  </View>
                </>
              ) : isRiderMin ? (
                <>
                  <Text style={styles.inputLabel}>Minimum Guaranteed Floor (₦)</Text>
                  <Text style={styles.helperText}>
                    Optional floor per trip. Set to ₦0 for pure commission (recommended to avoid platform loss on small trips).
                  </Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={editFlatFee}
                    onChangeText={setEditFlatFee}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Flat Fee (₦)</Text>
                  <TextInput
                    placeholder="e.g. 500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={editFlatFee}
                    onChangeText={setEditFlatFee}
                  />

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                    {isPercentage ? 'Rate Percentage (%)' : 'Rate Multiplier'}
                  </Text>
                  <TextInput
                    placeholder={isPercentage ? 'e.g. 10' : 'e.g. 0.05'}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={editRate}
                    onChangeText={setEditRate}
                  />
                </>
              )}

              <Button
                title="Save Fee Settings"
                onPress={handleSaveFeeEdit}
                loading={saving}
                style={{ marginTop: 20 }}
              />
            </View>
          );
        })()}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    gap: 6,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  tabToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
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
  feesList: {
    gap: 10,
  },
  feeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  feeTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  feeName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  feeTypeKey: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  feeValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  valChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  valChipLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  valChipAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  editBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalFeeName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalFeeType: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 2,
    marginBottom: 14,
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
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  previewBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14532D',
  },
  previewRiderVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#15803D',
  },
  previewPlatformVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0369A1',
  },
});
