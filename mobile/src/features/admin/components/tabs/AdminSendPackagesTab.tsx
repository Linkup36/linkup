import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Package,
  Search,
  Truck,
  Bike,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  User,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import { AdminPagination } from '../AdminPagination';
import * as Haptics from 'expo-haptics';

export function AdminSendPackagesTab() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const fetchPackages = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('send_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPackages(data || []);
    } catch (err: any) {
      console.warn('[AdminSendPackagesTab] Fetch error:', err);
      toast.error('Failed to load packages', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();

    // Subscribe to live send_orders updates
    const channel = supabase
      .channel('admin-send-packages-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders' },
        () => {
          fetchPackages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTrackingLogs = async (pkgId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('send_order_tracking_logs')
        .select('*')
        .eq('order_id', pkgId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setTrackingLogs(data);
      }
    } catch {
      // quiet fallback
    }
  };

  const handleSelectPackage = (pkg: any) => {
    Haptics.selectionAsync();
    setSelectedPkg(pkg);
    fetchTrackingLogs(pkg.id);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPkg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Update Delivery Status',
      `Change package #${selectedPkg.tracking_code || selectedPkg.id.slice(0, 8)} status to ${newStatus.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const { error } = await (supabase as any)
                .from('send_orders')
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', selectedPkg.id);

              if (error) throw error;

              toast.success('Status Updated', {
                description: `Package status is now ${newStatus}.`,
              });
              setSelectedPkg({ ...selectedPkg, status: newStatus });
              fetchPackages();
            } catch (err: any) {
              toast.error('Update Failed', { description: err.message });
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredPackages = packages.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (p.tracking_code || '').toLowerCase().includes(q) ||
      (p.sender_name || '').toLowerCase().includes(q) ||
      (p.recipient_name || '').toLowerCase().includes(q) ||
      (p.recipient_phone || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && ['finding_rider', 'pending_payment'].includes(p.status)) ||
      (statusFilter === 'transit' && ['assigned', 'picked_up', 'in_transit'].includes(p.status)) ||
      p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const paginatedPackages = filteredPackages.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Delivered' };
      case 'in_transit':
      case 'picked_up':
        return { text: colors.primary, bg: '#FFF7ED', border: '#FED7AA', label: 'In Transit' };
      case 'assigned':
        return { text: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', label: 'Rider Assigned' };
      case 'finding_rider':
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Finding Rider' };
      case 'cancelled':
        return { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Cancelled' };
      default:
        return { text: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', label: status };
    }
  };

  const filters = [
    { key: 'all', label: 'All Parcels' },
    { key: 'pending', label: 'Awaiting Rider' },
    { key: 'transit', label: 'In Delivery' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          placeholder="Search by tracking code, sender, recipient..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusChipsScroll}
      >
        {filters.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.statusChip, active && styles.statusChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setStatusFilter(f.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading live parcel dispatches...</Text>
        </View>
      ) : filteredPackages.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No parcels found</Text>
          <Text style={styles.emptyDesc}>No on-demand deliveries match current filter</Text>
        </View>
      ) : (
        <>
          <View style={styles.packagesList}>
            {paginatedPackages.map((pkg) => {
              const badge = getStatusBadge(pkg.status);
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={styles.pkgCard}
                  onPress={() => handleSelectPackage(pkg)}
                  activeOpacity={0.7}
                >
                  <View style={styles.pkgCardTop}>
                    <View style={styles.trackingWrap}>
                      <Package size={14} color={colors.primary} />
                      <Text style={styles.trackingCode}>
                        {pkg.tracking_code || pkg.id.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: badge.text }]}>
                        {badge.label.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Pickup & Dropoff Route */}
                  <View style={styles.routeWrap}>
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {pkg.pickup_address || 'Pickup address not specified'}
                      </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {pkg.dropoff_address || 'Dropoff location not specified'}
                      </Text>
                    </View>
                  </View>

                  {/* Contact Names */}
                  <View style={styles.contactsRow}>
                    <Text style={styles.contactItem} numberOfLines={1}>
                      Sender: {pkg.sender_name || 'Anonymous'}
                    </Text>
                    <Text style={styles.contactDivider}>&bull;</Text>
                    <Text style={styles.contactItem} numberOfLines={1}>
                      To: {pkg.recipient_name || 'Recipient'}
                    </Text>
                  </View>

                  {/* Footer with delivery fee */}
                  <View style={styles.pkgFooter}>
                    <View style={styles.fragileWrap}>
                      {pkg.is_fragile && (
                        <View style={styles.fragileBadge}>
                          <Text style={styles.fragileText}>FRAGILE</Text>
                        </View>
                      )}
                      <Text style={styles.pkgSizeText}>
                        {(pkg.package_size || 'Standard').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.pkgFee}>{formatNaira(pkg.delivery_fee)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPackages.length}
            onPageChange={setCurrentPage}
            label="parcels"
          />
        </>
      )}

      {/* Package Detail Modal */}
      <AppModal
        visible={selectedPkg !== null}
        onClose={() => setSelectedPkg(null)}
        title={`Parcel ${selectedPkg?.tracking_code || selectedPkg?.id?.slice(0, 8).toUpperCase()}`}
      >
        {selectedPkg && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Header Highlight */}
            <View style={styles.modalHighlightBox}>
              <View>
                <Text style={styles.modalHighlightLabel}>DELIVERY FEE</Text>
                <Text style={styles.modalHighlightAmount}>
                  {formatNaira(selectedPkg.delivery_fee)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadgeLarge,
                  {
                    backgroundColor: getStatusBadge(selectedPkg.status).bg,
                    borderColor: getStatusBadge(selectedPkg.status).border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusTextLarge,
                    { color: getStatusBadge(selectedPkg.status).text },
                  ]}
                >
                  {getStatusBadge(selectedPkg.status).label.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Parties Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Sender & Recipient</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sender Name</Text>
                <Text style={styles.detailValue}>{selectedPkg.sender_name || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sender Phone</Text>
                <Text style={styles.detailValue}>{selectedPkg.sender_phone || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recipient Name</Text>
                <Text style={styles.detailValue}>{selectedPkg.recipient_name || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recipient Phone</Text>
                <Text style={styles.detailValue}>{selectedPkg.recipient_phone || 'N/A'}</Text>
              </View>
            </View>

            {/* Addresses */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Locations</Text>
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>Pickup Point</Text>
                <Text style={styles.locationVal}>{selectedPkg.pickup_address || 'N/A'}</Text>
              </View>
              <View style={[styles.locationItem, { marginTop: 8 }]}>
                <Text style={styles.locationLabel}>Dropoff Point</Text>
                <Text style={styles.locationVal}>{selectedPkg.dropoff_address || 'N/A'}</Text>
              </View>
            </View>

            {/* Quick Status Override Controls for Admins */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Admin Status Controls</Text>
              <View style={styles.actionPillsRow}>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#F0F9FF' }]}
                  onPress={() => handleUpdateStatus('assigned')}
                  disabled={updatingStatus}
                >
                  <Text style={[styles.actionPillText, { color: '#0284C7' }]}>
                    Mark Assigned
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#FFF7ED' }]}
                  onPress={() => handleUpdateStatus('in_transit')}
                  disabled={updatingStatus}
                >
                  <Text style={[styles.actionPillText, { color: colors.primary }]}>
                    Mark In Transit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#ECFDF5' }]}
                  onPress={() => handleUpdateStatus('delivered')}
                  disabled={updatingStatus}
                >
                  <Text style={[styles.actionPillText, { color: '#059669' }]}>
                    Mark Delivered
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#FEF2F2' }]}
                  onPress={() => handleUpdateStatus('cancelled')}
                  disabled={updatingStatus}
                >
                  <Text style={[styles.actionPillText, { color: '#EF4444' }]}>
                    Cancel Parcel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  clearSearch: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statusChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusChipTextActive: {
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
  packagesList: {
    gap: 10,
  },
  pkgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pkgCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackingCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  routeWrap: {
    paddingVertical: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    width: 1.5,
    height: 10,
    backgroundColor: '#E2E8F0',
    marginLeft: 3.25,
    marginVertical: 1,
  },
  routeText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  contactsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  contactItem: {
    fontSize: 11,
    color: '#64748B',
    maxWidth: '46%',
  },
  contactDivider: {
    color: '#CBD5E1',
  },
  pkgFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fragileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fragileBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fragileText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
  pkgSizeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pkgFee: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalHighlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  modalHighlightAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTextLarge: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationItem: {
    gap: 2,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  locationVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  actionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
