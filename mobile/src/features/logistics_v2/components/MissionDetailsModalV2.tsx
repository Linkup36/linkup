import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import {
  Package,
  X,
  MapPin,
  Navigation,
  Phone,
  Banknote,
  ShieldCheck,
  CheckCircle,
  Truck,
  Clock,
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
  openNavigationApp,
  callPhoneNumber,
} from '../utils/logistics-utils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MissionDetailsModalV2Props {
  visible: boolean;
  onClose: () => void;
  shipment: any;
  onMissionUpdated?: () => void;
  userId?: string;
}

const notifyCustomerOfMissionStatusUpdate = async (options: {
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
      .catch((e) => console.warn('[MissionDetailsModalV2] Customer push notice:', e));
  } catch (e) {
    console.warn('[MissionDetailsModalV2] Notification insert notice:', e);
  }
};

export function MissionDetailsModalV2({
  visible,
  onClose,
  shipment: initialShipment,
  onMissionUpdated,
  userId,
}: MissionDetailsModalV2Props) {
  const [updating, setUpdating] = useState(false);
  const [internalVisible, setInternalVisible] = useState(visible);

  const cachedShipmentRef = useRef(initialShipment);
  if (initialShipment) {
    cachedShipmentRef.current = initialShipment;
  }
  const shipment = initialShipment || cachedShipmentRef.current;

  // Framer Motion spring physics animated values
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT * 0.45)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const handleAnimatedClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT * 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      slideAnim.setValue(SCREEN_HEIGHT * 0.45);
      scaleAnim.setValue(0.92);
      backdropOpacity.setValue(0);

      // Spring entrance curve mimicking Framer Motion spring physics
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          mass: 0.85,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 22,
          mass: 0.85,
          stiffness: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (internalVisible) {
      handleAnimatedClose();
    }
  }, [visible]);

  if (!shipment && !internalVisible) return null;

  const isSendOrder =
    shipment?.is_send_order ||
    String(shipment?.id || '').startsWith('LSEND') ||
    String(shipment?.order_id || '').startsWith('LSEND');

  const rawStatus = (shipment?.status || 'pending').toLowerCase();
  const isAssigned =
    !!(shipment?.rider_id || shipment?.driver_id) &&
    rawStatus !== 'pending' &&
    rawStatus !== 'awaiting_agent' &&
    rawStatus !== 'finding_rider';

  // Mission stage resolution
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
  const orderId = shipment?.order_id || shipment?.id;

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

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Handle SEND package order
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

          const customerId = shipment?.user_id || shipment?.sender_id;
          if (customerId) {
            notifyCustomerOfMissionStatusUpdate({
              buyerId: customerId,
              orderId,
              status: mapped,
              isSendOrder: true,
            });
          }
        }
      } else {
        // Marketplace orders
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
            notifyCustomerOfMissionStatusUpdate({
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
            notifyCustomerOfMissionStatusUpdate({
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
          : `Mission status updated to ${newStatus.toUpperCase()}`
      );

      if (onMissionUpdated) {
        onMissionUpdated();
      }
      handleAnimatedClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Mission update error:', err);
      toast.error(err.message || 'Could not update mission');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal
      visible={internalVisible}
      animationType="none"
      transparent
      onRequestClose={handleAnimatedClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleAnimatedClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.dragPillWrap}>
            <View style={styles.dragPill} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <Package size={22} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Mission Control</Text>
                <Text style={styles.headerRef}>
                  REF: #{String(shipment?.order_id || shipment?.id || '').slice(-8).toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {badge.label}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleAnimatedClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748b" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Financial Payout Guarantee Card */}
            <View style={styles.payoutCard}>
              <View style={styles.payoutLeft}>
                <View style={styles.payoutIconWrap}>
                  <Banknote size={24} color="#ffffff" strokeWidth={2.5} />
                </View>
                <View>
                  <View style={styles.payoutLabelRow}>
                    <Text style={styles.payoutLabel}>GUARANTEED PAYOUT</Text>
                    <View style={styles.escrowPill}>
                      <Text style={styles.escrowPillText}>ESCROW</Text>
                    </View>
                  </View>
                  <Text style={styles.payoutAmount}>
                    ₦{riderEarnings.toLocaleString('en-NG')}
                  </Text>
                  <Text style={styles.payoutSubtext}>
                    Credited automatically to your Escrow Wallet on delivery
                  </Text>
                </View>
              </View>
              <ShieldCheck size={28} color="#10b981" />
            </View>

            {/* Package Specifications if SEND package */}
            {shipment.package_details && (
              <View style={styles.packageCard}>
                <View style={styles.packageCardHeader}>
                  <View style={styles.pkgRow}>
                    <Package size={14} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.packageCardTitle}>PACKAGE SPECIFICATIONS</Text>
                  </View>
                  <View style={styles.weightBadge}>
                    <Text style={styles.weightBadgeText}>
                      {shipment.package_details.weight_kg <= 2
                        ? 'Small (<2kg)'
                        : `${shipment.package_details.weight_kg}kg`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.packageDetailLine}>
                  <Text style={styles.detailLabel}>Contents: </Text>
                  <Text style={styles.detailValue}>
                    {shipment.package_details.contents || 'General Parcel'}
                  </Text>
                  {shipment.package_details.is_fragile ? (
                    <Text style={styles.fragileWarning}> • Fragile ⚠️</Text>
                  ) : null}
                </Text>
              </View>
            )}

            {/* Contacts Grid */}
            <View style={styles.contactsGrid}>
              {/* Sender / Seller Card */}
              <View style={styles.contactCard}>
                <Text style={styles.contactRole}>
                  {isSendOrder ? 'SENDER' : 'SELLER / STORE'}
                </Text>
                <Text style={styles.contactName} numberOfLines={1}>
                  {sellerInfo.name}
                </Text>
                {sellerInfo.phone ? (
                  <TouchableOpacity
                    style={styles.phoneActionBtn}
                    onPress={() => callPhoneNumber(sellerInfo.phone)}
                    activeOpacity={0.7}
                  >
                    <Phone size={13} color={colors.primary} />
                    <Text style={styles.phoneActionText}>{sellerInfo.phone}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noPhoneText}>No phone provided</Text>
                )}
              </View>

              {/* Recipient / Buyer Card */}
              <View style={styles.contactCard}>
                <Text style={styles.contactRole}>
                  {isSendOrder ? 'RECIPIENT' : 'BUYER'}
                </Text>
                <Text style={styles.contactName} numberOfLines={1}>
                  {buyerContact.name}
                </Text>
                {buyerContact.phone ? (
                  <TouchableOpacity
                    style={styles.phoneActionBtn}
                    onPress={() => callPhoneNumber(buyerContact.phone)}
                    activeOpacity={0.7}
                  >
                    <Phone size={13} color="#16a34a" />
                    <Text style={[styles.phoneActionText, { color: '#16a34a' }]}>
                      {buyerContact.phone}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noPhoneText}>No phone provided</Text>
                )}
              </View>
            </View>

            {/* Path Trace Section */}
            <View style={styles.pathTraceSection}>
              <View style={styles.pathHeaderRow}>
                <Route size={14} color="#64748b" strokeWidth={2.5} />
                <Text style={styles.pathHeaderTitle}>MISSION ROUTE TRACE</Text>
              </View>

              <View style={styles.routeContainer}>
                {/* Connecting Line */}
                <View style={styles.routeConnectorLine} />

                {/* Pickup Node */}
                <View style={styles.routeNode}>
                  <View style={[styles.nodeIconWrap, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                    <MapPin size={18} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <View style={styles.nodeTextContainer}>
                    <Text style={styles.nodeLabel}>PICKUP LOCATION</Text>
                    <Text style={styles.nodeAddress}>{pickupAddress}</Text>
                    {shipment.pickup_directions ? (
                      <Text style={styles.nodeDirections}>
                        Note: "{shipment.pickup_directions}"
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.nodeMapBtn}
                    onPress={() => openNavigationApp(shipment, 'pickup')}
                    activeOpacity={0.75}
                  >
                    <Navigation size={12} color={colors.primary} />
                    <Text style={styles.nodeMapBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>

                {/* Delivery Node */}
                <View style={styles.routeNode}>
                  <View style={[styles.nodeIconWrap, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Navigation size={18} color="#16a34a" strokeWidth={2.5} />
                  </View>
                  <View style={styles.nodeTextContainer}>
                    <Text style={[styles.nodeLabel, { color: '#16a34a' }]}>
                      DROP-OFF LOCATION
                    </Text>
                    <Text style={styles.nodeAddress}>{deliveryAddress}</Text>
                    {shipment.dropoff_directions ? (
                      <Text style={styles.nodeDirections}>
                        Note: "{shipment.dropoff_directions}"
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.nodeMapBtn, { borderColor: '#bbf7d0' }]}
                    onPress={() => openNavigationApp(shipment, 'delivery')}
                    activeOpacity={0.75}
                  >
                    <Navigation size={12} color="#16a34a" />
                    <Text style={[styles.nodeMapBtnText, { color: '#16a34a' }]}>Map</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            {/* 1. Unassigned / Broadcast Mission */}
            {stage === 'unassigned' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleUpdateStatus('accepted')}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.actionBtnText}>ACCEPT MISSION</Text>
                    <View style={styles.payoutDot} />
                    <Text style={styles.actionBtnPayout}>
                      ₦{riderEarnings.toLocaleString('en-NG')} PAYOUT
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* 2. Assigned - Confirm Pickup */}
            {stage === 'assigned' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]}
                onPress={() => handleUpdateStatus('picked_up')}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>CONFIRM PICKUP</Text>
                )}
              </TouchableOpacity>
            )}

            {/* 3. Picked Up - Start Delivery / In Transit */}
            {stage === 'picked_up' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
                onPress={() => handleUpdateStatus('in_transit')}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>START DELIVERY (IN TRANSIT)</Text>
                )}
              </TouchableOpacity>
            )}

            {/* 4. In Transit - Complete Delivery */}
            {stage === 'in_transit' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#16a34a' }]}
                onPress={() => handleUpdateStatus('delivered')}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>COMPLETE DELIVERY</Text>
                )}
              </TouchableOpacity>
            )}

            {/* 5. Delivered / Completed State */}
            {stage === 'delivered' && (
              <View style={styles.deliveredNoticeBox}>
                <Clock size={20} color="#15803d" strokeWidth={2.5} />
                <View style={styles.deliveredNoticeTextContainer}>
                  <Text style={styles.deliveredNoticeTitle}>DELIVERED • IN ESCROW SAFETY HOLD</Text>
                  <Text style={styles.deliveredNoticeSubtitle}>
                    ₦{riderEarnings.toLocaleString('en-NG')} is secured in your Escrow Safety Hold. It will release to your Ready Payout balance once the buyer confirms delivery.
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Status Override Selector for active missions */}
            {isAssigned && stage !== 'delivered' && (
              <View style={styles.overrideSection}>
                <Text style={styles.overrideTitle}>QUICK STATUS SELECTOR</Text>
                <View style={styles.overrideRow}>
                  <TouchableOpacity
                    style={[
                      styles.overridePill,
                      stage === 'assigned' && styles.overridePillActive,
                    ]}
                    onPress={() => handleUpdateStatus('assigned')}
                    disabled={updating}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.overridePillText,
                        stage === 'assigned' && styles.overridePillTextActive,
                      ]}
                    >
                      Assigned
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.overridePill,
                      stage === 'picked_up' && styles.overridePillActive,
                    ]}
                    onPress={() => handleUpdateStatus('picked_up')}
                    disabled={updating}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.overridePillText,
                        stage === 'picked_up' && styles.overridePillTextActive,
                      ]}
                    >
                      Picked Up
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.overridePill,
                      stage === 'in_transit' && styles.overridePillActive,
                    ]}
                    onPress={() => handleUpdateStatus('in_transit')}
                    disabled={updating}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.overridePillText,
                        stage === 'in_transit' && styles.overridePillTextActive,
                      ]}
                    >
                      In Transit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.overridePill,
                      { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
                    ]}
                    onPress={() => handleUpdateStatus('delivered')}
                    disabled={updating}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.overridePillText, { color: '#16a34a' }]}>
                      Delivered
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleAnimatedClose}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>Close Control Center</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  dragPillWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerRef: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: SCREEN_HEIGHT * 0.58,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    padding: 16,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  payoutIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  payoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  payoutLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  escrowPill: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  escrowPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#047857',
  },
  payoutAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#064e3b',
    letterSpacing: -0.5,
  },
  payoutSubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  packageCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  packageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageCardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  weightBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  weightBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#c2410c',
  },
  packageDetailLine: {
    fontSize: 12,
    color: '#0f172a',
  },
  detailLabel: {
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  fragileWarning: {
    fontWeight: '800',
    color: '#dc2626',
  },
  contactsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  contactRole: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  phoneActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  phoneActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  noPhoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  pathTraceSection: {
    gap: 10,
  },
  pathHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  pathHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  routeContainer: {
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 16,
    gap: 20,
  },
  routeConnectorLine: {
    position: 'absolute',
    left: 36,
    top: 38,
    bottom: 38,
    width: 2,
    backgroundColor: '#cbd5e1',
    zIndex: 1,
  },
  routeNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  nodeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTextContainer: {
    flex: 1,
  },
  nodeLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nodeAddress: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 16,
  },
  nodeDirections: {
    fontSize: 10,
    fontWeight: '600',
    color: '#b45309',
    fontStyle: 'italic',
    marginTop: 2,
  },
  nodeMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  nodeMapBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  actionBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  payoutDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  actionBtnPayout: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  dismissBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  deliveredNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  deliveredNoticeTextContainer: {
    flex: 1,
  },
  deliveredNoticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  deliveredNoticeSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
    marginTop: 2,
  },
  overrideSection: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  overrideTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  overrideRow: {
    flexDirection: 'row',
    gap: 6,
  },
  overridePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overridePillActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  overridePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  overridePillTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
});
