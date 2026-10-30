import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Package,
  Calendar,
  User,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';

interface SellerIssuesTabProps {
  userId: string;
  onContactSupport?: () => void;
  onIssuesCountChange?: (openCount: number) => void;
}

export function SellerIssuesTab({
  userId,
  onContactSupport,
  onIssuesCountChange,
}: SellerIssuesTabProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evidenceModalUrl, setEvidenceModalUrl] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*, products(title), reporter:profiles!issues_reporter_profile_fkey(display_name)')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback query if foreign key alias differs
        const { data: fallbackData } = await supabase
          .from('issues')
          .select('*')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false });

        const list = fallbackData || [];
        setIssues(list);
        onIssuesCountChange?.(list.filter((i: any) => i.status === 'open').length);
      } else {
        const list = data || [];
        setIssues(list);
        onIssuesCountChange?.(list.filter((i: any) => i.status === 'open').length);
      }
    } catch (err) {
      console.warn('[SellerIssuesTab] Error fetching issues:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, onIssuesCountChange]);

  useEffect(() => {
    fetchIssues();

    if (!userId) return;
    const channel = supabase
      .channel(`seller-issues-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `seller_id=eq.${userId}`,
        },
        () => {
          fetchIssues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchIssues]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return '#EF4444';
      case 'high':
        return '#F97316';
      default:
        return '#3B82F6';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading reported issues...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Help & Reported Issues</Text>
          <Text style={styles.headerSubtitle}>
            Track buyer disputes, delivery incidents, and resolution status
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLoading(true);
            fetchIssues();
          }}
        >
          <RefreshCw size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {issues.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <CheckCircle2 size={36} color="#10B981" />
          </View>
          <Text style={styles.emptyTitle}>Everything is Smooth!</Text>
          <Text style={styles.emptySub}>
            You don't have any reported issues or active disputes against your store. Keep up the great service!
          </Text>
          {onContactSupport && (
            <TouchableOpacity
              style={styles.supportSecondaryBtn}
              onPress={onContactSupport}
            >
              <MessageSquare size={16} color={colors.primary} />
              <Text style={styles.supportSecondaryBtnText}>Need Help? Contact Support</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.listContainer}>
          {issues.map((issue) => {
            const priorityColor = getPriorityColor(issue.priority);
            const isOpen = issue.status === 'open';

            return (
              <View key={issue.id} style={styles.issueCard}>
                {/* Priority Indicator Strip */}
                <View
                  style={[
                    styles.priorityStrip,
                    { backgroundColor: priorityColor },
                  ]}
                />

                <View style={styles.issueBody}>
                  {/* Top Badges & Title */}
                  <View style={styles.issueTopRow}>
                    <View style={styles.badgesRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isOpen ? '#FEF2F2' : '#ECFDF5',
                          },
                        ]}
                      >
                        {isOpen ? (
                          <Clock size={11} color="#DC2626" />
                        ) : (
                          <CheckCircle2 size={11} color="#059669" />
                        )}
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isOpen ? '#DC2626' : '#059669' },
                          ]}
                        >
                          {(issue.status || 'open').toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.priorityBadge,
                          { backgroundColor: `${priorityColor}15` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityBadgeText,
                            { color: priorityColor },
                          ]}
                        >
                          {(issue.priority || 'normal').toUpperCase()} PRIORITY
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.issueIdText}>
                      #{String(issue.id).slice(0, 8)}
                    </Text>
                  </View>

                  <Text style={styles.issueTitle}>{issue.title || 'Reported Order Issue'}</Text>
                  <Text style={styles.issueDescription} numberOfLines={3}>
                    {issue.description || 'No additional description provided.'}
                  </Text>

                  {/* Meta Grid */}
                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <User size={13} color="#64748B" />
                      <View>
                        <Text style={styles.metaLabel}>REPORTER</Text>
                        <Text style={styles.metaValue}>
                          {issue.reporter?.display_name || 'Verified Customer'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaItem}>
                      <Package size={13} color="#64748B" />
                      <View>
                        <Text style={styles.metaLabel}>LINKED ORDER</Text>
                        <Text style={styles.metaValue}>
                          {issue.order_id
                            ? `#${String(issue.order_id).slice(0, 8)}`
                            : 'General'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaItem}>
                      <Calendar size={13} color="#64748B" />
                      <View>
                        <Text style={styles.metaLabel}>REPORTED DATE</Text>
                        <Text style={styles.metaValue}>
                          {issue.created_at
                            ? new Date(issue.created_at).toLocaleDateString()
                            : 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Evidence Thumbnail / Button */}
                  {issue.evidence_url ? (
                    <TouchableOpacity
                      style={styles.evidenceBanner}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setEvidenceModalUrl(issue.evidence_url);
                      }}
                    >
                      <Image
                        source={{ uri: issue.evidence_url }}
                        style={styles.evidenceThumb}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.evidenceTitle}>Photo Evidence Attached</Text>
                        <Text style={styles.evidenceSub}>Tap to inspect full screen</Text>
                      </View>
                      <Eye size={16} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}

                  {/* Actions Row */}
                  <View style={styles.actionsRow}>
                    {onContactSupport && (
                      <TouchableOpacity
                        style={styles.contactSupportBtn}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onContactSupport();
                        }}
                      >
                        <MessageSquare size={14} color={colors.foreground} />
                        <Text style={styles.contactSupportText}>Contact Support</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.viewDetailsBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedIssue(issue);
                      }}
                    >
                      <Text style={styles.viewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Full Screen Evidence Preview Modal */}
      <Modal
        visible={!!evidenceModalUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setEvidenceModalUrl(null)}
      >
        <View style={styles.evidenceModalOverlay}>
          <TouchableOpacity
            style={styles.closeEvidenceBtn}
            onPress={() => setEvidenceModalUrl(null)}
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {evidenceModalUrl && (
            <Image
              source={{ uri: evidenceModalUrl }}
              style={styles.fullEvidenceImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Issue Details Modal */}
      <Modal
        visible={!!selectedIssue}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedIssue(null)}
      >
        <View style={styles.detailsModalOverlay}>
          <View style={styles.detailsModalCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsHeaderTitle}>Issue Details</Text>
              <TouchableOpacity
                style={styles.closeDetailsBtn}
                onPress={() => setSelectedIssue(null)}
              >
                <X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedIssue && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.detailsIssueTitle}>{selectedIssue.title}</Text>
                <Text style={styles.detailsIssueDesc}>{selectedIssue.description}</Text>

                <View style={styles.detailsInfoBox}>
                  <View style={styles.detailsInfoRow}>
                    <Text style={styles.detailsInfoLabel}>Issue ID</Text>
                    <Text style={styles.detailsInfoValue}>
                      #{String(selectedIssue.id).slice(0, 12)}
                    </Text>
                  </View>
                  <View style={styles.detailsInfoRow}>
                    <Text style={styles.detailsInfoLabel}>Status</Text>
                    <Text style={styles.detailsInfoValue}>
                      {String(selectedIssue.status || 'open').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailsInfoRow}>
                    <Text style={styles.detailsInfoLabel}>Priority</Text>
                    <Text style={styles.detailsInfoValue}>
                      {String(selectedIssue.priority || 'normal').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailsInfoRow}>
                    <Text style={styles.detailsInfoLabel}>Reporter</Text>
                    <Text style={styles.detailsInfoValue}>
                      {selectedIssue.reporter?.display_name || 'Verified Customer'}
                    </Text>
                  </View>
                  {selectedIssue.order_id && (
                    <View style={styles.detailsInfoRow}>
                      <Text style={styles.detailsInfoLabel}>Order ID</Text>
                      <Text style={styles.detailsInfoValue}>
                        #{String(selectedIssue.order_id).slice(0, 12)}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedIssue.evidence_url && (
                  <Image
                    source={{ uri: selectedIssue.evidence_url }}
                    style={styles.detailsEvidenceImage}
                    resizeMode="cover"
                  />
                )}

                {onContactSupport && (
                  <TouchableOpacity
                    style={styles.detailsPrimaryBtn}
                    onPress={() => {
                      setSelectedIssue(null);
                      onContactSupport();
                    }}
                  >
                    <MessageSquare size={16} color="#FFFFFF" />
                    <Text style={styles.detailsPrimaryBtnText}>
                      Open Support Ticket for Resolution
                    </Text>
                  </TouchableOpacity>
                )}
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
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  emptySub: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  supportSecondaryBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3EC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  supportSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  listContainer: {
    gap: 12,
  },
  issueCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  priorityStrip: {
    width: 5,
  },
  issueBody: {
    flex: 1,
    padding: 16,
  },
  issueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  issueIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
    marginBottom: 4,
  },
  issueDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '28%',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
  },
  evidenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#FFF3EC',
    borderRadius: 12,
    marginBottom: 12,
  },
  evidenceThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  evidenceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.foreground,
  },
  evidenceSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactSupportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  contactSupportText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  viewDetailsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  evidenceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  closeEvidenceBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullEvidenceImage: {
    width: '100%',
    height: '78%',
    borderRadius: 16,
  },
  detailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  detailsModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailsHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  closeDetailsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsIssueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
    marginBottom: 6,
  },
  detailsIssueDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsInfoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailsInfoValue: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '800',
  },
  detailsEvidenceImage: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    marginBottom: 16,
  },
  detailsPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  detailsPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
