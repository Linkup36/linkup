import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import {
  Store,
  Truck,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  User,
  ShieldCheck,
  Calendar,
  AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminKycTab() {
  const [kycType, setKycType] = useState<'seller' | 'logistics'>('seller');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [processingStatus, setProcessingStatus] = useState(false);

  const fetchKycData = async () => {
    try {
      setLoading(true);
      const [sellerRes, logisticsRes] = await Promise.all([
        supabase
          .from('seller_verifications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('logistics_kyc')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (sellerRes.error) throw sellerRes.error;
      if (logisticsRes.error) throw logisticsRes.error;

      const sellerData = (sellerRes.data || []).map((v) => ({ ...v, kyc_type: 'seller' }));
      const logisticsData = (logisticsRes.data || []).map((v) => ({ ...v, kyc_type: 'logistics' }));
      const combined = [...sellerData, ...logisticsData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Join profile info
      const userIds = Array.from(new Set(combined.map((v) => v.user_id)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, phone')
          .in('id', userIds);

        const profileMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        combined.forEach((v) => {
          v.profile = profileMap[v.user_id] || null;
        });
      }

      setVerifications(combined);
    } catch (err: any) {
      console.warn('[AdminKycTab] Fetch error:', err);
      toast.error('Failed to load KYC applications', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, []);

  const handleReviewAction = async (status: 'verified' | 'rejected') => {
    if (!selectedKyc) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isApprove = status === 'verified';
    Alert.alert(
      isApprove ? 'Approve Verification' : 'Reject Verification',
      `Are you sure you want to ${isApprove ? 'APPROVE' : 'REJECT'} this ${selectedKyc.kyc_type} application?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isApprove ? 'Approve' : 'Reject',
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            setProcessingStatus(true);
            try {
              const rpc =
                selectedKyc.kyc_type === 'seller' ? 'verify_seller_kyc' : 'verify_logistics_kyc';
              const params =
                selectedKyc.kyc_type === 'seller'
                  ? { verification_id: selectedKyc.id, review_status: status }
                  : { p_verification_id: selectedKyc.id, p_review_status: status };

              const { data, error } = await (supabase as any).rpc(rpc, params);
              if (error) throw error;

              toast.success(`Application ${status.toUpperCase()}`);
              setSelectedKyc(null);
              fetchKycData();
            } catch (err: any) {
              toast.error('Review Failed', { description: err.message });
            } finally {
              setProcessingStatus(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [kycType, statusFilter]);

  const filtered = verifications.filter((v) => {
    const matchesType = v.kyc_type === kycType;
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedKyc = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Verified' };
      case 'rejected':
        return { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Rejected' };
      default:
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Pending Review' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Category Toggle: Merchant vs Courier */}
      <View style={styles.tabToggleRow}>
        <TouchableOpacity
          style={[styles.tabToggleBtn, kycType === 'seller' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setKycType('seller');
          }}
          activeOpacity={0.8}
        >
          <Store size={16} color={kycType === 'seller' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              kycType === 'seller' && styles.tabToggleTextActive,
            ]}
          >
            Merchant KYC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabToggleBtn, kycType === 'logistics' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setKycType('logistics');
          }}
          activeOpacity={0.8}
        >
          <Truck size={16} color={kycType === 'logistics' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              kycType === 'logistics' && styles.tabToggleTextActive,
            ]}
          >
            Courier KYC
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Chips */}
      <View style={styles.statusRow}>
        {['all', 'pending', 'verified', 'rejected'].map((s) => {
          const active = statusFilter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, active && styles.statusChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setStatusFilter(s);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Applications List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading verification submissions...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <ShieldCheck size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No verification records</Text>
          <Text style={styles.emptyDesc}>No submissions match selected filter</Text>
        </View>
      ) : (
        <View style={styles.kycList}>
          {paginatedKyc.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.kycCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedKyc(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.kycCardTop}>
                  <View style={styles.kycUserWrap}>
                    <View style={styles.kycIconBox}>
                      {item.kyc_type === 'seller' ? (
                        <Store size={18} color={colors.primary} />
                      ) : (
                        <Truck size={18} color="#0284C7" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.kycUserName}>
                        {item.profile?.display_name || item.business_name || 'Verification Request'}
                      </Text>
                      <Text style={styles.kycDate}>
                        Submitted {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Info row */}
                <View style={styles.kycInfoRow}>
                  {item.business_name && (
                    <Text style={styles.kycDetailText}>Store: {item.business_name}</Text>
                  )}
                  {item.vehicle_type && (
                    <Text style={styles.kycDetailText}>Vehicle: {item.vehicle_type}</Text>
                  )}
                  {item.plate_number && (
                    <Text style={styles.kycDetailText}>Plate: {item.plate_number}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* KYC Inspection Modal */}
      <AppModal
        visible={selectedKyc !== null}
        onClose={() => setSelectedKyc(null)}
        title="KYC Application Review"
      >
        {selectedKyc && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Header info */}
            <View style={styles.modalHighlightBox}>
              <View>
                <Text style={styles.modalHighlightLabel}>APPLICANT</Text>
                <Text style={styles.modalHighlightName}>
                  {selectedKyc.profile?.display_name || 'Applicant'}
                </Text>
                <Text style={styles.modalHighlightSub}>
                  {selectedKyc.profile?.phone || 'No phone attached'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadgeLarge,
                  {
                    backgroundColor: getStatusBadge(selectedKyc.status).bg,
                    borderColor: getStatusBadge(selectedKyc.status).border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusTextLarge,
                    { color: getStatusBadge(selectedKyc.status).text },
                  ]}
                >
                  {getStatusBadge(selectedKyc.status).label.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Submission metadata */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Application Details</Text>
              {selectedKyc.business_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Business Name</Text>
                  <Text style={styles.detailValue}>{selectedKyc.business_name}</Text>
                </View>
              )}
              {selectedKyc.business_address && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{selectedKyc.business_address}</Text>
                </View>
              )}
              {selectedKyc.vehicle_type && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle Type</Text>
                  <Text style={styles.detailValue}>{selectedKyc.vehicle_type}</Text>
                </View>
              )}
              {selectedKyc.plate_number && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plate Number</Text>
                  <Text style={styles.detailValue}>{selectedKyc.plate_number}</Text>
                </View>
              )}
            </View>

            {/* Document Preview */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Uploaded Identity Proof</Text>
              {selectedKyc.national_id_url || selectedKyc.passport_photo_url ? (
                <View style={styles.docImgWrap}>
                  <Image
                    source={{
                      uri: selectedKyc.national_id_url || selectedKyc.passport_photo_url,
                    }}
                    style={styles.docImg}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={styles.emptyDocBox}>
                  <ShieldCheck size={28} color="#94A3B8" />
                  <Text style={styles.emptyDocText}>
                    Legacy registration / system authorized account.
                  </Text>
                </View>
              )}
            </View>

            {/* Decision Actions */}
            <View style={styles.decisionActions}>
              <Button
                title="Approve Application"
                onPress={() => handleReviewAction('verified')}
                loading={processingStatus}
                icon={CheckCircle2}
                style={{ backgroundColor: '#059669', marginBottom: 10 }}
              />
              <Button
                title="Reject Application"
                variant="outline"
                onPress={() => handleReviewAction('rejected')}
                loading={processingStatus}
                icon={XCircle}
                style={{ borderColor: '#FECACA' }}
              />
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
    gap: 8,
  },
  tabToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 11,
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
  kycList: {
    gap: 10,
  },
  kycCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kycCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kycUserWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  kycIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycUserName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  kycDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
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
  kycInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  kycDetailText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  modalScroll: {
    maxHeight: 520,
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
    marginBottom: 14,
  },
  modalHighlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  modalHighlightName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  modalHighlightSub: {
    fontSize: 11,
    color: '#64748B',
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
    marginBottom: 8,
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
  docImgWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },
  docImg: {
    width: '100%',
    height: '100%',
  },
  emptyDocBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    gap: 6,
  },
  emptyDocText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  decisionActions: {
    marginTop: 4,
    marginBottom: 20,
  },
});
