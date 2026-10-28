import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  Eye,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { toast as GooeyToast } from '../../../components/ui/GooeyToast';

interface SellerPaymentsTabProps {
  userId: string;
  onRefreshDashboard?: () => void;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'settled' | 'failed' | 'refunded';

export function SellerPaymentsTab({
  userId,
  onRefreshDashboard,
}: SellerPaymentsTabProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchSettlements = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: settlementData, error: settlementError } = await (supabase
        .from('order_settlements' as any)
        .select(
          `
          *,
          orders!inner (
            id,
            buyer_id,
            seller_id,
            total_amount,
            status,
            payment_status,
            payment_reference,
            created_at
          )
        `
        )
        .eq('orders.seller_id', userId)
        .order('created_at', { ascending: false }) as any);

      if (!settlementError && settlementData && settlementData.length > 0) {
        setRecords(settlementData);
      } else {
        // Fallback: synthesize reconciliation rows from seller orders if no order_settlements rows yet
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false });

        const synthesized = (ordersData || []).map((o: any) => ({
          id: o.id,
          order_id: o.id,
          total_amount: o.total_amount,
          seller_amount: Math.round(Number(o.total_amount || 0) * 0.9),
          platform_fee: Math.round(Number(o.total_amount || 0) * 0.1),
          settlement_status:
            o.status === 'delivered' || o.status === 'completed'
              ? 'settled'
              : o.payment_status === 'paid'
                ? 'processing'
                : o.payment_status === 'failed'
                  ? 'failed'
                  : 'pending',
          created_at: o.created_at,
          orders: o,
        }));
        setRecords(synthesized);
      }
    } catch (err) {
      console.warn('[SellerPaymentsTab] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Summary metrics
  const summary = useMemo(() => {
    const totalOrders = records.length;
    const paidByCustomer = records.filter(
      (r) =>
        r.orders?.payment_status === 'paid' ||
        r.settlement_status === 'settled' ||
        r.settlement_status === 'processing'
    ).length;
    const pendingPayout = records.filter(
      (r) => r.settlement_status === 'pending' || r.settlement_status === 'processing'
    ).length;
    const completedPayout = records.filter(
      (r) => r.settlement_status === 'settled'
    ).length;

    return { totalOrders, paidByCustomer, pendingPayout, completedPayout };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const order = r.orders || {};
      const orderId = String(r.order_id || order.id || '').toLowerCase();
      const paymentRef = String(order.payment_reference || r.payment_reference || '').toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch = !q || orderId.includes(q) || paymentRef.includes(q);
      const sStatus = String(r.settlement_status || 'pending').toLowerCase();
      const pStatus = String(order.payment_status || 'pending').toLowerCase();

      const matchesStatus =
        statusFilter === 'all' || sStatus === statusFilter || pStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  const renderStatusBadge = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'settled' || s === 'paid' || s === 'completed') {
      return (
        <View style={[styles.badge, { backgroundColor: '#ECFDF5' }]}>
          <CheckCircle2 size={11} color="#059669" />
          <Text style={[styles.badgeText, { color: '#059669' }]}>{s.toUpperCase()}</Text>
        </View>
      );
    }
    if (s === 'failed' || s === 'refunded') {
      return (
        <View style={[styles.badge, { backgroundColor: '#FEF2F2' }]}>
          <XCircle size={11} color="#DC2626" />
          <Text style={[styles.badgeText, { color: '#DC2626' }]}>{s.toUpperCase()}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: '#FFFBEB' }]}>
        <Clock size={11} color="#D97706" />
        <Text style={[styles.badgeText, { color: '#D97706' }]}>{s.toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 4 Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL ORDERS</Text>
          <Text style={styles.summaryValue}>{summary.totalOrders}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PAID BY CUSTOMER</Text>
          <Text style={[styles.summaryValue, { color: '#2563EB' }]}>
            {summary.paidByCustomer}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PENDING PAYOUT</Text>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>
            {summary.pendingPayout}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>COMPLETED PAYOUT</Text>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>
            {summary.completedPayout}
          </Text>
        </View>
      </View>

      {/* Search & Refresh Bar */}
      <View style={styles.filterCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Order ID or Payment Ref..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              fetchSettlements();
            }}
          >
            <RefreshCw size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {(['all', 'pending', 'processing', 'settled', 'failed', 'refunded'] as StatusFilter[]).map(
            (st) => {
              const active = statusFilter === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStatusFilter(st);
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </View>

      {/* Records List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payment settlements...</Text>
        </View>
      ) : paginatedRecords.length === 0 ? (
        <View style={styles.emptyBox}>
          <CreditCard size={36} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No payment records found</Text>
          <Text style={styles.emptySub}>
            Try clearing your search filter or check back when new orders arrive.
          </Text>
        </View>
      ) : (
        <View style={styles.listGap}>
          {paginatedRecords.map((rec) => {
            const order = rec.orders || {};
            const orderId = rec.order_id || order.id;
            const totalAmt = Number(rec.total_amount ?? order.total_amount ?? 0);
            const netAmt = Number(
              rec.seller_amount ?? Math.round(totalAmt * 0.9)
            );
            const paymentRef = order.payment_reference || rec.payment_reference || 'N/A';

            return (
              <TouchableOpacity
                key={rec.id}
                style={styles.recordCard}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedRecord(rec);
                }}
              >
                <View style={styles.recordTopRow}>
                  <View>
                    <Text style={styles.recordOrderId}>
                      Order #{String(orderId).slice(0, 8)}
                    </Text>
                    <Text style={styles.recordRefText} numberOfLines={1}>
                      Ref: {paymentRef}
                    </Text>
                  </View>
                  {renderStatusBadge(rec.settlement_status)}
                </View>

                <View style={styles.recordAmountsRow}>
                  <View>
                    <Text style={styles.amountSmallLabel}>ORDER GROSS</Text>
                    <Text style={styles.amountGrossValue}>
                      ₦{totalAmt.toLocaleString()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.amountSmallLabel}>NET SETTLEMENT</Text>
                    <Text style={styles.amountNetValue}>
                      ₦{netAmt.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountSmallLabel}>CUSTOMER PAY</Text>
                    <Text style={styles.customerPayStatus}>
                      {String(order.payment_status || 'pending').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.recordFooter}>
                  <Text style={styles.recordDate}>
                    {rec.created_at
                      ? new Date(rec.created_at).toLocaleDateString()
                      : ''}
                  </Text>
                  <View style={styles.reconcileActionLink}>
                    <Eye size={13} color={colors.primary} />
                    <Text style={styles.reconcileActionText}>View Details</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Pagination Footer */}
      {filteredRecords.length > 0 && (
        <View style={styles.paginationBar}>
          <View style={styles.pageSizeRow}>
            <Text style={styles.pageSizeLabel}>Per page:</Text>
            {([10, 25, 50] as const).map((sz) => (
              <TouchableOpacity
                key={sz}
                style={[styles.sizeBtn, pageSize === sz && styles.sizeBtnActive]}
                onPress={() => setPageSize(sz)}
              >
                <Text
                  style={[
                    styles.sizeBtnText,
                    pageSize === sz && styles.sizeBtnTextActive,
                  ]}
                >
                  {sz}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.pageNavRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentPage <= 1 && styles.navBtnDisabled]}
              disabled={currentPage <= 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {currentPage} / {totalPages}
            </Text>
            <TouchableOpacity
              style={[
                styles.navBtn,
                currentPage >= totalPages && styles.navBtnDisabled,
              ]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Details Modal */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Payment Details</Text>
                <Text style={styles.modalSubtitle}>
                  Order payment and settlement breakdown
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedRecord(null)}
              >
                <X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailSummaryBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order ID</Text>
                    <Text style={styles.detailValue}>
                      #{String(selectedRecord.order_id || selectedRecord.orders?.id).slice(0, 12)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Reference</Text>
                    <Text style={styles.detailValue}>
                      {selectedRecord.orders?.payment_reference ||
                        selectedRecord.payment_reference ||
                        'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer Payment</Text>
                    <Text style={styles.detailValue}>
                      {String(selectedRecord.orders?.payment_status || 'pending').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Settlement Status</Text>
                    <Text style={styles.detailValue}>
                      {String(selectedRecord.settlement_status || 'pending').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gross Amount</Text>
                    <Text style={styles.detailValue}>
                      ₦
                      {Number(
                        selectedRecord.total_amount ??
                        selectedRecord.orders?.total_amount ??
                        0
                      ).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Seller Net Payout</Text>
                    <Text style={[styles.detailValue, { color: '#059669' }]}>
                      ₦
                      {Number(
                        selectedRecord.seller_amount ??
                        Math.round(
                          Number(selectedRecord.orders?.total_amount || 0) * 0.9
                        )
                      ).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.foreground,
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.foreground,
    fontWeight: '600',
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipsScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
  listGap: {
    gap: 10,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recordOrderId: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.foreground,
  },
  recordRefText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 210,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  recordAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  amountSmallLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  amountGrossValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: 2,
  },
  amountNetValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },
  customerPayStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginTop: 2,
  },
  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  reconcileActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reconcileActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageSizeLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sizeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
  },
  sizeBtnActive: {
    backgroundColor: '#FFF3EC',
  },
  sizeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  sizeBtnTextActive: {
    color: colors.primary,
  },
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '800',
  },
  reconcileButtonsCol: {
    gap: 10,
    marginBottom: 12,
  },
  gatewayVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  gatewayVerifyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  manualActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  markPaidBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  markPaidText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  markFailedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  markFailedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
});
