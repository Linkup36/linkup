import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Store,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { OrderTimeline } from './OrderTimeline';
import { OrderShipmentIntel } from './OrderShipmentIntel';
import { ShipmentStatusHistory } from './ShipmentStatusHistory';
import { Receipt } from './Receipt';
import { RatingSelector } from './RatingSelector';
import { AppModal } from '../../../components/ui/AppModal';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../components/ui/GooeyToast';
import * as Haptics from 'expo-haptics';

interface OrderCardProps {
  order: {
    id: string;
    title: string;
    price: number;
    image: string;
    store: string;
    status: string;
    displayStatus?: string;
    shipment?: any;
    sellerId?: string;
    productId?: string;
    size?: string;
    items?: any[];
  };
}

export function OrderCard({ order }: OrderCardProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);

  // Review state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Dispute state
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Item Not Received');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const status = (order.status || 'pending').toLowerCase();
  const isDelivered = status === 'delivered' || status === 'completed';
  const isDisputed = status === 'disputed';
  const isCancelled = status === 'cancelled';

  const handleConfirmDelivery = async () => {
    Alert.alert(
      'Confirm Receipt of Order',
      'Please ensure you have physically inspected your items. Once confirmed, payment will be finalized and released to the merchant from escrow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release',
          style: 'default',
          onPress: async () => {
            try {
              setIsConfirmingDelivery(true);
              const { error } = await (supabase as any)
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', order.id);

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.success('Order completed & escrow settled');
            } catch (err: any) {
              toast.error(err.message || 'Could not confirm delivery');
            } finally {
              setIsConfirmingDelivery(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitReview = async () => {
    if (!order.productId || !user) return;
    setIsSubmittingReview(true);
    try {
      const { error } = await (supabase as any)
        .from('product_reviews')
        .upsert(
          {
            user_id: user.id,
            product_id: order.productId,
            rating,
            review_text: reviewComment.trim(),
          },
          { onConflict: 'user_id,product_id' }
        );

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Review submitted! Thank you.');
      setIsReviewOpen(false);
      setReviewComment('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!user) return;
    setIsSubmittingDispute(true);
    try {
      const { error } = await supabase.from('issues' as any).insert([
        {
          reporter_id: user.id,
          order_id: order.id,
          product_id: order.productId,
          seller_id: order.sellerId,
          title: `[Financial Dispute] ${disputeReason}`,
          description: disputeDetails.trim(),
          category: 'financial_dispute',
          priority: 'critical',
          status: 'open',
        },
      ]);

      if (error) throw error;

      // Update order status to disputed
      await (supabase as any)
        .from('orders')
        .update({ status: 'disputed' })
        .eq('id', order.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Dispute filed. Admin investigation initiated.');
      setIsDisputeOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to file dispute');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Visual Asset Banner */}
      <View style={styles.imageBannerWrap}>
        <Image
          source={{
            uri:
              order.image ||
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
          }}
          style={styles.imageBanner}
          resizeMode="cover"
        />
      </View>

      {/* Main Info Section */}
      <View style={styles.mainInfo}>
        <View style={styles.topMetaRow}>
          <View style={styles.storeRow}>
            <Store size={12} color={colors.primary} />
            <Text style={styles.storeName}>
              {(order.store || 'LINKUP PARTNER').toUpperCase()}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isDelivered
                ? styles.statusDelivered
                : isDisputed
                ? styles.statusDisputed
                : isCancelled
                ? styles.statusCancelled
                : styles.statusActive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isDelivered
                  ? styles.statusTextDelivered
                  : isDisputed
                  ? styles.statusTextDisputed
                  : isCancelled
                  ? styles.statusTextCancelled
                  : styles.statusTextActive,
              ]}
            >
              {order.displayStatus || order.status?.toUpperCase()}{isDelivered ? ' ☑' : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {order.title}
        </Text>

        <View style={styles.priceAndIdRow}>
          <Text style={styles.price}>
            ₦{Math.round(order.price || 0).toLocaleString('en-NG')}
          </Text>

          <View style={styles.idBox}>
            <Text style={styles.idLabel}>ID</Text>
            <Text style={styles.idValue}>
              {order.id.slice(0, 12).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Extended Tracking Bar */}
      <View style={styles.trackingBar}>
        <TouchableOpacity
          style={styles.trackTriggerBtn}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.8}
        >
          <Text style={styles.trackTriggerText}>
            {isExpanded ? 'CLOSE STATUS' : 'TRACK THIS ORDER..'}
          </Text>
          {isExpanded ? (
            <ChevronUp size={14} color={colors.primary} />
          ) : (
            <ChevronDown size={14} color={colors.primary} />
          )}
        </TouchableOpacity>

        {status === 'completed' && (
          <View style={styles.finalizedBadge}>
            <CheckCircle size={13} color="#16a34a" />
            <Text style={styles.finalizedText}>ORDER FINALIZED SUCCESSFULLY</Text>
          </View>
        )}
      </View>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <View style={styles.drawer}>
          <View style={styles.drawerDivider} />

          {/* Stepper Timeline */}
          <OrderTimeline status={order.status} />

          {/* Live Dispatch Rider & GPS Tracking */}
          {order.shipment && (
            <OrderShipmentIntel shipment={order.shipment} />
          )}

          {/* Status Audit History if shipment has history */}
          {order.shipment?.status_history && (
            <ShipmentStatusHistory history={order.shipment.status_history} />
          )}

          {/* Receipt Component */}
          <Receipt
            orderNumber={`#LK-${order.id.slice(0, 8).toUpperCase()}`}
            items={[
              {
                title: order.title,
                quantity: 1,
                price: order.price,
                size: order.size,
              },
            ]}
            total={order.price}
            shopName={order.store}
          />

          {/* Action Row */}
          <View style={styles.actionsRow}>
            {isDelivered ? (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => setIsReviewOpen(true)}
              >
                <Text style={styles.actionBtnPrimaryText}>Write a Review</Text>
              </TouchableOpacity>
            ) : !isCancelled && !isDisputed ? (
              <>
                <TouchableOpacity
                  style={styles.actionBtnConfirm}
                  onPress={handleConfirmDelivery}
                  disabled={isConfirmingDelivery}
                >
                  {isConfirmingDelivery ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <CheckCircle size={15} color="#ffffff" />
                      <Text style={styles.actionBtnConfirmText}>
                        Confirm Received
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnDispute}
                  onPress={() => setIsDisputeOpen(true)}
                >
                  <AlertCircle size={15} color="#ef4444" />
                  <Text style={styles.actionBtnDisputeText}>File Dispute</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      )}

      {/* Review Modal */}
      <AppModal
        visible={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="Review Purchased Product"
        subtitle="Share your honest assessment with the Linkup community"
        primaryButton={{
          label: isSubmittingReview ? 'Submitting...' : 'Post Review',
          onPress: handleSubmitReview,
          loading: isSubmittingReview,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setIsReviewOpen(false),
          variant: 'outline',
        }}
      >
        <RatingSelector rating={rating} setRating={setRating} />
      </AppModal>

      {/* Financial Dispute Modal */}
      <AppModal
        visible={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
        title="Open Financial Dispute"
        subtitle="Escrow funds will remain locked pending administrator adjudication"
        variant="danger"
        primaryButton={{
          label: isSubmittingDispute ? 'Submitting...' : 'Submit Dispute',
          onPress: handleSubmitDispute,
          loading: isSubmittingDispute,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setIsDisputeOpen(false),
          variant: 'outline',
        }}
      >
        <View style={{ paddingVertical: 6 }}>
          <Text style={styles.fieldLabel}>Dispute Reason</Text>
          <View style={styles.disputePills}>
            {['Item Not Received', 'Damaged / Defective', 'Wrong Item Delivered'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.pill, disputeReason === r && styles.pillActive]}
                onPress={() => setDisputeReason(r)}
              >
                <Text style={[styles.pillText, disputeReason === r && styles.pillTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  imageBannerWrap: {
    width: '100%',
    height: 150,
    backgroundColor: '#f1f5f9',
  },
  imageBanner: {
    width: '100%',
    height: '100%',
  },
  mainInfo: {
    padding: 14,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeName: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 20,
    marginBottom: 8,
  },
  priceAndIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  idBox: {
    alignItems: 'flex-end',
  },
  idLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  idValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  trackingBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  trackTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackTriggerText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  finalizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  finalizedText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#eff6ff',
  },
  statusDelivered: {
    backgroundColor: '#ecfdf5',
  },
  statusDisputed: {
    backgroundColor: '#fef2f2',
  },
  statusCancelled: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#2563eb',
  },
  statusTextDelivered: {
    color: '#16a34a',
  },
  statusTextDisputed: {
    color: '#dc2626',
  },
  statusTextCancelled: {
    color: '#64748b',
  },
  chevronWrap: {
    padding: 4,
  },
  drawer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  actionBtnPrimary: {
    flex: 1,
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnConfirm: {
    flex: 1,
    height: 42,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnDispute: {
    height: 42,
    paddingHorizontal: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnDisputeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  disputePills: {
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ef4444',
  },
});
