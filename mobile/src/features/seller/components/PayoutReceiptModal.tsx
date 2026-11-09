import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import {
  Landmark,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  ShieldCheck,
  Share2,
  FileText,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppModal } from '../../../components/ui/AppModal';
import { colors } from '../../../theme/colors';

interface PayoutReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  request: any;
}

export function PayoutReceiptModal({
  visible,
  onClose,
  request,
}: PayoutReceiptModalProps) {
  if (!request) return null;

  const statusConfig: Record<
    string,
    { icon: any; color: string; bg: string; border: string; label: string; desc: string }
  > = {
    pending: {
      icon: Clock,
      color: '#b45309',
      bg: '#fef3c7',
      border: '#fde68a',
      label: 'Pending Review',
      desc: 'Your request has been queued and is awaiting admin approval and escrow release (typically 1-2 hours).',
    },
    approved: {
      icon: CheckCircle2,
      color: '#1d4ed8',
      bg: '#dbeafe',
      border: '#bfdbfe',
      label: 'Approved (Processing)',
      desc: 'Your withdrawal has been approved and is being disbursed to your settlement account.',
    },
    processing: {
      icon: Clock,
      color: '#1d4ed8',
      bg: '#dbeafe',
      border: '#bfdbfe',
      label: 'Disbursing Funds',
      desc: 'Settlement transfer is currently in flight via automated NIP banking rails.',
    },
    completed: {
      icon: CheckCircle2,
      color: '#15803d',
      bg: '#dcfce7',
      border: '#bbf7d0',
      label: 'Disbursed (Paid)',
      desc: 'Funds have been successfully transferred to your destination bank account.',
    },
    rejected: {
      icon: XCircle,
      color: '#b91c1c',
      bg: '#fee2e2',
      border: '#fecaca',
      label: 'Rejected',
      desc: 'This withdrawal request could not be completed. Your funds remain safely in your store balance.',
    },
  };

  const currentStatus =
    statusConfig[request.status?.toLowerCase()] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  const amount = Number(request.amount || 0);
  const fee = Number(request.fee_amount || 0);
  const totalDeduction = amount + fee;

  const handleCopyId = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      await Share.share({
        message: `LinkUp Withdrawal Ref: #${request.id.slice(0, 8).toUpperCase()}`,
      });
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      await Share.share({
        title: 'LinkUp Withdrawal Receipt',
        message: `LinkUp Withdrawal Receipt\nAmount: ₦${amount.toLocaleString()}\nStatus: ${currentStatus.label}\nBank: ${request.bank_name || 'N/A'}\nAccount: ${request.account_number || 'N/A'}\nRef ID: #${request.id.slice(0, 8).toUpperCase()}`,
      });
    } catch {
      // ignore
    }
  };

  const formattedDate = request.created_at
    ? new Date(request.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent';

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Withdrawal Receipt"
      subtitle="Financial settlement confirmation"
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Pill Card */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: currentStatus.bg, borderColor: currentStatus.border },
          ]}
        >
          <View style={styles.statusBannerHeader}>
            <StatusIcon size={18} color={currentStatus.color} strokeWidth={2.5} />
            <Text style={[styles.statusBannerText, { color: currentStatus.color }]}>
              {currentStatus.label}
            </Text>
          </View>
          <Text style={[styles.statusBannerDesc, { color: currentStatus.color }]}>
            {currentStatus.desc}
          </Text>
        </View>

        {/* Amount Box */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>NET PAYOUT AMOUNT</Text>
          <Text style={styles.amountValue}>₦{amount.toLocaleString()}</Text>
          <View style={styles.feeBadge}>
            <Wallet size={12} color="#64748b" />
            <Text style={styles.feeText}>
              Total wallet deduction: ₦{totalDeduction.toLocaleString()} (incl. ₦{fee.toLocaleString()} fee)
            </Text>
          </View>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsCard}>
          {/* Reference ID */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference ID</Text>
            <TouchableOpacity
              style={styles.copyRow}
              onPress={handleCopyId}
              activeOpacity={0.7}
            >
              <Text style={styles.refText}>#{request.id.slice(0, 8).toUpperCase()}</Text>
              <FileText size={12} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Settlement Bank */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Destination Bank</Text>
            <View style={styles.iconValRow}>
              <Landmark size={14} color={colors.primary} />
              <Text style={styles.detailValueBold}>{request.bank_name || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Account Number */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Number</Text>
            <Text style={styles.detailValueMono}>{request.account_number || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Account Name */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Holder</Text>
            <Text style={styles.detailValueBold}>{request.account_name || 'Store Merchant'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Date Requested */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date Requested</Text>
            <View style={styles.iconValRow}>
              <Calendar size={13} color="#64748b" />
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
          </View>

          {request.admin_notes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Admin Note</Text>
                <Text style={styles.noteText}>{request.admin_notes}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Security badge */}
        <View style={styles.securityRow}>
          <ShieldCheck size={14} color="#16a34a" />
          <Text style={styles.securityText}>
            Protected by LinkUp Escrow & Settlement Guarantee
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Share2 size={16} color="#0f172a" />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  statusBanner: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  statusBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBannerDesc: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.9,
  },
  amountBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
  },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  feeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  detailValueMono: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  iconValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  refText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  noteBox: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 8,
    gap: 4,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#92400e',
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
