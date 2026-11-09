import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../../theme/colors';

interface IssuesTabProps {
  issues: any[];
  loading?: boolean;
}

export function IssuesTab({ issues, loading = false }: IssuesTabProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View>
        <Text style={styles.subtitle}>Help & Support</Text>
        <Text style={styles.title}>Disputes & Issues</Text>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading support tickets...</Text>
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.smoothCard}>
          <View style={styles.smoothIconWrap}>
            <CheckCircle2 size={36} color="#10b981" />
          </View>
          <Text style={styles.smoothTitle}>Everything is Smooth!</Text>
          <Text style={styles.smoothSubtitle}>
            No issues or dispute reports have been found with your store. Keep up the great work!
          </Text>
        </View>
      ) : (
        <View style={styles.issuesList}>
          {issues.map((issue) => {
            const priority = (issue.priority || 'medium').toLowerCase();
            const isCritical = priority === 'critical';
            const isHigh = priority === 'high';

            return (
              <View key={issue.id} style={styles.issueCard}>
                <View
                  style={[
                    styles.priorityBar,
                    isCritical
                      ? styles.barCritical
                      : isHigh
                      ? styles.barHigh
                      : styles.barNormal,
                  ]}
                />
                <View style={styles.issueContent}>
                  <View style={styles.issueTopRow}>
                    <View
                      style={[
                        styles.priorityPill,
                        isCritical
                          ? styles.pillCritical
                          : isHigh
                          ? styles.pillHigh
                          : styles.pillNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityPillText,
                          isCritical
                            ? styles.pillTextCritical
                            : isHigh
                            ? styles.pillTextHigh
                            : styles.pillTextNormal,
                        ]}
                      >
                        {priority.toUpperCase()} PRIORITY
                      </Text>
                    </View>
                    <Text style={styles.issueRef}>#{issue.id.slice(0, 8).toUpperCase()}</Text>
                  </View>

                  <Text style={styles.issueTitle}>{issue.title || 'Reported Issue'}</Text>
                  {issue.description && (
                    <Text style={styles.issueDesc}>{issue.description}</Text>
                  )}

                  <Text style={styles.issueDate}>
                    {new Date(issue.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  smoothCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginTop: 8,
  },
  smoothIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  smoothTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  smoothSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  issuesList: {
    gap: 12,
  },
  issueCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  priorityBar: {
    width: 6,
  },
  barCritical: {
    backgroundColor: '#ef4444',
  },
  barHigh: {
    backgroundColor: '#ea580c',
  },
  barNormal: {
    backgroundColor: '#3b82f6',
  },
  issueContent: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  issueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillCritical: {
    backgroundColor: '#fef2f2',
  },
  pillHigh: {
    backgroundColor: '#fff7ed',
  },
  pillNormal: {
    backgroundColor: '#eff6ff',
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pillTextCritical: {
    color: '#dc2626',
  },
  pillTextHigh: {
    color: '#c2410c',
  },
  pillTextNormal: {
    color: '#1d4ed8',
  },
  issueRef: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  issueDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 16,
  },
  issueDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
});

