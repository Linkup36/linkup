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
  Linking,
  Image,
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
  CreditCard,
  DollarSign,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { toast } from '../../../../components/ui';
import { AdminPagination } from '../AdminPagination';
import * as Haptics from 'expo-haptics';

// Helpers to extract normalized data
const getTrackingCode = (pkg: any) => {
  if (!pkg) return '';
  if (pkg.tracking_code) return pkg.tracking_code;
  if (typeof pkg.id === 'string') {
    // If it's a formatted code (e.g. LSEND-XXXXXX-XXXX), keep full string
    if (pkg.id.startsWith('LSEND-') || pkg.id.length <= 22) {
      return pkg.id;
    }
    return pkg.id.slice(0, 8).toUpperCase();
  }
  return '';
};

const getRecipientName = (pkg: any) => {
  return pkg?.dropoff_recipient_name || pkg?.recipient_name || 'N/A';
};

const getRecipientPhone = (pkg: any) => {
  return pkg?.dropoff_recipient_phone || pkg?.recipient_phone || 'N/A';
};

const getPackageDetails = (pkg: any) => {
  if (!pkg || !pkg.package_details) return {};
  if (typeof pkg.package_details === 'string') {
    try {
      return JSON.parse(pkg.package_details);
    } catch {
      return {};
    }
  }
  return pkg.package_details;
};

