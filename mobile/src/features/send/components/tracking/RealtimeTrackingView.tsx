import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import {
  Copy,
  Check,
  Search,
  Package,
  Truck,
  CheckCircle2,
  Bike,
  ShieldCheck,
  Headphones,
  XCircle,
  Info,
  Clock,
  ArrowRight,
  CreditCard,
} from 'lucide-react-native';
import { supabase } from '../../../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../../context/AuthContext';
import { PaystackWebViewModal } from '../../../../components/ui/PaystackWebViewModal';
import { SendOrder } from '../../types';
import { TrackingMap } from './TrackingMap';
import { RiderContactCard } from './RiderContactCard';
import { SendSupportModal } from '../support/SendSupportModal';
import { SendCancelOrderModal } from './SendCancelOrderModal';
import { toast } from '../../../../components/ui/GooeyToast';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import { formatLocationAddress } from '../../utils/addressFormatter';

interface RealtimeTrackingViewProps {
  order: SendOrder;
  riderCoords?: { lat: number; lng: number } | null;
  onRefresh?: () => void;
}

export function RealtimeTrackingView({
  order,
  riderCoords,
  onRefresh,
}: RealtimeTrackingViewProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const handlePaymentSuccess = async (reference: string) => {
    try {
      const { error } = await (supabase as any)
        .from('send_orders')
        .update({
          status: 'finding_rider',
          payment_status: 'paid',
          payment_ref: reference,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) {
        console.warn('[RealtimeTrackingView] Remote update failed, saving locally:', error);
      }

      const updated = {
        ...order,
        status: 'finding_rider',
        payment_status: 'paid',
        payment_ref: reference,
        paid_at: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        `linkup_send_order_${order.id}`,
        JSON.stringify(updated)
      );

      toast.success('Payment verified! Searching for your dispatch rider.');
      setPayModalOpen(false);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || 'Payment verification failed');
    }
  };

  const handleCopyId = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isCancelled = order.status === 'cancelled';
  const isPaid = order.payment_status === 'paid';
  const isPendingPayment = !isPaid && (order.status === 'pending_payment' || order.payment_status === 'pending');
  const isFindingRider = isPaid && (order.status === 'finding_rider' || order.status === 'pending_payment');
  const isRiderAssigned =
    order.status === 'assigned_rider' || order.status === 'pickup' || order.status === 'on_the_way';
  const isDelivered = order.status === 'delivered';

  const isInterstate =
    (order.package_details?.distance_km && order.package_details.distance_km > 55) ||
    (order.delivery_fee && Number(order.delivery_fee) >= 15000);

  const formattedPickup = formatLocationAddress(order.pickup_address, order.pickup_lat, order.pickup_lng);
  const formattedDropoff = formatLocationAddress(order.dropoff_address, order.dropoff_lat, order.dropoff_lng);

  const pickupCoords =
    order.pickup_lat && order.pickup_lng
      ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }
      : null;

  const dropoffCoords =
    order.dropoff_lat && order.dropoff_lng
      ? { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) }
      : null;

  const placedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recent';

  const trackingSteps = [
    {
      label: 'Payment',
      state: isPaid ? 'Completed' : 'In Progress',
      icon: ShieldCheck,
    },
    {
      label: isInterstate ? 'Transit Carrier' : 'Finding rider',
      state: isPendingPayment ? 'Pending' : isFindingRider ? 'In Progress' : 'Completed',
      icon: Search,
    },
    {
      label: isInterstate ? 'Assigned' : 'Rider Assigned',
      state: isPendingPayment || isFindingRider
        ? 'Pending'
        : order.status === 'assigned_rider'
        ? 'In Progress'
        : 'Completed',
      icon: isInterstate ? Truck : Bike,
    },
    {
      label: 'Pick up',
      state:
        order.status === 'pickup'
          ? 'In Progress'
          : ['on_the_way', 'delivered'].includes(order.status)
          ? 'Completed'
          : 'Pending',
      icon: Package,
    },
    {
      label: 'On the way',
      state:
        order.status === 'on_the_way'
          ? 'In Progress'
          : order.status === 'delivered'
          ? 'Completed'
          : 'Pending',
      icon: Truck,
    },
    {
      label: 'Delivered',
      state: isDelivered ? 'Completed' : 'Pending',
      icon: CheckCircle2,
    },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Top Header Card */}
      <View style={styles.topCard}>
        <View style={styles.topCardRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderIdLabel}>Order ID</Text>
              <TouchableOpacity onPress={handleCopyId} style={styles.copyBtn} activeOpacity={0.7}>
                {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} color="#64748b" />}
              </TouchableOpacity>
            </View>
            <Text style={styles.orderIdValue}>{order.id}</Text>
            <Text style={styles.placedDate}>Placed on {placedDate}</Text>
          </View>

          {/* Right Status Badge */}
          {isCancelled ? (
            <View style={[styles.statusBox, styles.statusBoxCancelled]}>
              <Text style={[styles.statusBadgeText, { color: '#dc2626' }]}>Cancelled</Text>
              <Text style={styles.statusSubText}>Order Closed</Text>
            </View>
          ) : isPendingPayment ? (
            <View style={[styles.statusBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
              <Text style={[styles.statusBadgeText, { color: '#b45309' }]}>Pending Payment ⏳</Text>
              <Text style={[styles.statusSubText, { color: '#b45309' }]}>Payment Required</Text>
            </View>
          ) : isFindingRider ? (
            <View style={[styles.statusBox, styles.statusBoxFinding]}>
              <Text style={[styles.statusBadgeText, { color: '#16a34a' }]}>
                {isInterstate ? 'Assigning Transit' : 'Finding a rider'}
              </Text>
              <Text style={styles.statusSubText}>{isInterstate ? '1 – 2 Days' : '15 – 45 mins'}</Text>
            </View>
          ) : (
            <View style={[styles.statusBox, styles.statusBoxActive]}>
              <Text style={[styles.statusBadgeText, { color: colors.primary }]}>
                {order.status === 'delivered' ? 'Delivered' : 'Rider Dispatched'}
              </Text>
              <Text style={styles.statusSubText}>Live GPS</Text>
            </View>
          )}
        </View>
      </View>

      {/* 2. Horizontal 5-Step Stepper */}
      <View style={styles.stepperCard}>
        <View style={styles.stepperLine} />
        {trackingSteps.map((s) => {
          const isCompleted = s.state === 'Completed';
          const isInProgress = s.state === 'In Progress';
          const Icon = s.icon;

          return (
            <View key={s.label} style={styles.stepperItem}>
              <View
                style={[
                  styles.stepperDot,
                  isCompleted && styles.stepperDotCompleted,
                  isInProgress && styles.stepperDotInProgress,
                ]}
              >
                {isCompleted ? (
                  <Check size={12} color="#ffffff" strokeWidth={3} />
                ) : (
                  <Icon
                    size={13}
                    color={isInProgress ? colors.primary : '#94a3b8'}
                    strokeWidth={2.4}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepperLabel,
                  (isCompleted || isInProgress) && styles.stepperLabelActive,
                ]}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 3. CONDITIONAL BODY: CANCELLED VS FINDING RIDER VS RIDER ASSIGNED */}
      {isCancelled ? (
        <View style={styles.cancelledCard}>
          <View style={styles.cancelledTop}>
            <View style={styles.cancelledIconWrap}>
              <XCircle size={26} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cancelledTitle}>Package Delivery Cancelled</Text>
              <Text style={styles.cancelledReason}>
                {order.package_details?.cancellation_reason
                  ? `Reason: ${order.package_details.cancellation_reason}`
                  : 'This delivery order was cancelled by the sender.'}
              </Text>
            </View>
          </View>

          <View style={styles.refundRow}>
            <Text style={styles.refundLabel}>Refund Status</Text>
            <Text style={styles.refundVal}>
              {order.payment_status === 'paid'
                ? `₦${Number(order.delivery_fee || 0).toLocaleString()} Credited to Wallet`
                : 'Free Cancellation'}
            </Text>
          </View>

          <View style={styles.cancelledActions}>
            <TouchableOpacity
              style={styles.sendAnotherBtn}
              onPress={() => navigation.navigate('MainTabs', { screen: 'SendTab' })}
              activeOpacity={0.8}
            >
              <Text style={styles.sendAnotherBtnText}>Send Another Package</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactSupportSmallBtn}
              onPress={() => setSupportModalOpen(true)}
              activeOpacity={0.8}
            >
              <Headphones size={15} color="#ea580c" />
              <Text style={styles.contactSupportSmallText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (isFindingRider || isPendingPayment) ? (
        /* ============ FINDING RIDER & PENDING PAYMENT VIEW ============ */
        <View style={styles.sectionWrap}>
          {/* Radar Searching Card */}
          <View style={styles.radarCard}>
            <View style={styles.radarPulseContainer}>
              <View style={styles.radarPulseOuter} />
              <View style={styles.radarPulseInner} />
              <View style={styles.radarIconCenter}>
                <Search size={18} color="#ffffff" strokeWidth={2.6} />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.radarTitle}>
                {isPendingPayment
                  ? 'Payment required to assign rider'
                  : isInterstate
                  ? 'Searching for verified transit carrier'
                  : "We're finding the best rider for you"}
              </Text>
              <Text style={styles.radarSub}>
                {isPendingPayment
                  ? 'Your delivery order is ready. Please complete payment to broadcast to nearby dispatch riders.'
                  : isInterstate
                  ? 'Connecting your parcel with an inter-state logistics carrier for long-distance transport.'
                  : 'Please sit tight while we connect you with an available rider near you.'}
              </Text>
            </View>
          </View>

          {/* Pending Payment Action Banner */}
          {isPendingPayment && (
            <TouchableOpacity
              style={styles.payNowHeroBtn}
              onPress={() => setPayModalOpen(true)}
              activeOpacity={0.88}
            >
              <View style={styles.payNowHeroIconWrap}>
                <CreditCard size={20} color="#ffffff" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payNowHeroTitle}>Complete Payment Now</Text>
                <Text style={styles.payNowHeroSub}>
                  Pay ₦{Math.round(order.delivery_fee || (order as any).total_amount || 0).toLocaleString('en-NG')} via Paystack to activate dispatch
                </Text>
              </View>
              <View style={styles.payNowHeroActionPill}>
                <Text style={styles.payNowHeroActionText}>Pay Now</Text>
                <ArrowRight size={13} color="#ffffff" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          )}

          {/* Info pill */}
          <View style={styles.infoPill}>
            <Info size={14} color="#ea580c" />
            <Text style={styles.infoPillText}>
              {isPendingPayment
                ? 'Dispatchers are notified immediately upon payment confirmation.'
                : 'You will be notified as soon as a verified dispatch rider accepts.'}
            </Text>
          </View>

          {/* Order Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>ORDER DETAILS</Text>

            {/* Pickup */}
            <View style={styles.locationRow}>
              <View style={[styles.dotCircle, { borderColor: '#16a34a' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Pickup Location</Text>
                <Text style={styles.locationAddress}>{formattedPickup}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.personName}>{order.sender_name}</Text>
                <Text style={styles.personPhone}>{order.sender_phone}</Text>
              </View>
            </View>

            <View style={styles.locationDivider} />

            {/* Dropoff */}
            <View style={styles.locationRow}>
              <View style={[styles.dotCircle, { borderColor: '#2563eb' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Drop-off Location</Text>
                <Text style={styles.locationAddress}>{formattedDropoff}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.personName}>{order.dropoff_recipient_name}</Text>
                <Text style={styles.personPhone}>{order.dropoff_recipient_phone}</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Package details */}
            <View style={styles.packageDetailRow}>
              <Text style={{ fontSize: 16 }}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Package Details</Text>
                <Text style={styles.packageWeight}>
                  {order.package_details?.weight_kg <= 2
                    ? 'Small • Under 2kg'
                    : `${order.package_details?.weight_kg}kg`}
                  {isInterstate && ' • Inter-State Delivery'}
                </Text>
                <Text style={styles.packageContents}>
                  {order.package_details?.contents || 'Parcels / Items'}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>PAYMENT SUMMARY</Text>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>{isPaid ? 'Total Paid' : 'Amount Due'}</Text>
              <Text style={styles.summaryVal}>
                ₦{Number(order.delivery_fee || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Payment Method</Text>
              <Text style={styles.summaryVal}>
                {order.payment_ref?.startsWith('WALLET') ? 'LinkUp Wallet' : 'Paystack Online'}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Payment Status</Text>
              <View
                style={[
                  styles.paidBadge,
                  !isPaid && { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
                ]}
              >
                <Text
                  style={[
                    styles.paidBadgeText,
                    !isPaid && { color: '#b45309' },
                  ]}
                >
                  {isPaid ? 'PAID' : 'PENDING PAYMENT'}
                </Text>
              </View>
            </View>
          </View>

          {/* Safe & Secure notice */}
          <View style={styles.trustBanner}>
            <ShieldCheck size={18} color="#2563eb" />
            <Text style={styles.trustBannerText}>
              Your package is insured and safely tracked from pickup to delivery.
            </Text>
          </View>

          {/* Action Buttons: Pay Now, Contact Support & Cancel */}
          <View style={styles.buttonGrid}>
            {isPendingPayment && (
              <TouchableOpacity
                style={styles.payNowPillBtn}
                onPress={() => setPayModalOpen(true)}
                activeOpacity={0.85}
              >
                <CreditCard size={15} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.payNowPillText}>Pay Now</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.supportPillBtn}
              onPress={() => setSupportModalOpen(true)}
              activeOpacity={0.85}
            >
              <Headphones size={16} color="#ea580c" />
              <Text style={styles.supportPillText}>Contact Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelPillBtn}
              onPress={() => setCancelModalOpen(true)}
              activeOpacity={0.85}
            >
              <XCircle size={16} color="#ef4444" />
              <Text style={styles.cancelPillText}>Cancel Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ============ RIDER ASSIGNED VIEW ============ */
        <View style={styles.sectionWrap}>
          {/* Rider Card */}
          <RiderContactCard
            name={order.rider_name || 'Verified Rider'}
            phone={order.rider_phone || '08123456789'}
            avatar={order.rider_avatar}
            riderId={order.rider_id}
            estimatedArrival="8 mins"
            statusText={
              order.status === 'delivered'
                ? 'Package has been safely delivered to recipient.'
                : order.status === 'pickup'
                ? 'Rider has arrived at pickup location.'
                : 'Rider is on the way to pick up your package.'
            }
          />

          {/* Interactive Map */}
          <TrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={riderCoords || { lat: 9.09, lng: 7.42 }}
            status={order.status}
          />

          {/* Order Summary Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>ORDER SUMMARY</Text>

            <View style={styles.locationRow}>
              <View style={[styles.dotCircle, { borderColor: '#16a34a' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Pickup</Text>
                <Text style={styles.locationAddress}>{formattedPickup}</Text>
              </View>
            </View>

            <View style={styles.locationDivider} />

            <View style={styles.locationRow}>
              <View style={[styles.dotCircle, { borderColor: '#2563eb' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Drop-off</Text>
                <Text style={styles.locationAddress}>{formattedDropoff}</Text>
              </View>
            </View>
          </View>

          {/* Footer Assistance & Support */}
          <View style={styles.helpRow}>
            <Text style={styles.helpText}>Need help or want to cancel?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {order.status === 'assigned_rider' && (
                <TouchableOpacity onPress={() => setCancelModalOpen(true)}>
                  <Text style={styles.cancelLinkText}>Cancel Order</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.supportSmallPill}
                onPress={() => setSupportModalOpen(true)}
              >
                <Headphones size={13} color="#ea580c" />
                <Text style={styles.supportSmallPillText}>Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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

      {/* Paystack Payment Modal */}
      <PaystackWebViewModal
        visible={payModalOpen}
        email={
          user?.email ||
          (order.sender_phone
            ? `${order.sender_phone.replace(/\D/g, '')}@linkup.delivery`
            : 'customer@linkup.delivery')
        }
        amount={order.delivery_fee || (order as any).total_amount || 0}
        reference={`PAYSTACK_${order.id}_${Date.now()}`}
        metadata={{
          order_id: order.id,
          order_type: 'send_order',
          user_id: user?.id,
        }}
        onSuccess={handlePaymentSuccess}
        onCancel={() => setPayModalOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  topCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  copyBtn: {
    padding: 2,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  placedDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  statusBoxCancelled: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusBoxFinding: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusBoxActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  statusSubText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  stepperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 14,
  },
  stepperLine: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 0,
  },
  stepperItem: {
    alignItems: 'center',
    width: 62,
    zIndex: 1,
  },
  stepperDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepperDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepperDotInProgress: {
    backgroundColor: '#fff7ed',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  stepperLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  sectionWrap: {
    gap: 12,
  },
  radarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radarPulseContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulseOuter: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(233, 111, 40, 0.15)',
  },
  radarPulseInner: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(233, 111, 40, 0.25)',
  },
  radarIconCenter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  radarSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  infoPillText: {
    fontSize: 11,
    color: '#9a3412',
    fontWeight: '600',
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    marginTop: 3,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  locationAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  personName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  personPhone: {
    fontSize: 10,
    color: '#64748b',
  },
  locationDivider: {
    height: 12,
    width: 2,
    backgroundColor: '#cbd5e1',
    marginLeft: 4,
    marginVertical: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  packageDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  packageWeight: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  packageContents: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  paidBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paidBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#16a34a',
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  trustBannerText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
    flex: 1,
  },
  payNowHeroBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  payNowHeroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payNowHeroTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  payNowHeroSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  payNowHeroActionPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payNowHeroActionText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  payNowPillBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  payNowPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  supportPillBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  supportPillText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelPillBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelPillText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelledCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 12,
  },
  cancelledTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cancelledIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991b1b',
  },
  cancelledReason: {
    fontSize: 11,
    color: '#7f1d1d',
    marginTop: 2,
    lineHeight: 15,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  refundLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  refundVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#16a34a',
  },
  cancelledActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sendAnotherBtn: {
    flex: 1,
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendAnotherBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  contactSupportSmallBtn: {
    height: 42,
    paddingHorizontal: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactSupportSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  helpText: {
    fontSize: 11,
    color: '#64748b',
  },
  cancelLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
    textDecorationLine: 'underline',
  },
  supportSmallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  supportSmallPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
});
