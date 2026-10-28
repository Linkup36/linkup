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

const notifyCustomerOfShipmentUpdate = async (options: {
  buyerId?: string;
  orderId: string;
  status: string;
  isSendOrder: boolean;
}) => {
  if (!options.buyerId) return;
  const snippet = String(options.orderId).slice(-8).toUpperCase();
  let title = 'Order Update 📦';
  let message = `Your order #${snippet} status is now ${options.status}.`;

  if (options.isSendOrder) {
    switch (options.status) {
      case 'accepted':
      case 'assigned_rider':
        title = 'Courier Assigned! 🏍️';
        message = `A courier has been assigned to pick up your package #${snippet}.`;
        break;
      case 'pickup':
      case 'picked_up':
        title = 'Package Picked Up! 📦';
        message = `Your package #${snippet} has been picked up and is in transit.`;
        break;
      case 'on_the_way':
      case 'in_transit':
        title = 'Package In Transit! 🚚';
        message = `Your package #${snippet} is on the way to the drop-off destination!`;
        break;
      case 'delivered':
        title = 'Package Delivered! 🎉';
        message = `Your package #${snippet} has been delivered to the recipient!`;
        break;
    }
  } else {
    switch (options.status) {
      case 'accepted':
      case 'assigned':
        title = 'Rider Assigned! 🏍️';
        message = `A courier has been assigned to order #${snippet} and is heading to pickup.`;
        break;
      case 'pickup':
      case 'picked_up':
      case 'started':
        title = 'Order Picked Up! 📦';
        message = `Your order #${snippet} has been picked up by the courier!`;
        break;
      case 'on_the_way':
      case 'in_transit':
        title = 'Out for Delivery! 🚚';
        message = `Your order #${snippet} is on the way! Track your courier live.`;
        break;
      case 'delivered':
        title = 'Order Delivered! 🎉';
        message = `Your order #${snippet} has been delivered! Please inspect your package and confirm delivery.`;
        break;
    }
  }

  try {
    await supabase.from('notifications').insert({
      user_id: options.buyerId,
      type: options.status === 'delivered' ? 'delivery_completed' : 'order',
      title,
      message,
    } as any);

    supabase.functions
      .invoke('send-push', {
        body: {
          target_user_id: options.buyerId,
          title,
          message,
          url: options.isSendOrder ? `/send` : `/orders/${options.orderId}`,
          type: 'order',
          save_notification: false,
        },
      })
      .catch((e) => console.warn('[ShipmentCardV2] Customer push notice:', e));
  } catch (e) {
    console.warn('[ShipmentCardV2] Notification insert notice:', e);
  }
};

