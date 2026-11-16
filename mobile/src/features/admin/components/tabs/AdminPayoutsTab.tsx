import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Bike,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  ArrowRight,
  User,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminPayoutsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // System settings (matching Web AdminPayoutManager)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feeInput, setFeeInput] = useState('100');
  const [intervalInput, setIntervalInput] = useState('7');
  const [releaseDaysInput, setReleaseDaysInput] = useState('3');
  const [sendRiderDelayInput, setSendRiderDelayInput] = useState('24');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await (supabase as any).from('system_settings').select('*');
      if (error || !data) return;

      const withdrawalFee = data.find((s: any) => s.key === 'withdrawal_fee')?.value;
      const payoutInterval = data.find((s: any) => s.key === 'payout_interval_days')?.value;
      const escrowRelease = data.find((s: any) => s.key === 'escrow_release_days')?.value;
      const sendRiderDelay = data.find((s: any) => s.key === 'send_rider_payout_delay_hours')?.value;

      if (withdrawalFee !== undefined && withdrawalFee !== null) {
        const amt =
          typeof withdrawalFee === 'object' && 'amount' in withdrawalFee
            ? withdrawalFee.amount
            : withdrawalFee;
        if (amt !== undefined && amt !== null) setFeeInput(String(amt));
      }
      if (payoutInterval !== undefined && payoutInterval !== null) {
        setIntervalInput(String(payoutInterval));
      }
      if (escrowRelease !== undefined && escrowRelease !== null) {
        setReleaseDaysInput(String(escrowRelease));
      }
      if (sendRiderDelay !== undefined && sendRiderDelay !== null) {
        setSendRiderDelayInput(String(sendRiderDelay));
      }
    } catch (err) {
      console.warn('[AdminPayoutsTab] Settings fetch error:', err);
    }
  };

  const handleSaveSettings = async () => {
    const fee = Number(feeInput);
    const interval = Number(intervalInput);
    const release = Number(releaseDaysInput);
    const sendRiderDelay = Number(sendRiderDelayInput);

    if ([fee, interval, release, sendRiderDelay].some((n) => isNaN(n) || n < 0)) {
      toast.error('Invalid values', { description: 'All settings must be valid non-negative numbers.' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavingSettings(true);
    try {
      const updates = [
        { key: 'withdrawal_fee', value: { amount: fee, type: 'flat' } },
        { key: 'payout_interval_days', value: interval },
        { key: 'escrow_release_days', value: release },
        { key: 'send_rider_payout_delay_hours', value: sendRiderDelay },
      ];

      for (const item of updates) {
        const { error } = await (supabase as any)
          .from('system_settings')
          .upsert(item, { onConflict: 'key' });
        if (error) throw error;
      }

      toast.success('System Settings Saved', {
        description: `Withdrawal fee set to ₦${fee.toLocaleString()}.`,
      });
    } catch (err: any) {
      toast.error('Failed to save settings', { description: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchPayoutRequests = async (filter = statusFilter) => {
    try {
      setLoading(true);
      let query = supabase
        .from('payout_requests')
        .select(`
          *,
          profiles:user_id(display_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(60);

      if (filter !== 'all') {
        if (filter === 'approved') {
          query = query.in('status', ['approved', 'paid']);
        } else {
          query = query.eq('status', filter);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.warn('[AdminPayoutsTab] Fetch error:', err);
      toast.error('Failed to load payouts', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemSettings();

    const channel = supabase
      .channel('admin-payouts-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests' },
        () => {
          fetchPayoutRequests(statusFilterRef.current);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        () => {
          fetchSystemSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchPayoutRequests(statusFilter);
  }, [statusFilter]);

  const handleUpdatePayoutStatus = async (newStatus: string) => {
    if (!selectedRequest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status: newStatus,
          admin_notes: adminNotes.trim() || undefined,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('Payout Status Updated', {
        description: `Request marked as ${newStatus.toUpperCase()}.`,
      });
      setSelectedRequest(null);
      setAdminNotes('');
      fetchPayoutRequests();
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTriggerSendRiders = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunningAction('send_riders');
    try {
      const { data, error } = await (supabase as any).rpc(
        'process_send_rider_payout_releases'
      );
      if (error) throw error;
      const res = data as any;
      toast.success('Rider Payouts Released', {
        description: `${res?.released_count ?? 0} packages credited (₦${(res?.total_amount ?? 0).toLocaleString()}).`,
      });
      fetchPayoutRequests();
    } catch (err: any) {
      toast.error('Release Failed', { description: err.message });
    } finally {
      setRunningAction(null);
    }
  };

  const handleTriggerAutoEscrow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunningAction('escrow');
    try {
      const { data, error } = await (supabase as any).rpc(
        'process_automated_escrow_releases'
      );
      if (error) throw error;
      const res = data as any;
      toast.success('Escrow Scan Completed', {
        description: `${res?.orders_completed ?? 0} orders finalized, ${res?.settlements_released ?? 0} settlements credited.`,
      });
      fetchPayoutRequests();
    } catch (err: any) {
      toast.error('Escrow Process Failed', { description: err.message });
    } finally {
      setRunningAction(null);
    }
  };

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    const normalized = (r.status || '').toLowerCase();
    if (statusFilter === 'approved') {
      return normalized === 'approved' || normalized === 'paid';
    }
    return normalized === statusFilter;
  });

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE) || 1;
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getStatusBadge = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return { text: '#047857', bg: '#D1FAE5', border: '#6EE7B7', label: 'Completed' };
      case 'approved':
      case 'paid':
        return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0', label: 'Approved' };
      case 'rejected':
        return { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Rejected' };
      default:
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Pending' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Quick Settlement Release Triggers */}
      <View style={styles.triggersCard}>
        <Text style={styles.triggersTitle}>AUTOMATED DISBURSEMENTS</Text>
        <View style={styles.triggersRow}>
          <TouchableOpacity
            style={[styles.triggerBtn, { backgroundColor: colors.primary }]}
            onPress={handleTriggerAutoEscrow}
            disabled={runningAction !== null}
            activeOpacity={0.8}
          >
            {runningAction === 'escrow' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.6} />
                <View>
                  <Text style={styles.triggerBtnTitle}>Run Escrow Scan</Text>
                  <Text style={styles.triggerBtnSub}>Process delivered orders</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.triggerBtn, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1 }]}
            onPress={handleTriggerSendRiders}
            disabled={runningAction !== null}
            activeOpacity={0.8}
          >
            {runningAction === 'send_riders' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Bike size={16} color={colors.primary} strokeWidth={2.4} />
                <View>
                  <Text style={[styles.triggerBtnTitle, { color: '#0F172A' }]}>
                    Rider Payouts
                  </Text>
                  <Text style={[styles.triggerBtnSub, { color: '#64748B' }]}>
                    Release delivery cuts
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Payout & Escrow System Settings */}
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={styles.settingsHeader}
          activeOpacity={0.75}
          onPress={() => {
            Haptics.selectionAsync();
            setSettingsOpen((prev) => !prev);
          }}
        >
          <View style={styles.settingsHeaderLeft}>
            <View style={styles.settingsIconWrap}>
              <Settings size={15} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.settingsTitle}>Withdrawal Fee & Payout Rules</Text>
              <Text style={styles.settingsSub}>
                Fee: ₦{Number(feeInput || 0).toLocaleString()} • Interval: {intervalInput || 0}d • Escrow: {releaseDaysInput || 0}d
              </Text>
            </View>
          </View>
          {settingsOpen ? (
            <ChevronUp size={18} color="#64748B" />
          ) : (
            <ChevronDown size={18} color="#64748B" />
          )}
        </TouchableOpacity>

        {settingsOpen && (
          <View style={styles.settingsBody}>
            <View style={styles.settingsGrid}>
              <View style={styles.settingsField}>
                <Text style={styles.settingsFieldLabel}>Withdrawal Fee (₦)</Text>
                <TextInput
                  style={styles.settingsInput}
                  keyboardType="numeric"
                  value={feeInput}
                  onChangeText={setFeeInput}
                  placeholder="100"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.settingsField}>
                <Text style={styles.settingsFieldLabel}>Payout Interval (Days)</Text>
                <TextInput
                  style={styles.settingsInput}
                  keyboardType="numeric"
                  value={intervalInput}
                  onChangeText={setIntervalInput}
                  placeholder="7"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.settingsField}>
                <Text style={styles.settingsFieldLabel}>Escrow Release (Days)</Text>
                <TextInput
                  style={styles.settingsInput}
                  keyboardType="numeric"
                  value={releaseDaysInput}
                  onChangeText={setReleaseDaysInput}
                  placeholder="3"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.settingsField}>
                <Text style={styles.settingsFieldLabel}>Send Rider Delay (Hrs)</Text>
                <TextInput
                  style={styles.settingsInput}
                  keyboardType="numeric"
                  value={sendRiderDelayInput}
                  onChangeText={setSendRiderDelayInput}
                  placeholder="24"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <Button
              title={savingSettings ? 'Saving...' : 'Save Payout Settings'}
              loading={savingSettings}
              onPress={handleSaveSettings}
              style={{ marginTop: 12 }}
            />
          </View>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {['all', 'pending', 'approved', 'completed', 'rejected'].map((s) => {
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
      </ScrollView>

      {/* Requests List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading withdrawal requests...</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <CreditCard size={42} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No withdrawal requests</Text>
          <Text style={styles.emptyDesc}>No bank transfer payouts under this filter</Text>
        </View>
      ) : (
        <View style={styles.requestsList}>
          {paginatedRequests.map((req) => {
            const badge = getStatusBadge(req.status);
            return (
              <TouchableOpacity
                key={req.id}
                style={styles.requestCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedRequest(req);
                  setAdminNotes(req.admin_notes || '');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.userWrap}>
                    <View style={styles.bankIconBox}>
                      <CreditCard size={18} color="#059669" />
                    </View>
                    <View>
                      <Text style={styles.cardUserName}>
                        {req.profiles?.display_name || req.account_name || 'Member Payout'}
                      </Text>
                      <Text style={styles.cardBankSub}>
                        {req.bank_name} &bull; {req.account_number}
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

                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.cardAmount}>{formatNaira(req.amount)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* Payout Inspection Modal */}
      <AppModal
        visible={selectedRequest !== null}
        onClose={() => setSelectedRequest(null)}
        title="Payout Request Review"
      >
        {selectedRequest && (() => {
          const currentStatus = (selectedRequest.status || 'pending').toLowerCase();
          return (
            <View style={{ paddingBottom: 12 }}>
              {/* Top Approval / Rejection Actions (immediately visible at top of card) */}
              {(currentStatus === 'pending' || currentStatus === 'approved') && (
                <View style={[styles.decisionActions, { marginTop: 0, marginBottom: 14 }]}>
                  {currentStatus === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        title="Mark as Paid"
                        onPress={() => handleUpdatePayoutStatus('approved')}
                        loading={updatingStatus}
                        icon={CheckCircle2}
                        style={{ flex: 1, backgroundColor: '#059669' }}
                      />
                      <Button
                        title="Reject"
                        variant="outline"
                        onPress={() => handleUpdatePayoutStatus('rejected')}
                        loading={updatingStatus}
                        icon={XCircle}
                        style={{ flex: 1, borderColor: '#FECACA' }}
                      />
                    </View>
                  )}
                  {currentStatus === 'approved' && (
                    <Button
                      title="Complete Payment"
                      onPress={() => handleUpdatePayoutStatus('completed')}
                      loading={updatingStatus}
                      icon={CheckCircle2}
                      style={{ backgroundColor: '#059669' }}
                    />
                  )}
                </View>
              )}

              {/* Amount Banner */}
              <View style={styles.modalHighlightBox}>
                <View>
                  <Text style={styles.modalHighlightLabel}>WITHDRAWAL AMOUNT</Text>
                  <Text style={styles.modalHighlightAmount}>
                    {formatNaira(selectedRequest.amount)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadgeLarge,
                    {
                      backgroundColor: getStatusBadge(selectedRequest.status).bg,
                      borderColor: getStatusBadge(selectedRequest.status).border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTextLarge,
                      { color: getStatusBadge(selectedRequest.status).text },
                    ]}
                  >
                    {getStatusBadge(selectedRequest.status).label.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Bank Transfer Details */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Destination Bank Account</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank Name</Text>
                  <Text style={styles.detailValue}>{selectedRequest.bank_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'monospace' }]}>
                    {selectedRequest.account_number}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <Text style={styles.detailValue}>
                    {selectedRequest.account_name || selectedRequest.profiles?.display_name || 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested At</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Admin Notes */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Admin Transaction Reference / Notes</Text>
                <TextInput
                  placeholder="Bank transfer transaction reference or reason..."
                  placeholderTextColor="#94A3B8"
                  style={styles.notesInput}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  multiline
                />
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
  triggersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  triggersTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  triggersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  triggerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  triggerBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  triggerBtnSub: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
  requestsList: {
    gap: 10,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bankIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardUserName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardBankSub: {
    fontSize: 11,
    color: '#64748B',
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  cardDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
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
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  decisionActions: {
    marginTop: 4,
    marginBottom: 20,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settingsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  settingsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  settingsField: {
    width: '48%',
  },
  settingsFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  settingsInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});
