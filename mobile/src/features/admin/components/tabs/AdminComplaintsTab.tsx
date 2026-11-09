import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShoppingBag,
  MessageSquare,
  Search,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminComplaintsTab() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const fetchIssues = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('issues')
        .select(`
          *,
          reporter:profiles!issues_reporter_profile_fkey(id, display_name, phone),
          seller:profiles!issues_seller_id_fkey(id, display_name, phone),
          products(title, images)
        `)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      setIssues(data || []);
    } catch (err: any) {
      console.warn('[AdminComplaintsTab] Fetch error:', err);
      toast.error('Failed to load complaints', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();

    const channel = supabase
      .channel('admin-issues-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => {
          fetchIssues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolveIssue = async (status: 'resolved' | 'in_progress' | 'open') => {
    if (!selectedIssue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from('issues')
        .update({
          status,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', selectedIssue.id);

      if (error) throw error;

      toast.success(`Complaint Marked as ${status.replace('_', ' ').toUpperCase()}`);
      setSelectedIssue({ ...selectedIssue, status });
      fetchIssues();
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const filteredIssues = issues.filter((iss) => {
    if (statusFilter === 'all') return true;
    return iss.status === statusFilter;
  });

  const totalPages = Math.ceil(filteredIssues.length / PAGE_SIZE) || 1;
  const paginatedIssues = filteredIssues.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'critical':
      case 'high':
        return { text: '#EF4444', bg: '#FEF2F2', border: '#FECACA' };
      case 'medium':
        return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
      default:
        return { text: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {[
          { key: 'open', label: 'Open' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'all', label: 'All Reports' },
        ].map((f) => {
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
      </View>

      {/* Issues List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading customer complaints...</Text>
        </View>
      ) : filteredIssues.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle2 size={42} color="#10B981" />
          <Text style={styles.emptyTitle}>Zero issues under this filter</Text>
          <Text style={styles.emptyDesc}>All orders and disputes are clear and settled</Text>
        </View>
      ) : (
        <View style={styles.issuesList}>
          {paginatedIssues.map((item) => {
            const pc = getPriorityColor(item.priority);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.issueCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedIssue(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: pc.bg, borderColor: pc.border },
                    ]}
                  >
                    <AlertTriangle size={11} color={pc.text} strokeWidth={2.5} />
                    <Text style={[styles.priorityText, { color: pc.text }]}>
                      {(item.priority || 'NORMAL').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={styles.issueTitle} numberOfLines={1}>
                  {item.title || item.category || 'Customer Escalation'}
                </Text>
                <Text style={styles.issueDesc} numberOfLines={2}>
                  {item.description || 'No description provided'}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardReporter} numberOfLines={1}>
                    By: {item.reporter?.display_name || 'Customer'}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>
                      {item.status?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredIssues.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      {/* Resolution Sheet */}
      <AppModal
        visible={selectedIssue !== null}
        onClose={() => setSelectedIssue(null)}
        title="Dispute Resolution"
      >
        {selectedIssue && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Priority & Category Header */}
            <View style={styles.modalHighlightBox}>
              <View>
                <Text style={styles.modalHighlightLabel}>CATEGORY</Text>
                <Text style={styles.modalHighlightName}>
                  {selectedIssue.category || 'General Complaint'}
                </Text>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: getPriorityColor(selectedIssue.priority).bg,
                    borderColor: getPriorityColor(selectedIssue.priority).border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    { color: getPriorityColor(selectedIssue.priority).text },
                  ]}
                >
                  {(selectedIssue.priority || 'NORMAL').toUpperCase()} PRIORITY
                </Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Complaint Description</Text>
              <Text style={styles.descBody}>{selectedIssue.description || 'No details.'}</Text>
            </View>

            {/* Parties Involved */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Parties Involved</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reporter</Text>
                <Text style={styles.detailValue}>
                  {selectedIssue.reporter?.display_name || 'Customer'}
                </Text>
              </View>
              {selectedIssue.reporter?.phone && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reporter Phone</Text>
                  <Text style={styles.detailValue}>{selectedIssue.reporter.phone}</Text>
                </View>
              )}
              {selectedIssue.seller?.display_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Merchant / Seller</Text>
                  <Text style={styles.detailValue}>{selectedIssue.seller.display_name}</Text>
                </View>
              )}
              {selectedIssue.order_id && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Linked Order ID</Text>
                  <Text style={[styles.detailValue, { fontFamily: 'monospace' }]}>
                    #{selectedIssue.order_id.slice(0, 8).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Status Update Actions */}
            <View style={styles.decisionActions}>
              <Button
                title="Mark as Resolved"
                onPress={() => handleResolveIssue('resolved')}
                loading={updating}
                icon={CheckCircle2}
                style={{ backgroundColor: '#059669', marginBottom: 10 }}
              />
              <Button
                title="Mark In Progress"
                variant="outline"
                onPress={() => handleResolveIssue('in_progress')}
                loading={updating}
                icon={Clock}
                style={{ marginBottom: 10, borderColor: '#FED7AA' }}
              />
              <Button
                title="Re-open Dispute"
                variant="outline"
                onPress={() => handleResolveIssue('open')}
                loading={updating}
                icon={AlertTriangle}
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
  issuesList: {
    gap: 10,
  },
  issueCard: {
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
    marginBottom: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '800',
  },
  cardDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  issueDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
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
  cardReporter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    maxWidth: '65%',
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
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
  descBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
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
  decisionActions: {
    marginTop: 4,
    marginBottom: 20,
  },
});