export function ShipmentCardV2({
  shipment,
  onPress,
  onMissionUpdated,
  userId,
}: ShipmentCardV2Props) {
  const [updating, setUpdating] = useState(false);
  const [addressExpanded, setAddressExpanded] = useState(false);

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
          let customerId = shipment?.user_id || shipment?.sender_id;
          if (customerId) {
            notifyCustomerOfShipmentUpdate({
              buyerId: customerId,
              orderId,
              status: mapped,
              isSendOrder: true,
            });
          }
        }
      } else {
        if (newStatus === 'accepted') {
          const { data, error } = await (supabase as any).rpc('claim_order_mission', {
            p_shipment_id: shipment.id || orderId,
            p_rider_id: userId,
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'Mission already accepted');

          let buyerId = shipment?.order?.buyer_id || shipment?.buyer?.id;
          if (!buyerId) {
            const { data: o } = await supabase.from('orders').select('buyer_id').eq('id', orderId).maybeSingle();
            buyerId = o?.buyer_id;
          }
          if (buyerId) {
            notifyCustomerOfShipmentUpdate({
              buyerId,
              orderId,
              status: 'accepted',
              isSendOrder: false,
            });
          }
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

          let buyerId = shipment?.order?.buyer_id || shipment?.buyer?.id;
          if (!buyerId) {
            const { data: o } = await supabase.from('orders').select('buyer_id').eq('id', orderId).maybeSingle();
            buyerId = o?.buyer_id;
          }
          if (buyerId) {
            notifyCustomerOfShipmentUpdate({
              buyerId,
              orderId,
              status: newStatus,
              isSendOrder: false,
            });
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
          <View style={styles.refWrap}>
            <View style={styles.refRow}>
              <Text style={styles.refNumber}>
                #{String(orderId || '').slice(-8).toUpperCase()}
              </Text>
              {isSendOrder && (
                <View style={styles.sendBadge}>
                  <Text style={styles.sendBadgeText}>SEND PKG</Text>
                </View>
              )}
            </View>
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
          <Text style={styles.payoutStripLabel}>GUARANTEED PAYOUT</Text>
          <Text style={styles.payoutStripAmount}>
            ₦{riderEarnings.toLocaleString('en-NG')}
          </Text>
        </View>
        <View style={styles.escrowChip}>
          <ShieldCheck size={12} color="#059669" strokeWidth={2.4} />
          <Text style={styles.escrowChipText}>Escrow Protected</Text>
        </View>
      </View>

      {/* Route Nodes with Breathing Room and Address Wrapping */}
      <TouchableOpacity
        style={styles.nodesContainer}
        activeOpacity={0.9}
        onPress={() => setAddressExpanded((prev) => !prev)}
      >
        {/* Pickup Row */}
        <View style={styles.nodeItem}>
          <View style={styles.dotWrap}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.nodeTextWrap}>
            <Text style={styles.nodeRole}>
              PICKUP • <Text style={styles.nodeName}>{sellerInfo.name}</Text>
            </Text>
            <Text
              style={styles.nodeAddress}
              numberOfLines={addressExpanded ? undefined : 2}
            >
              {pickupAddress}
            </Text>
          </View>
          {sellerInfo.phone ? (
            <TouchableOpacity
              style={styles.phoneIconBtn}
              onPress={() => callPhoneNumber(sellerInfo.phone)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Phone size={13} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Vertical connector */}
        <View style={styles.verticalDashed} />

        {/* Drop-off Row */}
        <View style={styles.nodeItem}>
          <View style={styles.dotWrap}>
            <View style={[styles.dot, { backgroundColor: '#16a34a' }]} />
          </View>
          <View style={styles.nodeTextWrap}>
            <Text style={[styles.nodeRole, { color: '#16a34a' }]}>
              DROP-OFF • <Text style={styles.nodeName}>{buyerContact.name}</Text>
            </Text>
            <Text
              style={styles.nodeAddress}
              numberOfLines={addressExpanded ? undefined : 2}
            >
              {deliveryAddress}
            </Text>
          </View>
          {buyerContact.phone ? (
            <TouchableOpacity
              style={[styles.phoneIconBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
              onPress={() => callPhoneNumber(buyerContact.phone)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Phone size={13} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Card Action Footer: One Prominent Action */}
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
                <ArrowRight size={15} color="#ffffff" strokeWidth={2.6} />
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
                <ArrowRight size={15} color="#ffffff" strokeWidth={2.6} />
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
                <ArrowRight size={15} color="#ffffff" strokeWidth={2.6} />
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
                <CheckCircle2 size={15} color="#ffffff" strokeWidth={2.6} />
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
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
    flex: 1,
  },
  pkgIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(235, 125, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refWrap: {
    justifyContent: 'center',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  sendBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  sendBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  payoutStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payoutStripLeft: {
    gap: 2,
  },
  payoutStripLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
  },
  payoutStripAmount: {
    fontSize: 19,
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
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  escrowChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.2,
  },
  nodesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotWrap: {
    width: 14,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  nodeTextWrap: {
    flex: 1,
  },
  nodeRole: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  nodeName: {
    color: '#0f172a',
    fontWeight: '800',
  },
  nodeAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 18,
  },
  phoneIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalDashed: {
    width: 2,
    height: 14,
    backgroundColor: '#cbd5e1',
    marginLeft: 6,
    marginVertical: -2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  acceptBtn: {
    flex: 1,
    height: 46,
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
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  deliveredRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
  },
  deliveredRowText: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
});