const formatNaira = (val?: number | null) => '₦' + (val || 0).toLocaleString('en-NG');

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const handleCall = (phone?: string) => {
  if (!phone || phone === 'N/A') {
    toast.error('No phone number available');
    return;
  }
  Linking.openURL(`tel:${phone}`).catch(() => {
    toast.error('Unable to dial number', { description: phone });
  });
};

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

    const trackingId = getTrackingCode(selectedPkg);

    Alert.alert(
      'Update Delivery Status',
      `Change package #${trackingId} status to ${newStatus.toUpperCase()}?`,
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

  const filteredPackages = packages.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const pkgDetails = getPackageDetails(p);

    const matchesSearch =
      !q ||
      getTrackingCode(p).toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.sender_name || '').toLowerCase().includes(q) ||
      (p.sender_phone || '').toLowerCase().includes(q) ||
      (p.dropoff_recipient_name || p.recipient_name || '').toLowerCase().includes(q) ||
      (p.dropoff_recipient_phone || p.recipient_phone || '').toLowerCase().includes(q) ||
      (p.pickup_address || '').toLowerCase().includes(q) ||
      (p.dropoff_address || '').toLowerCase().includes(q) ||
      (p.rider_name || '').toLowerCase().includes(q) ||
      (p.rider_phone || '').toLowerCase().includes(q) ||
      (p.payment_ref || '').toLowerCase().includes(q) ||
      ((pkgDetails.contents as string) || '').toLowerCase().includes(q);

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
        return { text: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', label: status || 'Pending' };
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
          placeholder="Search by tracking code, sender, recipient, rider..."
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
              const pkgDetails = getPackageDetails(pkg);
              const trackingCode = getTrackingCode(pkg);
              const recipientName = getRecipientName(pkg);
              const isFragile = Boolean(pkg.is_fragile || pkgDetails.is_fragile);

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
                      <Text style={styles.trackingCode}>{trackingCode}</Text>
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
                      To: {recipientName}
                    </Text>
                  </View>

                  {/* Rider if assigned */}
                  {pkg.rider_name && (
                    <View style={styles.riderBriefRow}>
                      <Bike size={12} color="#64748B" />
                      <Text style={styles.riderBriefText} numberOfLines={1}>
                        Rider: <Text style={styles.riderBriefName}>{pkg.rider_name}</Text>
                        {pkg.rider_vehicle ? ` · ${pkg.rider_vehicle}` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Footer with package info and delivery fee */}
                  <View style={styles.pkgFooter}>
                    <View style={styles.fragileWrap}>
                      {isFragile && (
                        <View style={styles.fragileBadge}>
                          <Text style={styles.fragileText}>FRAGILE</Text>
                        </View>
                      )}
                      <Text style={styles.pkgSizeText}>
                        {(
                          pkgDetails.contents ||
                          pkgDetails.vehicle ||
                          pkg.package_size ||
                          'Parcel'
                        ).toUpperCase()}
                        {pkgDetails.weight_kg ? ` • ${pkgDetails.weight_kg}KG` : ''}
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
        title={`Parcel ${getTrackingCode(selectedPkg)}`}
      >
        {selectedPkg && (() => {
          const pkgDetails = getPackageDetails(selectedPkg);
          const badge = getStatusBadge(selectedPkg.status);
          const riderCut =
            selectedPkg.rider_payout_amount ||
            Math.round((selectedPkg.delivery_fee || 0) * 0.8);
          const systemCut = Math.max(0, (selectedPkg.delivery_fee || 0) - riderCut);
          const isPaid = selectedPkg.payment_status === 'paid';
          const recipientName = getRecipientName(selectedPkg);
          const recipientPhone = getRecipientPhone(selectedPkg);

          return (
            <View style={styles.modalBody}>
              {/* Top Banner: Fee & Status */}
              <View style={styles.modalHighlightBox}>
                <View>
                  <Text style={styles.modalHighlightLabel}>DELIVERY FEE</Text>
                  <Text style={styles.modalHighlightAmount}>
                    {formatNaira(selectedPkg.delivery_fee)}
                  </Text>
                  <View style={styles.paymentStatusPill}>
                    <View
                      style={[
                        styles.paymentStatusDot,
                        { backgroundColor: isPaid ? '#10B981' : '#F59E0B' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.paymentStatusText,
                        { color: isPaid ? '#065F46' : '#92400E' },
                      ]}
                    >
                      {isPaid ? 'PAID' : 'PENDING PAYMENT'}
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRightWrap}>
                  <View
                    style={[
                      styles.statusBadgeLarge,
                      {
                        backgroundColor: badge.bg,
                        borderColor: badge.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusTextLarge, { color: badge.text }]}>
                      {badge.label.toUpperCase()}
                    </Text>
                  </View>
                  {selectedPkg.payment_ref && (
                    <Text style={styles.paymentRefText} numberOfLines={1}>
                      {selectedPkg.payment_ref}
                    </Text>
                  )}
                </View>
              </View>

              {/* Sender & Recipient */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Sender & Recipient</Text>

                <View style={styles.partyBox}>
                  <View style={styles.partyInfo}>
                    <Text style={styles.partyRoleLabel}>SENDER</Text>
                    <Text style={styles.partyName}>{selectedPkg.sender_name || 'N/A'}</Text>
                    <Text style={styles.partyPhone}>{selectedPkg.sender_phone || 'N/A'}</Text>
                  </View>
                  {selectedPkg.sender_phone && (
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => handleCall(selectedPkg.sender_phone)}
                      activeOpacity={0.7}
                    >
                      <Phone size={12} color={colors.primary} />
                      <Text style={styles.callButtonText}>Call</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.partyDivider} />

                <View style={styles.partyBox}>
                  <View style={styles.partyInfo}>
                    <Text style={[styles.partyRoleLabel, { color: '#059669' }]}>RECIPIENT</Text>
                    <Text style={styles.partyName}>{recipientName}</Text>
                    <Text style={styles.partyPhone}>{recipientPhone}</Text>
                  </View>
                  {recipientPhone !== 'N/A' && (
                    <TouchableOpacity
                      style={[styles.callButton, styles.callButtonEmerald]}
                      onPress={() => handleCall(recipientPhone)}
                      activeOpacity={0.7}
                    >
                      <Phone size={12} color="#059669" />
                      <Text style={[styles.callButtonText, { color: '#059669' }]}>Call</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Locations & Instructions */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Locations & Instructions</Text>

                <View style={styles.locationBlock}>
                  <View style={styles.locationHeaderRow}>
                    <View style={[styles.locationIndicator, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.locationLabel}>PICKUP POINT</Text>
                  </View>
                  <Text style={styles.locationVal}>{selectedPkg.pickup_address || 'N/A'}</Text>
                  {selectedPkg.pickup_directions && (
                    <View style={styles.noteCallout}>
                      <Text style={styles.noteCalloutText}>
                        Note: "{selectedPkg.pickup_directions}"
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.routeVerticalConnector} />

                <View style={styles.locationBlock}>
                  <View style={styles.locationHeaderRow}>
                    <View style={[styles.locationIndicator, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.locationLabel, { color: colors.primary }]}>DROPOFF POINT</Text>
                  </View>
                  <Text style={styles.locationVal}>{selectedPkg.dropoff_address || 'N/A'}</Text>
                  {selectedPkg.dropoff_directions && (
                    <View style={styles.noteCallout}>
                      <Text style={styles.noteCalloutText}>
                        Note: "{selectedPkg.dropoff_directions}"
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Assigned Courier Rider */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Assigned Courier Rider</Text>
                {selectedPkg.rider_name || selectedPkg.rider_id ? (
                  <View style={styles.riderCard}>
                    <View style={styles.riderHeaderRow}>
                      <View style={styles.riderAvatarWrap}>
                        {selectedPkg.rider_avatar ? (
                          <Image
                            source={{ uri: selectedPkg.rider_avatar }}
                            style={styles.riderAvatarImg}
                          />
                        ) : (
                          <View style={styles.riderAvatarFallback}>
                            <Text style={styles.riderAvatarFallbackText}>
                              {(selectedPkg.rider_name || 'R').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.riderInfoCol}>
                        <Text style={styles.riderName}>
                          {selectedPkg.rider_name || 'Assigned Rider'}
                        </Text>
                        <Text style={styles.riderSubText}>
                          {selectedPkg.rider_vehicle || 'Motorcycle Dispatch'}
                        </Text>
                        <Text style={styles.riderPhoneText}>
                          {selectedPkg.rider_phone || 'No phone'}
                        </Text>
                      </View>

                      {selectedPkg.rider_phone && (
                        <TouchableOpacity
                          style={styles.riderCallBtn}
                          onPress={() => handleCall(selectedPkg.rider_phone)}
                          activeOpacity={0.7}
                        >
                          <Phone size={12} color="#FFFFFF" />
                          <Text style={styles.riderCallBtnText}>Call</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Rider Payout Row */}
                    <View style={styles.riderPayoutBox}>
                      <View style={styles.riderPayoutCol}>
                        <Text style={styles.riderPayoutLabel}>Rider Payout</Text>
                        <Text style={styles.riderPayoutVal}>{formatNaira(riderCut)}</Text>
                      </View>
                      <View style={styles.riderPayoutDivider} />
                      <View style={styles.riderPayoutCol}>
                        <Text style={styles.riderPayoutLabel}>Payout Status</Text>
                        <View
                          style={[
                            styles.payoutStatusBadge,
                            {
                              backgroundColor:
                                selectedPkg.rider_payout_status === 'released'
                                  ? '#ECFDF5'
                                  : '#FFFBEB',
                              borderColor:
                                selectedPkg.rider_payout_status === 'released'
                                  ? '#A7F3D0'
                                  : '#FDE68A',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.payoutStatusBadgeText,
                              {
                                color:
                                  selectedPkg.rider_payout_status === 'released'
                                    ? '#059669'
                                    : '#D97706',
                              },
                            ]}
                          >
                            {(selectedPkg.rider_payout_status || 'Pending').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noRiderCard}>
                    <Bike size={20} color="#94A3B8" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noRiderTitle}>Awaiting Courier Assignment</Text>
                      <Text style={styles.noRiderSubtitle}>
                        System dispatch is scanning for nearby couriers.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Package Specifications */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Package Specifications</Text>
                <View style={styles.gridContainer}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Contents</Text>
                    <Text style={styles.gridVal}>
                      {pkgDetails.contents || selectedPkg.package_size || 'Standard Parcel'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Vehicle</Text>
                    <Text style={[styles.gridVal, { textTransform: 'capitalize' }]}>
                      {pkgDetails.vehicle || 'Bike'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Weight</Text>
                    <Text style={styles.gridVal}>
                      {pkgDetails.weight_kg ? `${pkgDetails.weight_kg} kg` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Est. Distance</Text>
                    <Text style={styles.gridVal}>
                      {pkgDetails.distance_km ? `${pkgDetails.distance_km} km` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Fragile Handling</Text>
                    <Text
                      style={[
                        styles.gridVal,
                        { color: pkgDetails.is_fragile ? '#EF4444' : '#0F172A' },
                      ]}
                    >
                      {pkgDetails.is_fragile ? 'Yes (Fragile)' : 'No'}
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Declared Value</Text>
                    <Text style={styles.gridVal}>
                      {pkgDetails.declared_value ? formatNaira(pkgDetails.declared_value) : '₦0'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Financial Breakdown */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Financial Breakdown</Text>
                <View style={styles.financialCardsRow}>
                  <View style={styles.financialCard}>
                    <Text style={styles.financialCardLabel}>Customer Paid</Text>
                    <Text style={styles.financialCardAmount}>
                      {formatNaira(selectedPkg.delivery_fee)}
                    </Text>
                    <Text style={styles.financialCardSub}>Gross Fee</Text>
                  </View>

                  <View style={[styles.financialCard, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.financialCardLabel, { color: '#065F46' }]}>Rider Cut</Text>
                    <Text style={[styles.financialCardAmount, { color: '#047857' }]}>
                      {formatNaira(riderCut)}
                    </Text>
                    <Text style={[styles.financialCardSub, { color: '#059669' }]}>
                      {selectedPkg.rider_payout_status === 'released' ? 'Released' : 'Pending'}
                    </Text>
                  </View>

                  <View style={[styles.financialCard, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.financialCardLabel, { color: '#3730A3' }]}>LinkUp Net</Text>
                    <Text style={[styles.financialCardAmount, { color: '#4338CA' }]}>
                      {formatNaira(systemCut)}
                    </Text>
                    <Text style={[styles.financialCardSub, { color: '#6366F1' }]}>Margin</Text>
                  </View>
                </View>
              </View>

              {/* Delivery Timeline */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Delivery Timeline</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created At</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedPkg.created_at)}</Text>
                </View>
                {selectedPkg.paid_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paid At</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedPkg.paid_at)}</Text>
                  </View>
                )}
                {selectedPkg.picked_up_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Picked Up At</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedPkg.picked_up_at)}</Text>
                  </View>
                )}
                {selectedPkg.delivered_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivered At</Text>
                    <Text style={[styles.detailValue, { color: '#059669' }]}>
                      {formatDate(selectedPkg.delivered_at)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Tracking Logs */}
              {trackingLogs.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Tracking Logs ({trackingLogs.length})</Text>
                  <View style={styles.logsList}>
                    {trackingLogs.map((log, index) => (
                      <View key={log.id || index} style={styles.logItem}>
                        <View style={styles.logDot} />
                        <View style={styles.logContent}>
                          <Text style={styles.logText}>{log.notes || log.status}</Text>
                          <Text style={styles.logTime}>{formatDate(log.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

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
    letterSpacing: 0.3,
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
  riderBriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  riderBriefText: {
    fontSize: 11,
    color: '#64748B',
  },
  riderBriefName: {
    fontWeight: '700',
    color: '#0F172A',
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
  modalBody: {
    paddingBottom: 20,
  },
  modalHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
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
  paymentStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  paymentStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paymentStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerRightWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTextLarge: {
    fontSize: 11,
    fontWeight: '800',
  },
  paymentRefText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#94A3B8',
    maxWidth: 140,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  partyBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partyInfo: {
    flex: 1,
  },
  partyRoleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  partyPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  partyDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  callButtonEmerald: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  callButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  locationBlock: {
    gap: 3,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  locationVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 17,
  },
  noteCallout: {
    marginTop: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  noteCalloutText: {
    fontSize: 11,
    color: '#92400E',
    fontStyle: 'italic',
  },
  routeVerticalConnector: {
    width: 1.5,
    height: 12,
    backgroundColor: '#E2E8F0',
    marginLeft: 2.75,
    marginVertical: 4,
  },
  riderCard: {
    gap: 10,
  },
  riderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  riderAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  riderAvatarImg: {
    width: 42,
    height: 42,
  },
  riderAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  riderAvatarFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  riderInfoCol: {
    flex: 1,
  },
  riderName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  riderSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  riderPhoneText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  riderCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  riderCallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  riderPayoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  riderPayoutCol: {
    flex: 1,
    alignItems: 'center',
  },
  riderPayoutDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  riderPayoutLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  riderPayoutVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  payoutStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  payoutStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  noRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  noRiderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  noRiderSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  gridVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  financialCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  financialCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  financialCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  financialCardAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  financialCardSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
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
  logsList: {
    gap: 8,
    paddingLeft: 6,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  logContent: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  logTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
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

