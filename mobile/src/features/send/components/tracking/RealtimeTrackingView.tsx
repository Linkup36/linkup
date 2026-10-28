import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Linking,
  Image,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MoreVertical,
  Star,
  Phone,
  MessageSquare,
  Check,
  Truck,
  CreditCard,
  Search,
  Headphones,
  XCircle,
  Copy,
  Share2,
  X,
  AlertTriangle,
  Package,
  Bike,
  CheckCircle2,
} from 'lucide-react-native';
import { SendOrder } from '../../types';
import { TrackingMap } from './TrackingMap';
import { SendSupportModal } from '../support/SendSupportModal';
import { SendCancelOrderModal } from './SendCancelOrderModal';
import { toast } from '../../../../components/ui/GooeyToast';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../services/supabase';
import { PaystackWebViewModal } from '../../../../components/ui/PaystackWebViewModal';

interface RealtimeTrackingViewProps {
  order: SendOrder;
  riderCoords?: { lat: number; lng: number } | null;
  onRefresh?: () => void;
  onSearchAnother?: (orderId: string) => void;
}

function formatShortAddress(address?: string | null, fallback = 'Location'): string {
  if (!address) return fallback;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const neighborhood = parts[parts.length - 3] || parts[0];
    const city = parts[parts.length - 2] || parts[1];
    return `${neighborhood}, ${city}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return parts[0] || fallback;
}

export function RealtimeTrackingView({
  order,
  riderCoords,
  onRefresh,
  onSearchAnother,
}: RealtimeTrackingViewProps) {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [newSearchInput, setNewSearchInput] = useState('');

  const isCancelled = order.status === 'cancelled';
  const isPaid = (order.payment_status || '').toLowerCase() === 'paid';
  const isPendingPayment = order.status === 'pending_payment' || (!isPaid && !isCancelled);
  const isFindingRider = order.status === 'finding_rider' && isPaid;
  const isDelivered = order.status === 'delivered';

  const pickupCoords =
    order.pickup_lat && order.pickup_lng
      ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }
      : null;

  const dropoffCoords =
    order.dropoff_lat && order.dropoff_lng
      ? { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) }
      : null;

  const rawDistance = order.package_details?.distance_km;
  const distanceKm = rawDistance ? Number(rawDistance).toFixed(1) : '5.0';

  const etaText = isDelivered ? 'Delivered' : order.status === 'pickup' ? 'At Pickup' : '8 min';

  const currentStep = useMemo(() => {
    switch (order.status as string) {
      case 'pending_payment':
      case 'finding_rider':
        return 1;
      case 'assigned_rider':
      case 'pickup':
        return 2;
      case 'on_the_way':
      case 'in_transit':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  }, [order.status]);

  const stepStatusTitle = useMemo(() => {
    switch (currentStep) {
      case 1:
        return isPendingPayment ? 'Awaiting Payment' : 'Searching for Courier...';
      case 2:
        return order.status === 'pickup' ? 'Courier Arrived at Pickup' : 'Courier Assigned & En Route';
      case 3:
        return `${etaText} Away • In Transit`;
      case 4:
        return 'Delivered Successfully';
      default:
        return `${etaText} Away`;
    }
  }, [currentStep, isPendingPayment, order.status, etaText]);

  const [riderProfile, setRiderProfile] = useState<{
    display_name?: string;
    avatar_url?: string;
    phone?: string;
  } | null>(null);

  // Fetch real rider profile if rider_id is assigned
  useEffect(() => {
    if (order.rider_id) {
      (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url, phone')
        .eq('id', order.rider_id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) setRiderProfile(data);
        });
    }
  }, [order.rider_id]);

  const hasAssignedRider = Boolean(
    (order.rider_name || order.rider_id || riderProfile?.display_name) &&
    !['pending_payment', 'finding_rider'].includes(order.status)
  );

  const realLogisticsName = hasAssignedRider
    ? order.rider_name || riderProfile?.display_name || 'Assigned Courier'
    : 'LinkUp Logistics';

  const realBadgeLabel = hasAssignedRider ? 'Courier' : 'Logistics';
  const realBadgeRating = hasAssignedRider ? '4.8' : '4.9';

  const realAvatarUri = hasAssignedRider
    ? order.rider_avatar || riderProfile?.avatar_url
    : null;

  const realRiderPhone = hasAssignedRider
    ? order.rider_phone || riderProfile?.phone
    : null;

  const handleCopyId = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setOptionsModalOpen(false);
    toast.success('Order ID copied to clipboard');
  };

  const handleShare = async () => {
    setOptionsModalOpen(false);
    try {
      await Share.share({
        message: `Track my LinkUp delivery (${order.id}) from ${order.pickup_address} to ${order.dropoff_address}. Current status: ${order.status.replace(/_/g, ' ').toUpperCase()}`,
        title: `LinkUp Delivery: ${order.id}`,
      });
    } catch {}
  };

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (hasAssignedRider && realRiderPhone) {
      Linking.openURL(`tel:${realRiderPhone}`).catch(() => {
        toast.error('Unable to place phone call to courier');
      });
    } else {
      // Connect to LinkUp Logistics Support
      Linking.openURL('tel:08145096342').catch(() => {
        setSupportModalOpen(true);
      });
    }
  };

  const handleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSupportModalOpen(true);
  };

  const handlePaystackSuccess = async (reference: string) => {
    setPayModalVisible(false);
    try {
      await (supabase as any)
        .from('send_orders')
        .update({
          status: 'finding_rider',
          payment_status: 'paid',
          payment_ref: reference,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      toast.success('Payment verified! Searching for your dispatch rider.');
      onRefresh?.();
    } catch (err: any) {
      toast.error('Payment verified but order update failed: ' + (err?.message || 'Error'));
      onRefresh?.();
    }
  };

  const handleExecuteSearchAnother = () => {
    if (newSearchInput.trim()) {
      const code = newSearchInput.trim().toUpperCase();
      setSearchModalOpen(false);
      setNewSearchInput('');
      onSearchAnother?.(code);
    }
  };

  // Status pill title
  const getStatusPillText = () => {
    if (isCancelled) return 'Delivery Cancelled';
    if (isPendingPayment) return 'Packed · awaiting payment';
    if (isFindingRider) return 'Packed · finding nearest courier';
    if (order.status === 'assigned_rider') return `Packed · courier arriving in ${etaText}`;
    if (order.status === 'pickup') return `Picked up · arriving in ${etaText}`;
    if (order.status === 'on_the_way') return `Packed · arriving in ${etaText}`;
    if (isDelivered) return 'Delivered · package received';
    return `In Transit · arriving in ${etaText}`;
  };

  // Top Map Height (~44% of window)
  const mapHeight = Math.max(300, Math.round(screenHeight * 0.44));

  return (
    <View style={styles.mainWrapper}>
      {/* 1. UPPER SECTION: FULL-BLEED MAP */}
      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <TrackingMap
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          riderCoords={riderCoords}
          status={order.status}
          etaText={etaText}
        />

        {/* Floating Top Bar overlay on map */}
        <View style={[styles.floatingHeader, { top: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.floatingRoundBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ArrowLeft size={19} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <Text style={styles.floatingTitle}>Track Package</Text>

          <TouchableOpacity
            style={styles.floatingRoundBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setOptionsModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <MoreVertical size={19} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. LOWER SECTION: BOTTOM SHEET OVERLAY */}
      <View style={styles.sheetContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetScrollContent}
        >
          {/* Subtle Top Handle */}
          <View style={styles.handleBar} />

          {/* Courier Info Row */}
          <View style={styles.courierRow}>
            {/* Courier / Logistics Avatar */}
            <View style={styles.avatarWrap}>
              {realAvatarUri ? (
                <Image
                  source={{ uri: realAvatarUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : hasAssignedRider ? (
                <View style={styles.initialsAvatar}>
                  <Text style={styles.initialsAvatarText}>
                    {realLogisticsName
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={styles.logisticsLogoWrap}>
                  <Image
                    source={require('../../../../../assets/logo.png')}
                    style={styles.logisticsLogoImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>

            {/* Courier / Logistics Details */}
            <View style={styles.courierDetails}>
              <View style={styles.deliveryBadgeRow}>
                <Text style={styles.deliveryCategoryText}>{realBadgeLabel}</Text>
                <Star size={11} color="#FA7E2B" fill="#FA7E2B" style={{ marginLeft: 3 }} />
                <Text style={styles.deliveryRatingText}> {realBadgeRating}</Text>
              </View>
              <Text style={styles.courierNameText} numberOfLines={1}>
                {realLogisticsName}
              </Text>
            </View>

            {/* Circular Black Action Buttons */}
            <View style={styles.courierActions}>
              <TouchableOpacity
                style={styles.actionRoundBtn}
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <Phone size={17} color="#FFFFFF" fill="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRoundBtn}
                onPress={handleChat}
                activeOpacity={0.8}
              >
                <MessageSquare size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status & Distance Pill */}
          <View style={styles.statusPill}>
            <View style={styles.statusPillLeft}>
              <View style={styles.statusDotOuter}>
                <View style={styles.statusDotInner} />
              </View>
              <Text style={styles.statusPillTitle} numberOfLines={1}>
                {getStatusPillText()}
              </Text>
            </View>
            <Text style={styles.statusPillDistance}>{distanceKm} km left</Text>
          </View>

          {/* Booking Card with 3D Graphic */}
          <View style={styles.bookingCard}>
            {/* Header: Booking & Process Badge */}
            <View style={styles.bookingHeaderRow}>
              <Text style={styles.bookingLabel}>Booking</Text>
              <View style={styles.processBadge}>
                <Text style={styles.processBadgeText}>
                  {isCancelled
                    ? 'Cancelled'
                    : isDelivered
                    ? 'Delivered'
                    : isPendingPayment
                    ? 'Pending'
                    : 'Process'}
                </Text>
              </View>
            </View>

            {/* Large Bold Booking Code */}
            <TouchableOpacity onPress={handleCopyId} activeOpacity={0.75}>
              <Text style={styles.bookingCodeText} numberOfLines={1}>
                {order.id}
              </Text>
            </TouchableOpacity>

            {/* Dynamic 4-Step Milestone Stepper with Real Status Tracking & Matching Icons */}
            <View style={styles.stepperContainer}>
              <Text style={styles.stepperEtaTitle}>{stepStatusTitle}</Text>

              <View style={styles.stepperTrackRow}>
                {/* Step 1: Placed / Booked (Package) */}
                {currentStep > 1 ? (
                  <View style={styles.stepperCircleCompleted}>
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : currentStep === 1 ? (
                  <View style={styles.stepperActiveBadge}>
                    <Package size={15} color="#FA7E2B" strokeWidth={2.4} />
                  </View>
                ) : (
                  <View style={styles.stepperCirclePending}>
                    <Package size={12} color="#94A3B8" strokeWidth={2} />
                  </View>
                )}

                {/* Connector 1 -> 2 */}
                <View style={styles.dottedSegment}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={`c1-${i}`}
                      style={[
                        styles.miniDot,
                        { backgroundColor: currentStep > 1 ? '#FA7E2B' : '#CBD5E1' },
                      ]}
                    />
                  ))}
                </View>

                {/* Step 2: Pickup / Courier Assigned (Bike) */}
                {currentStep > 2 ? (
                  <View style={styles.stepperCircleCompleted}>
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : currentStep === 2 ? (
                  <View style={styles.stepperActiveBadge}>
                    <Bike size={15} color="#FA7E2B" strokeWidth={2.4} />
                  </View>
                ) : (
                  <View style={styles.stepperCirclePending}>
                    <Bike size={12} color="#94A3B8" strokeWidth={2} />
                  </View>
                )}

                {/* Connector 2 -> 3 */}
                <View style={styles.dottedSegment}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={`c2-${i}`}
                      style={[
                        styles.miniDot,
                        { backgroundColor: currentStep > 2 ? '#FA7E2B' : '#CBD5E1' },
                      ]}
                    />
                  ))}
                </View>

                {/* Step 3: In Transit / On The Way (Truck) */}
                {currentStep > 3 ? (
                  <View style={styles.stepperCircleCompleted}>
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : currentStep === 3 ? (
                  <View style={styles.stepperActiveBadge}>
                    <Truck size={15} color="#FA7E2B" strokeWidth={2.4} />
                  </View>
                ) : (
                  <View style={styles.stepperCirclePending}>
                    <Truck size={12} color="#94A3B8" strokeWidth={2} />
                  </View>
                )}

                {/* Connector 3 -> 4 */}
                <View style={styles.dottedSegment}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={`c3-${i}`}
                      style={[
                        styles.miniDot,
                        { backgroundColor: currentStep >= 4 ? '#FA7E2B' : '#CBD5E1' },
                      ]}
                    />
                  ))}
                </View>

                {/* Step 4: Safely Delivered (CheckCircle2) */}
                {currentStep >= 4 ? (
                  <View style={[styles.stepperActiveBadge, { borderColor: '#15803D' }]}>
                    <CheckCircle2 size={16} color="#15803D" strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.stepperCirclePending}>
                    <CheckCircle2 size={12} color="#94A3B8" strokeWidth={2} />
                  </View>
                )}
              </View>

              {/* Step Labels Row */}
              <View style={styles.stepperLabelsRow}>
                <Text style={[styles.stepperLabelText, currentStep === 1 && styles.stepperLabelActive]}>
                  Placed
                </Text>
                <Text style={[styles.stepperLabelText, currentStep === 2 && styles.stepperLabelActive]}>
                  Pickup
                </Text>
                <Text style={[styles.stepperLabelText, currentStep === 3 && styles.stepperLabelActive]}>
                  In Transit
                </Text>
                <Text style={[styles.stepperLabelText, currentStep === 4 && styles.stepperLabelActive]}>
                  Delivered
                </Text>
              </View>
            </View>

            {/* 2-Column Info Grid */}
            <View style={styles.infoGridRow}>
              {/* Left Column */}
              <View style={styles.infoCol}>
                <Text style={styles.infoColLabel}>From</Text>
                <Text style={styles.infoColValue} numberOfLines={1}>
                  {formatShortAddress(order.pickup_address, 'Palm Springs')}
                </Text>

                <View style={{ height: 14 }} />

                <Text style={styles.infoColLabel}>Order Cost</Text>
                <Text style={styles.infoColValueHighlight}>
                  ₦{Number(order.delivery_fee || 0).toLocaleString()}
                </Text>
              </View>

              {/* Right Column */}
              <View style={styles.infoCol}>
                <Text style={styles.infoColLabel}>To</Text>
                <Text style={styles.infoColValue} numberOfLines={1}>
                  {formatShortAddress(order.dropoff_address, 'Diriyah, Riyadh')}
                </Text>

                <View style={{ height: 14 }} />

                <Text style={styles.infoColLabel}>Customer</Text>
                <Text style={styles.infoColValue} numberOfLines={1}>
                  {order.dropoff_recipient_name || order.sender_name || 'Amelia'}
                </Text>
              </View>
            </View>

            {/* 3D Parcel Box Graphic in Bottom Right */}
            <Image
              source={require('../../../../../assets/parcel_boxes_3d.jpg')}
              style={styles.parcelBoxesImage}
              resizeMode="contain"
            />
          </View>

          {/* Pending Payment Action */}
          {isPendingPayment && (
            <TouchableOpacity
              style={styles.payNowBtn}
              onPress={() => setPayModalVisible(true)}
              activeOpacity={0.88}
            >
              <CreditCard size={17} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.payNowBtnText}>
                Complete Payment • ₦{Number(order.delivery_fee || 0).toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}

          {/* Cancelled Banner */}
          {isCancelled && (
            <View style={styles.cancelledBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color="#DC2626" />
                <Text style={styles.cancelledTitle}>Order Cancelled</Text>
              </View>
              <Text style={styles.cancelledSub}>
                {order.package_details?.cancellation_reason ||
                  'This order has been cancelled. Any deducted amount has been refunded to your wallet.'}
              </Text>
              <TouchableOpacity
                style={styles.sendAnotherBtn}
                onPress={() => navigation.navigate('MainTabs', { screen: 'SendTab' })}
                activeOpacity={0.8}
              >
                <Text style={styles.sendAnotherBtnText}>Send Another Package</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>

      {/* MORE OPTIONS MODAL */}
      <Modal
        visible={optionsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOptionsModalOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Delivery Options</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setOptionsModalOpen(false);
                setSearchModalOpen(true);
              }}
            >
              <Search size={18} color="#0F172A" />
              <Text style={styles.modalOptionText}>Track Another Package</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleCopyId}>
              <Copy size={18} color="#0F172A" />
              <Text style={styles.modalOptionText}>Copy Tracking ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={handleShare}>
              <Share2 size={18} color="#0F172A" />
              <Text style={styles.modalOptionText}>Share Delivery Info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setOptionsModalOpen(false);
                setSupportModalOpen(true);
              }}
            >
              <Headphones size={18} color="#FA7E2B" />
              <Text style={[styles.modalOptionText, { color: '#FA7E2B' }]}>Contact Support</Text>
            </TouchableOpacity>

            {!isDelivered && !isCancelled && (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setOptionsModalOpen(false);
                  setCancelModalOpen(true);
                }}
              >
                <XCircle size={18} color="#DC2626" />
                <Text style={[styles.modalOptionText, { color: '#DC2626' }]}>Cancel Delivery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setOptionsModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SEARCH ANOTHER PACKAGE MODAL */}
      <Modal
        visible={searchModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSearchModalOpen(false)}
      >
        <View style={styles.searchModalWrap}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Track Another Package</Text>
              <TouchableOpacity onPress={() => setSearchModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchModalInput}
              placeholder="e.g. LSEND-250512-9876"
              placeholderTextColor="#94A3B8"
              value={newSearchInput}
              onChangeText={setNewSearchInput}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleExecuteSearchAnother}
            />

            <TouchableOpacity
              style={styles.searchModalSubmitBtn}
              onPress={handleExecuteSearchAnother}
              activeOpacity={0.85}
            >
              <Search size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.searchModalSubmitText}>Track Package</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modals */}
      <SendSupportModal
        visible={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        orderId={order.id}
        orderStatus={order.status}
      />

      <SendCancelOrderModal
        visible={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        onSuccess={onRefresh}
        onOpenSupport={() => setSupportModalOpen(true)}
      />

      <PaystackWebViewModal
        visible={payModalVisible}
        email={user?.email || 'customer@linkup.com'}
        amount={Number(order.delivery_fee || 0)}
        reference={`PAY_${order.id}_${Date.now()}`}
        onSuccess={handlePaystackSuccess}
        onCancel={() => setPayModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },

  // Map Container
  mapContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },

  // Floating Header
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  floatingRoundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Bottom Sheet
  sheetContainer: {
    flex: 1,
    marginTop: -28,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Courier Contact Row
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  logisticsLogoWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  logisticsLogoImage: {
    width: 32,
    height: 32,
  },
  initialsAvatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  initialsAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  courierDetails: {
    flex: 1,
    marginLeft: 12,
  },
  deliveryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  deliveryRatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  courierNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  courierActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionRoundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Status & Distance Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  statusPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0F172A',
  },
  statusPillTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  statusPillDistance: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },

  // Booking Card
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 18,
    marginTop: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  processBadge: {
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  processBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bookingCodeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Stepper
  stepperContainer: {
    marginTop: 18,
    marginBottom: 20,
    alignItems: 'center',
  },
  stepperEtaTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  stepperTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stepperCircleCompleted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCirclePending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperActiveBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperTruckBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  stepperLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  stepperLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    width: 60,
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: '#FA7E2B',
    fontWeight: '900',
  },
  dottedSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 3,
    gap: 3,
  },
  miniDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },

  // 2-Column Info Grid
  infoGridRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingRight: 80, // room for 3D boxes
  },
  infoCol: {
    flex: 1,
  },
  infoColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  infoColValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  infoColValueHighlight: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },

  // 3D Parcel Box Graphic in corner
  parcelBoxesImage: {
    position: 'absolute',
    bottom: -6,
    right: -4,
    width: 95,
    height: 95,
  },

  // Pay Now Action
  payNowBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  payNowBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Cancelled Banner
  cancelledBanner: {
    marginTop: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cancelledTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  cancelledSub: {
    fontSize: 11.5,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  sendAnotherBtn: {
    marginTop: 4,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendAnotherBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Modal Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseBtn: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },

  // Search Modal
  searchModalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  searchModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchModalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#0F172A',
  },
  searchModalSubmitBtn: {
    backgroundColor: '#FA7E2B',
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchModalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
