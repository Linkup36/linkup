import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  MapPin,
  Navigation,
  ChevronRight,
  ShieldCheck,
  Banknote,
  Phone,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import {
  getPickupAddress,
  getDeliveryAddress,
  getBuyerContact,
  getSellerInfo,
  calculateRiderEarnings,
  callPhoneNumber,
} from '../utils/logistics-utils';

interface ShipmentCardV2Props {
  shipment: any;
  onPress: () => void;
  onMissionUpdated?: () => void;
  userId?: string;
}

export function ShipmentCardV2({
  shipment,
  onPress,
  onMissionUpdated,
  userId,
}: ShipmentCardV2Props) {
  const [updating, setUpdating] = useState(false);

  const rawStatus = (shipment.status || 'pending').toLowerCase();
  const isSendOrder =
    shipment.is_send_order ||
    String(shipment.id || '').startsWith('LSEND') ||
    String(shipment.order_id || '').startsWith('LSEND');

  const isAssigned =
    !!(shipment.rider_id || shipment.driver_id) &&
    rawStatus !== 'pending' &&
    rawStatus !== 'awaiting_agent' &&
    rawStatus !== 'finding_rider';

  // Mission stage resolution:
  const getStage = (): 'unassigned' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' => {
    if (['delivered', 'completed'].includes(rawStatus)) return 'delivered';
    if (['in_transit', 'on_the_way'].includes(rawStatus)) return 'in_transit';
    if (['picked_up', 'pickup', 'arrived'].includes(rawStatus)) return 'picked_up';
    if (['assigned', 'accepted', 'started', 'assigned_rider'].includes(rawStatus)) return 'assigned';
    if (!isAssigned || ['pending', 'awaiting_agent', 'finding_rider'].includes(rawStatus)) return 'unassigned';
    return 'assigned';
  };

  const stage = getStage();
  const riderEarnings = calculateRiderEarnings(shipment);
  const sellerInfo = getSellerInfo(shipment);
  const buyerContact = getBuyerContact(shipment);
  const pickupAddress = getPickupAddress(shipment);
  const deliveryAddress = getDeliveryAddress(shipment);
  const orderId = shipment.order_id || shipment.id;

  const getStatusBadge = () => {
    switch (stage) {
      case 'unassigned':
        return { label: 'AVAILABLE', bg: '#fef3c7', text: '#b45309' };
      case 'assigned':
        return { label: 'ACCEPTED', bg: '#ffedd5', text: '#ea580c' };
      case 'picked_up':
        return { label: 'PICKED UP', bg: '#f3e8ff', text: '#7e22ce' };
      case 'in_transit':
        return { label: 'IN TRANSIT', bg: '#e0e7ff', text: '#4338ca' };
      case 'delivered':
        return { label: 'DELIVERED', bg: '#dcfce7', text: '#15803d' };
      default:
        return { label: 'ACTIVE', bg: '#fef3c7', text: '#b45309' };
    }
  };

  const badge = getStatusBadge();

  const handleQuickAction = async (newStatus: string) => {
    try {
      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isSendOrder) {
        if (newStatus === 'accepted') {
          const { data, error } = await (supabase as any).rpc('claim_send_order_mission', {
            p_order_id: orderId,
            p_rider_id: userId,
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Mission already accepted');
        } else {
          const statusMap: Record<string, string> = {
            started: 'assigned_rider',
            assigned: 'assigned_rider',
            arrived: 'pickup',
            picked_up: 'pickup',
            in_transit: 'on_the_way',
            delivered: 'delivered',
          };
          const mapped = statusMap[newStatus] || newStatus;
          const payload: any = {
            status: mapped,
            updated_at: new Date().toISOString(),
          };
          if (mapped === 'delivered') {
            payload.delivered_at = new Date().toISOString();
          }
          const { error } = await (supabase as any)
            .from('send_orders')
            .update(payload)
            .eq('id', orderId);
          if (error) throw error;
        }
      } else {
        if (newStatus === 'accepted') {
          const { data, error } = await (supabase as any).rpc('claim_order_mission', {
            p_shipment_id: shipment.id || orderId,
            p_rider_id: userId,
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Mission already accepted');
        } else {
          let query = (supabase as any).from('shipments').update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          });
          if (shipment.id && orderId && shipment.id !== orderId) {
            query = query.or(`id.eq.${shipment.id},order_id.eq.${orderId}`);
          } else if (shipment.id) {
            query = query.or(`id.eq.${shipment.id},order_id.eq.${shipment.id}`);
          } else {
            query = query.eq('order_id', orderId);
          }
          const { error } = await query;
          if (error) throw error;

          if (newStatus === 'delivered') {
            const buyerId = shipment?.order?.buyer_id || shipment?.buyer?.id;
            if (buyerId) {
              await supabase.from('notifications').insert({
                user_id: buyerId,
                type: 'delivery_completed',
                message: `Your order #${String(orderId).slice(-8)} has been delivered! Please confirm delivery to release rider escrow payout.`,
              });
            }
          }
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(
        newStatus === 'delivered'
          ? `Mission delivered! ₦${riderEarnings.toLocaleString()} placed in Escrow Safety Hold awaiting buyer confirmation.`
          : `Mission updated to ${newStatus.toUpperCase()}`
      );

      if (onMissionUpdated) {
        onMissionUpdated();
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Mission quick action error:', err);
      toast.error(err.message || 'Status update failed');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={onPress}
    >
      {/* Top Ref & Status Row */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.pkgIconWrap}>
            <Package size={18} color={colors.primary} strokeWidth={2.4} />
          </View>
          <View>
            <View style={styles.refRow}>
              <Text style={styles.refLabel}>MISSION</Text>
              {isSendOrder && (
                <View style={styles.sendBadge}>
                  <Text style={styles.sendBadgeText}>SEND PKG</Text>
                </View>
              )}
            </View>
            <Text style={styles.refNumber}>
              #{String(shipment.order_id || shipment.id || '').slice(-8).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Guaranteed Payout Banner */}
      <View style={styles.payoutStrip}>
        <View style={styles.payoutStripLeft}>
          <Text style={styles.payoutStripLabel}>YOUR GUARANTEED CUT</Text>
          <Text style={styles.payoutStripAmount}>
            ₦{riderEarnings.toLocaleString('en-NG')}
          </Text>
        </View>
        <View style={styles.escrowChip}>
          <ShieldCheck size={12} color="#059669" strokeWidth={2.5} />
          <Text style={styles.escrowChipText}>ESCROW PROTECTED</Text>
        </View>
      </View>

      {/* Route Nodes */}
      <View style={styles.nodesContainer}>
        {/* Pickup Row */}
        <View style={styles.nodeItem}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={styles.nodeTextWrap}>
            <Text style={styles.nodeRole}>
              PICKUP: <Text style={styles.nodeName}>{sellerInfo.name}</Text>
            </Text>
            <Text style={styles.nodeAddress} numberOfLines={1}>
              {pickupAddress}
            </Text>
          </View>
          {sellerInfo.phone ? (
            <TouchableOpacity
              style={styles.phoneIconBtn}
              onPress={() => callPhoneNumber(sellerInfo.phone)}
              activeOpacity={0.7}
            >
              <Phone size={12} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Dashed connector */}
        <View style={styles.verticalDashed} />

        {/* Drop-off Row */}
        <View style={styles.nodeItem}>
          <View style={[styles.dot, { backgroundColor: '#16a34a' }]} />
          <View style={styles.nodeTextWrap}>
            <Text style={[styles.nodeRole, { color: '#16a34a' }]}>
              DROP-OFF: <Text style={styles.nodeName}>{buyerContact.name}</Text>
            </Text>
            <Text style={styles.nodeAddress} numberOfLines={1}>
              {deliveryAddress}
            </Text>
          </View>
          {buyerContact.phone ? (
            <TouchableOpacity
              style={[styles.phoneIconBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
              onPress={() => callPhoneNumber(buyerContact.phone)}
              activeOpacity={0.7}
            >
              <Phone size={12} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Card Action Footer */}
      <View style={styles.cardFooter}>
        {stage === 'unassigned' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleQuickAction('accepted')}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.acceptBtnText}>ACCEPT MISSION</Text>
                <ArrowRight size={14} color="#ffffff" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        )}

        {stage === 'assigned' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: '#4f46e5' }]}
            onPress={() => handleQuickAction('picked_up')}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.acceptBtnText}>CONFIRM PICKUP</Text>
                <ArrowRight size={14} color="#ffffff" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        )}

        {stage === 'picked_up' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: '#7c3aed' }]}
            onPress={() => handleQuickAction('in_transit')}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.acceptBtnText}>START DELIVERY</Text>
                <ArrowRight size={14} color="#ffffff" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        )}

        {stage === 'in_transit' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: '#16a34a' }]}
            onPress={() => handleQuickAction('delivered')}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.acceptBtnText}>COMPLETE DELIVERY</Text>
                <CheckCircle2 size={14} color="#ffffff" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        )}

        {stage === 'delivered' && (
          <View style={styles.deliveredRow}>
            <ShieldCheck size={16} color="#16a34a" strokeWidth={2.5} />
            <Text style={styles.deliveredRowText}>DELIVERED • IN ESCROW</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.detailsBtnText}>Details</Text>
          <ChevronRight size={14} color="#64748b" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pkgIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  sendBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sendBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ea580c',
  },
  refNumber: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  payoutStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  payoutStripLeft: {
    gap: 1,
  },
  payoutStripLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.4,
  },
  payoutStripAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: -0.3,
  },
  escrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  escrowChipText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.2,
  },
  nodesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeTextWrap: {
    flex: 1,
  },
  nodeRole: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  nodeName: {
    color: '#0f172a',
    fontWeight: '800',
  },
  nodeAddress: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  phoneIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalDashed: {
    width: 1.5,
    height: 10,
    backgroundColor: '#cbd5e1',
    marginLeft: 3.25,
    marginVertical: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  acceptBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  acceptBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  deliveredRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
  },
  deliveredRowText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  detailsBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
  },
});
