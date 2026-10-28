import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { CheckoutProgress } from './v2/CheckoutProgress';
import { DeliveryStep } from './v2/DeliveryStep';
import { PaymentStep } from './v2/PaymentStep';
import { SuccessStep } from './v2/SuccessStep';
import { CrossZoneWarning } from './v2/CrossZoneWarning';
import { PaystackWebViewModal } from '../../../components/ui/PaystackWebViewModal';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { toast } from '../../../components/ui/GooeyToast';
import { ENV } from '../../../config/env';
import * as Location from 'expo-location';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  directBuyItem?: any;
}

export function CheckoutModal({
  isOpen,
  onClose,
  directBuyItem,
}: CheckoutModalProps) {
  const insets = useSafeAreaInsets();
  const { items, clearCart, subtotal } = useCart();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showCrossZoneWarning, setShowCrossZoneWarning] = useState(false);

  // Paystack state
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);
  const [paystackRef, setPaystackRef] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Shipping Form
  const [shipping, setShipping] = useState({
    name: profile?.full_name || '',
    address: (profile as any)?.address || '',
    city_id: (profile as any)?.city_id || '',
    zone_id: (profile as any)?.zone_id || '',
    phone: profile?.phone || '',
  });

  const checkoutItems = directBuyItem ? [directBuyItem] : items;

  // Load Metadata
  useEffect(() => {
    async function loadMeta() {
      const [citiesRes, zonesRes, feeRes] = await Promise.all([
        supabase.from('cities').select('*'),
        supabase.from('delivery_zones').select('*').eq('is_active', true),
        supabase.from('fee_config').select('*').eq('is_active', true),
      ]);

      if (citiesRes.data) setCities(citiesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (feeRes.data) setFeeConfigs(feeRes.data);
    }

    if (isOpen) {
      loadMeta();
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Fees calculation
  const riderFeeConfig = feeConfigs.find((f: any) => f.fee_type === 'rider');
  const baseDeliveryFee = riderFeeConfig?.flat_fee ?? 1500;
  const platformRate = 0.10;

  const baseProductTotal = directBuyItem
    ? directBuyItem.price * (directBuyItem.quantity || 1)
    : subtotal;

  const platformFee = Math.round(baseProductTotal * platformRate);
  const deliveryFee = baseDeliveryFee;
  const grandTotal = baseProductTotal + platformFee + deliveryFee;

  // Detect location
  const handleDetectLocation = async () => {
    try {
      setIsDetecting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission denied to access location');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (addr) {
        const detectedDistrict = addr.district || addr.city || '';
        const matched = zones.find((z) =>
          detectedDistrict.toLowerCase().includes(z.name.toLowerCase().trim())
        );

        setShipping((prev) => ({
          ...prev,
          address: `${addr.name || ''} ${addr.street || ''}, ${addr.district || ''}`.trim(),
          zone_id: matched?.id || prev.zone_id,
        }));
        toast.success('Location detected');
      }
    } catch {
      toast.error('Could not detect location');
    } finally {
      setIsDetecting(false);
    }
  };

  // Launch Paystack payment
  const handleStartPayment = () => {
    const ref = `LK_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    setPaystackRef(ref);
    setIsPaystackOpen(true);
  };

  // Paystack verification
  const handlePaymentSuccess = async (txRef: string) => {
    setIsPaystackOpen(false);

    try {
      // 1. Create Order row
      const firstItem = checkoutItems[0];
      const { data: orderData, error } = await (supabase as any)
        .from('orders')
        .insert({
          buyer_id: user?.id,
          seller_id: firstItem?.sellerId,
          product_id: firstItem?.productId || firstItem?.id,
          total_price: grandTotal,
          delivery_address: shipping.address,
          status: 'confirmed',
          city_id: shipping.city_id || undefined,
          zone_id: shipping.zone_id || undefined,
          payment_ref: txRef,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Clear cart if not direct buy
      if (!directBuyItem) {
        clearCart();
      }

      setCreatedOrderId(orderData?.id || txRef);
      setCurrentStep(3); // Success step
    } catch (err: any) {
      toast.error(err.message || 'Payment verified, but could not finalize order record');
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Progress Stepper */}
        {currentStep < 3 && <CheckoutProgress currentStep={currentStep} />}

        {/* Step 1: Delivery */}
        {currentStep === 1 && (
          <DeliveryStep
            shipping={shipping}
            setShipping={setShipping}
            cities={cities}
            zones={zones}
            onNext={() => setCurrentStep(2)}
            isDetecting={isDetecting}
            onDetectLocation={handleDetectLocation}
          />
        )}

        {/* Step 2: Payment */}
        {currentStep === 2 && (
          <PaymentStep
            items={checkoutItems}
            baseProductTotal={baseProductTotal}
            platformFee={platformFee}
            deliveryFee={deliveryFee}
            grandTotal={grandTotal}
            onBack={() => setCurrentStep(1)}
            onPay={handleStartPayment}
            isPending={false}
          />
        )}

        {/* Step 3: Success Confirmation */}
        {currentStep === 3 && (
          <SuccessStep
            orderId={createdOrderId || undefined}
            onViewOrders={onClose}
            onContinueShopping={onClose}
          />
        )}

        {/* Cross Zone Warning Alert */}
        <CrossZoneWarning
          open={showCrossZoneWarning}
          onClose={() => setShowCrossZoneWarning(false)}
          onConfirm={() => {
            setShowCrossZoneWarning(false);
            setCurrentStep(2);
          }}
          crossZoneFee={1000}
        />

        {/* Paystack Native WebView */}
        <PaystackWebViewModal
          visible={isPaystackOpen}
          onCancel={() => setIsPaystackOpen(false)}
          amount={grandTotal}
          email={user?.email || 'buyer@linkupng.com'}
          reference={paystackRef}
          onSuccess={handlePaymentSuccess}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
