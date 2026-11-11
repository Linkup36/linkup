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
  Route,
  AlertTriangle,
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

  // Package specifications parsing
  let packageDetails: any = null;
  if (shipment.package_details) {
    if (typeof shipment.package_details === 'string') {
      try {
        packageDetails = JSON.parse(shipment.package_details);
      } catch {
        packageDetails = { contents: shipment.package_details };
      }
    } else {
      packageDetails = shipment.package_details;
    }
  }

  // Cross-zone fee & indicator
  const crossZoneFee = Number(
    shipment.cross_zone_fee ||
    shipment.cross_zone_fee_amount ||
    shipment.order?.cross_zone_fee ||
    0
  );
  const isCrossZone = Boolean(
    crossZoneFee > 0 ||
    shipment.is_cross_zone ||
    shipment.order?.is_cross_zone
  );

  // Distance & route directions
  const rawDistance = shipment.distance_km || shipment.distance || shipment.estimated_distance;
  const distanceKm = rawDistance ? Number(rawDistance).toFixed(1) : null;
  const pickupDirections = shipment.pickup_directions || shipment.pickup_notes || '';
  const dropoffDirections = shipment.dropoff_directions || shipment.dropoff_notes || shipment.delivery_instructions || '';

  // Order items summary for marketplace orders
  const orderItems = shipment.order?.order_items || shipment.order_items || [];
  const orderItemsSummary = Array.isArray(orderItems) && orderItems.length > 0
    ? orderItems.map((item: any) => `${item.quantity || 1}x ${item.product?.title || item.title || 'Item'}`).join(', ')
    : null;

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
          <View style={styles.payoutLabelRow}>
            <Text style={styles.payoutStripLabel}>YOUR GUARANTEED CUT</Text>
            {isCrossZone && (
              <View style={styles.crossZoneTag}>
                <Route size={9} color="#c2410c" />
                <Text style={styles.crossZoneTagText}>CROSS-ZONE</Text>
              </View>
            )}
          </View>
          <Text style={styles.payoutStripAmount}>
            ₦{riderEarnings.toLocaleString('en-NG')}
          </Text>
          {crossZoneFee > 0 && (
            <Text style={styles.crossZoneSubtext}>
              Includes +₦{crossZoneFee.toLocaleString('en-NG')} cross-zone fee
            </Text>
          )}
        </View>
        <View style={styles.escrowChip}>
          <ShieldCheck size={12} color="#059669" strokeWidth={2.5} />
          <Text style={styles.escrowChipText}>ESCROW PROTECTED</Text>
        </View>
      </View>

      {/* Package Specifications (Send Packages) */}
      {isSendOrder && packageDetails && (
        <View style={styles.packageCard}>
          <View style={styles.packageCardHeader}>
            <View style={styles.pkgRow}>
              <Package size={13} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.packageCardTitle}>PACKAGE DETAILS</Text>
            </View>
            {packageDetails.weight_kg ? (
              <View style={styles.weightBadge}>
                <Text style={styles.weightBadgeText}>
                  {packageDetails.weight_kg <= 2 ? 'Small (<2kg)' : `${packageDetails.weight_kg}kg`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.packageDetailRow}>
            <Text style={styles.detailLabel}>Contents: </Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {packageDetails.contents || 'General Parcel'}
            </Text>
            {packageDetails.is_fragile ? (
              <View style={styles.fragileBadge}>
                <Text style={styles.fragileBadgeText}>⚠️ Fragile</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Order Items Summary (Marketplace Orders) */}
      {!isSendOrder && orderItemsSummary && (
        <View style={styles.marketplaceOrderCard}>
          <View style={styles.pkgRow}>
            <Package size={13} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.packageCardTitle}>ORDER ITEMS ({orderItems.length})</Text>
          </View>
          <Text style={styles.orderItemsSummary} numberOfLines={2}>
            {orderItemsSummary}
          </Text>
        </View>
      )}

      {/* Route Nodes */}
      <View style={styles.nodesContainer}>
        {/* Distance & Trip Metrics Header */}
        <View style={styles.routeHeaderRow}>
          <View style={styles.metricItem}>
            <Navigation size={12} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.metricText}>
              {distanceKm ? `${distanceKm} km` : 'Local delivery'}
            </Text>
          </View>
          {isCrossZone && (
            <View style={styles.crossZonePill}>
              <Route size={11} color="#ea580c" strokeWidth={2.5} />
              <Text style={styles.crossZonePillText}>Cross-Zone Trip</Text>
            </View>
          )}
        </View>

        {/* Pickup Row */}
        <View style={styles.nodeItem}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={styles.nodeTextWrap}>
            <Text style={styles.nodeRole}>
              PICKUP: <Text style={styles.nodeName}>{sellerInfo.name}</Text>
            </Text>
            <Text style={styles.nodeAddress} numberOfLines={2}>
              {pickupAddress}
            </Text>
            {pickupDirections ? (
              <Text style={styles.nodeDirections} numberOfLines={1}>
                Note: "{pickupDirections}"
              </Text>
            ) : null}
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
            <Text style={styles.nodeAddress} numberOfLines={2}>
              {deliveryAddress}
            </Text>
            {dropoffDirections ? (
              <Text style={styles.nodeDirections} numberOfLines={1}>
                Note: "{dropoffDirections}"
              </Text>
            ) : null}
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
  payoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutStripLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.4,
  },
  crossZoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ffedd5',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  crossZoneTagText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.2,
  },
  payoutStripAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#14532d',
    letterSpacing: -0.3,
  },
  crossZoneSubtext: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803d',
    marginTop: 2,
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
  packageCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  packageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  packageCardTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  weightBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  weightBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  packageDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    flexShrink: 1,
  },
  fragileBadge: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  fragileBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#b91c1c',
  },
  marketplaceOrderCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  orderItemsSummary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 15,
  },
  nodesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  crossZonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  crossZonePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ea580c',
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
  nodeDirections: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#64748b',
    marginTop: 2,
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
