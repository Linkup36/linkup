import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, CheckCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { colors } from '../../../theme/colors';

interface StatusItem {
  id: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface ShipmentStatusHistoryProps {
  history: StatusItem[];
}

export function ShipmentStatusHistory({ history }: ShipmentStatusHistoryProps) {
  if (!history || history.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Clock size={14} color={colors.primary} />
        <Text style={styles.title}>Status Audit History</Text>
      </View>

      <View style={styles.timelineList}>
        {history.map((item, idx) => {
          const isLatest = idx === 0;
          return (
            <View key={item.id || idx} style={styles.itemRow}>
              <View style={styles.dotCol}>
                <View style={[styles.dot, isLatest && styles.dotActive]} />
                {idx < history.length - 1 && <View style={styles.line} />}
              </View>

              <View style={styles.contentCol}>
                <Text style={[styles.statusText, isLatest && styles.statusTextActive]}>
                  {item.status.replace(/_/g, ' ').toUpperCase()}
                </Text>
                {item.notes ? (
                  <Text style={styles.notesText}>{item.notes}</Text>
                ) : null}
                <Text style={styles.timeText}>
                  {format(new Date(item.created_at), 'MMM d, h:mm a')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dotCol: {
    alignItems: 'center',
    width: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#cbd5e1',
    marginTop: 3,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  contentCol: {
    flex: 1,
    paddingBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  statusTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  notesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
});
