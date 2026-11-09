import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { AlertCircle, Calendar, Gavel, CheckCircle2 } from 'lucide-react-native';
import { format } from 'date-fns';

interface ReportCardProps {
  issue: any;
}

export function ReportCard({ issue }: ReportCardProps) {
  const isResolved = issue.status === 'resolved';
  const isFinancial = issue.category === 'financial_dispute';

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.stripe,
          isFinancial ? styles.stripeFinancial : isResolved ? styles.stripeResolved : styles.stripeOpen,
        ]}
      />

      <View style={styles.body}>
        {/* Top Header */}
        <View style={styles.topRow}>
          <View style={styles.iconAndTitle}>
            <View
              style={[
                styles.iconWrap,
                isFinancial ? styles.iconWrapFinancial : styles.iconWrapGeneral,
              ]}
            >
              {isFinancial ? (
                <Gavel size={18} color="#dc2626" />
              ) : (
                <AlertCircle size={18} color="#2563eb" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.issueTitle} numberOfLines={1}>
                {issue.title}
              </Text>
              <View style={styles.dateRow}>
                <Calendar size={10} color="#94a3b8" />
                <Text style={styles.dateText}>
                  {issue.created_at
                    ? format(new Date(issue.created_at), 'MMM d, yyyy • h:mm a')
                    : 'Recent'}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              issue.status === 'open'
                ? styles.statusOpen
                : isResolved
                ? styles.statusResolved
                : styles.statusDefault,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                issue.status === 'open'
                  ? styles.statusTextOpen
                  : isResolved
                  ? styles.statusTextResolved
                  : styles.statusTextDefault,
              ]}
            >
              {issue.status?.toUpperCase() || 'OPEN'}
            </Text>
          </View>
        </View>

        {/* Description Box */}
        <View style={styles.descBox}>
          <Text style={styles.descText}>"{issue.description}"</Text>
        </View>

        {/* Involved Product if any */}
        {issue.product && (
          <View style={styles.productRow}>
            {issue.product.images?.[0] ? (
              <Image source={{ uri: issue.product.images[0] }} style={styles.productThumb} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.productSub}>INVOLVED ASSET</Text>
              <Text style={styles.productTitle} numberOfLines={1}>
                {issue.product.title}
              </Text>
            </View>
          </View>
        )}

        {/* Resolution Adjudication */}
        {isResolved && issue.resolution_meta && (
          <View style={styles.resolutionBox}>
            <View style={styles.resolutionHeader}>
              <CheckCircle2 size={14} color="#16a34a" />
              <Text style={styles.resolutionLabel}>OFFICIAL ADJUDICATION RESULT</Text>
            </View>
            <Text style={styles.resolutionType}>
              Mechanism: {issue.resolution_meta.resolution === 'refund' ? 'Refund Processed' : 'Escrow Finalized'}
            </Text>
            {issue.resolution_meta.notes ? (
              <Text style={styles.resolutionNotes}>"{issue.resolution_meta.notes}"</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  stripe: {
    width: 5,
  },
  stripeFinancial: {
    backgroundColor: '#ef4444',
  },
  stripeResolved: {
    backgroundColor: '#10b981',
  },
  stripeOpen: {
    backgroundColor: '#f59e0b',
  },
  body: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  iconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapFinancial: {
    backgroundColor: '#fef2f2',
  },
  iconWrapGeneral: {
    backgroundColor: '#eff6ff',
  },
  issueTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: '#fef2f2',
  },
  statusResolved: {
    backgroundColor: '#ecfdf5',
  },
  statusDefault: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusTextOpen: {
    color: '#dc2626',
  },
  statusTextResolved: {
    color: '#16a34a',
  },
  statusTextDefault: {
    color: '#64748b',
  },
  descBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  productThumb: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  productSub: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  productTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  resolutionBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  resolutionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.8,
  },
  resolutionType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  resolutionNotes: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
    fontStyle: 'italic',
  },
});
