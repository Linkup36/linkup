import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { AccountMenuModal } from '../../user/components/AccountMenuModal';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { supabase } from '../../../services/supabase';
import {
  Package,
  MapPin,
  Bike,
  Car,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Headphones,
  Bell,
  ShoppingCart,
  Navigation,
  Wallet,
  CreditCard,
  Edit2,
  Tag,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { PaystackWebViewModal } from '../../../components/ui/PaystackWebViewModal';
import { SendProgress } from '../components/SendProgress';
import { AddressAutocompleteInput } from '../components/AddressAutocompleteInput';
import { RoutePreviewMap } from '../components/RoutePreviewMap';
import { SendSupportModal } from '../components/support/SendSupportModal';
import { StepPaymentSuccess } from '../components/steps/StepPaymentSuccess';
import { useSendPricing } from '../hooks/useSendPricing';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { generateSendOrderId } from '../utils/orderId';
import { SendOrderFormData } from '../schemas/sendOrderSchema';
import { SavedAddress } from '../types';

interface PackageSizeOption {
  label: string;
  sub: string;
  desc: string;
  weight: number;
}

const PACKAGE_SIZES: PackageSizeOption[] = [
  { label: 'Small', sub: 'Under 2kg', desc: 'Books, documents, phones', weight: 1.5 },
  { label: 'Medium', sub: '2 - 5kg', desc: 'Shoebox, small electronics', weight: 3.5 },
  { label: 'Large', sub: '5 - 10kg', desc: 'Microwave, clothing batch', weight: 7.5 },
  { label: 'Extra Large', sub: '10kg+', desc: 'Heavy appliances, cartons', weight: 12.0 },
];

const VEHICLES = [
  { id: 'bike', label: 'Motorbike', icon: Bike, desc: 'Under 10kg, Express courier', basePrice: 500 },
  { id: 'car', label: 'Car / Sedan', icon: Car, desc: 'Fragile, cakes, electronics', basePrice: 1500 },
  { id: 'van', label: 'Delivery Van', icon: Truck, desc: 'Bulky furniture, appliances', basePrice: 4000 },
];

export function SendPackageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile } = useAuth();
  const { totalCount } = useCart();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [paystackModalVisible, setPaystackModalVisible] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet');

  // Form State
  const [formData, setFormData] = useState<SendOrderFormData>({
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    pickupLat: null,
    pickupLng: null,
    pickupDirections: '',
    savePickupAddress: false,
    pickupAddressLabel: '',

    dropoffRecipientName: '',
    dropoffRecipientPhone: '',
    dropoffAddress: '',
    dropoffLat: null,
    dropoffLng: null,
    dropoffDirections: '',
    saveDropoffAddress: false,
    dropoffAddressLabel: '',

    weightKg: 1.5,
    packageContents: '',
    isFragile: false,
  });

  const [selectedVehicle, setSelectedVehicle] = useState('bike');
  const [selectedSize, setSelectedSize] = useState('Small');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { addresses: savedAddresses, saveAddress } = useSavedAddresses();

  const scrollRef = useRef<any>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Layout offset tracking for auto-scrolling focused fields to top
  const stepSectionY = useRef(110);
  const step1SizeCardY = useRef(80);
  const step1CardY = useRef(350);
  const step2CardY = useRef(80);
  const step3CardY = useRef(80);
  const fieldYOffsets = useRef<Record<string, number>>({});

  const DEFAULT_OFFSETS: Record<string, number> = {
    customWeight: 320,
    packageContents: 460,
    senderName: 190,
    senderPhone: 270,
    pickupAddress: 360,
    pickupDirections: 480,
    pickupAddressLabel: 560,
    dropoffRecipientName: 190,
    dropoffRecipientPhone: 270,
    dropoffAddress: 360,
    dropoffDirections: 480,
    dropoffAddressLabel: 560,
  };

  // Auto-manage keyboard visibility and ScrollView space
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleFieldFocus = (fieldKey: string) => {
    const performScroll = () => {
      if (!scrollRef.current) return;

      let targetY: number;

      const fieldOffset = fieldYOffsets.current[fieldKey];
      if (typeof fieldOffset === 'number') {
        const secY = stepSectionY.current || 110;
        let cardOffset = 0;
        if (fieldKey === 'customWeight') {
          cardOffset = step1SizeCardY.current || 80;
        } else if (fieldKey === 'packageContents') {
          cardOffset = step1CardY.current || 350;
        } else if (fieldKey.startsWith('pickup') || fieldKey.startsWith('sender')) {
          cardOffset = step2CardY.current || 80;
        } else if (fieldKey.startsWith('dropoff')) {
          cardOffset = step3CardY.current || 80;
        }
        targetY = secY + cardOffset + fieldOffset - 16;
      } else {
        targetY = DEFAULT_OFFSETS[fieldKey] ?? 200;
      }

      scrollRef.current.scrollTo({
        y: Math.max(0, targetY),
        animated: true,
      });
    };

    // 1. Scroll immediately on focus tap
    performScroll();

    // 2. Scroll again as keyboard begins animating up
    setTimeout(performScroll, Platform.OS === 'ios' ? 70 : 120);

    // 3. Scroll once more after keyboard is fully established
    setTimeout(performScroll, Platform.OS === 'ios' ? 220 : 300);
  };

  // Prefill sender details from auth profile
  useEffect(() => {
    if (profile || user) {
      setFormData((prev) => ({
        ...prev,
        senderName: prev.senderName || profile?.full_name || profile?.display_name || '',
        senderPhone: prev.senderPhone || profile?.phone || '',
        pickupAddress: prev.pickupAddress || profile?.address || '',
      }));
    }
  }, [profile, user]);

  // Query live user wallet balance
  const { data: walletData } = useQuery({
    queryKey: ['user-wallet-send', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from('wallets')
        .select('id, balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const walletBalance = Number(walletData?.balance || 0);

  // Dynamic pricing calculation hook
  const pricing = useSendPricing({
    pickupLat: formData.pickupLat,
    pickupLng: formData.pickupLng,
    dropoffLat: formData.dropoffLat,
    dropoffLng: formData.dropoffLng,
    weightKg: formData.weightKg,
    isFragile: formData.isFragile,
  });

  const vehicleObj = VEHICLES.find((v) => v.id === selectedVehicle) || VEHICLES[0];
  const vehicleBaseOffset = vehicleObj.basePrice - 500;
  const finalCalculatedFee = pricing.isFreeDelivery ? 0 : Math.max(0, pricing.totalFee + vehicleBaseOffset);

  const hasSufficientWallet = walletBalance >= finalCalculatedFee;

  // Auto-select payment method based on wallet balance
  useEffect(() => {
    if (hasSufficientWallet && walletBalance > 0) {
      setPaymentMethod('wallet');
    } else {
      setPaymentMethod('paystack');
    }
  }, [hasSufficientWallet, walletBalance]);

  const updateFormData = (updates: Partial<SendOrderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const formatPrice = (val: number) => '₦' + Number(val).toLocaleString('en-NG');

  // Step 1 Validation
  const handleStep1Next = () => {
    if (!formData.packageContents.trim()) {
      setErrors({ packageContents: 'Please specify what is inside the parcel' });
      toast.error('Please specify what you are sending');
      return;
    }
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setStep(2);
  };

  // Step 2 Validation
  const handleStep2Next = () => {
    const errs: Record<string, string> = {};
    if (!formData.senderName.trim()) errs.senderName = 'Sender full name is required';
    if (!formData.senderPhone.trim()) errs.senderPhone = 'Contact phone number is required';
    if (!formData.pickupAddress.trim()) errs.pickupAddress = 'Pickup street address is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please complete all required pickup fields');
      return;
    }

    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setStep(3);
  };

  // Step 3 Validation
  const handleStep3Next = () => {
    const errs: Record<string, string> = {};
    if (!formData.dropoffRecipientName.trim()) errs.dropoffRecipientName = 'Recipient name is required';
    if (!formData.dropoffRecipientPhone.trim()) errs.dropoffRecipientPhone = 'Recipient phone number is required';
    if (!formData.dropoffAddress.trim()) errs.dropoffAddress = 'Destination address is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please complete all required drop-off fields');
      return;
    }

    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setStep(4);
  };

  // Step 4 Validation
  const handleStep4Next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setStep(5);
  };

  // Save address helper
  const handleSaveAddressesIfNeeded = async () => {
    if (formData.savePickupAddress && formData.pickupAddress.trim()) {
      try {
        await saveAddress({
          label: formData.pickupAddressLabel || 'Pickup Location',
          type: 'pickup',
          contact_name: formData.senderName,
          contact_phone: formData.senderPhone,
          address: formData.pickupAddress,
          directions: formData.pickupDirections,
          latitude: formData.pickupLat,
          longitude: formData.pickupLng,
        });
      } catch { }
    }

    if (formData.saveDropoffAddress && formData.dropoffAddress.trim()) {
      try {
        await saveAddress({
          label: formData.dropoffAddressLabel || 'Drop-off Destination',
          type: 'dropoff',
          contact_name: formData.dropoffRecipientName,
          contact_phone: formData.dropoffRecipientPhone,
          address: formData.dropoffAddress,
          directions: formData.dropoffDirections,
          latitude: formData.dropoffLat,
          longitude: formData.dropoffLng,
        });
      } catch { }
    }
  };

  // Final Order Creation & Payment
  const handleConfirmAndPay = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the LinkUp delivery terms');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      const orderId = generateSendOrderId();
      const clientReference = `ref_${orderId}_${Date.now()}`;

      const orderRecord = {
        id: orderId,
        user_id: user?.id || null,
        status: 'pending_payment',
        sender_name: formData.senderName,
        sender_phone: formData.senderPhone,
        pickup_address: formData.pickupAddress,
        pickup_lat: formData.pickupLat || null,
        pickup_lng: formData.pickupLng || null,
        pickup_directions: formData.pickupDirections || null,
        dropoff_recipient_name: formData.dropoffRecipientName,
        dropoff_recipient_phone: formData.dropoffRecipientPhone,
        dropoff_address: formData.dropoffAddress,
        dropoff_lat: formData.dropoffLat || null,
        dropoff_lng: formData.dropoffLng || null,
        dropoff_directions: formData.dropoffDirections || null,
        package_details: {
          weight_kg: formData.weightKg,
          contents: formData.packageContents,
          is_fragile: formData.isFragile,
          declared_value: formData.declaredValue || 0,
          vehicle: selectedVehicle,
          distance_km: pricing.distanceKm,
        },
        delivery_fee: finalCalculatedFee,
        currency: 'NGN',
        payment_status: 'pending',
        payment_ref: clientReference,
        estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Insert into Supabase send_orders
      if (user) {
        try {
          await (supabase as any).from('send_orders').insert(orderRecord);
        } catch (dbErr) {
          console.warn('send_orders insert error:', dbErr);
        }
      }

      // Local AsyncStorage fallback
      await AsyncStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(orderRecord));

      // Save checked addresses
      await handleSaveAddressesIfNeeded();

      // Free Delivery Promo branch
      if (finalCalculatedFee === 0 || pricing.isFreeDelivery) {
        const confirmed = {
          ...orderRecord,
          status: 'finding_rider',
          payment_status: 'paid',
          payment_ref: `FREE_PROMO_${orderId}`,
          paid_at: new Date().toISOString(),
        };

        if (user) {
          await (supabase as any)
            .from('send_orders')
            .update({
              status: 'finding_rider',
              payment_status: 'paid',
              payment_ref: `FREE_PROMO_${orderId}`,
            })
            .eq('id', orderId);
        }

        await AsyncStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(confirmed));
        queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
        setConfirmedOrderId(orderId);
        setStep(6);
        return;
      }

      // Wallet Payment Branch
      if (paymentMethod === 'wallet') {
        if (!user) {
          toast.error('Please sign in to pay with wallet');
          setLoading(false);
          return;
        }

        const { error: rpcErr } = await (supabase as any).rpc('pay_send_order_with_wallet', {
          p_order_id: orderId,
        });

        if (rpcErr) {
          throw new Error(rpcErr.message || 'Wallet payment deduction failed');
        }

        const confirmed = {
          ...orderRecord,
          status: 'finding_rider',
          payment_status: 'paid',
          payment_ref: `WALLET_${orderId}`,
          paid_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(confirmed));

        queryClient.invalidateQueries({ queryKey: ['user-wallet', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet-send', user.id] });
        queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });

        toast.success(`Paid ${formatPrice(finalCalculatedFee)} from LinkUp Wallet!`);
        setConfirmedOrderId(orderId);
        setStep(6);
        return;
      }

      // Paystack Payment Branch
      setConfirmedOrderId(orderId);
      setPaystackModalVisible(true);
    } catch (err: any) {
      toast.error(err?.message || 'Could not place delivery order');
    } finally {
      setLoading(false);
    }
  };

  const handlePaystackSuccess = async (reference: string) => {
    setPaystackModalVisible(false);
    try {
      if (user && confirmedOrderId) {
        await (supabase as any)
          .from('send_orders')
          .update({
            status: 'finding_rider',
            payment_status: 'paid',
            payment_ref: reference,
            paid_at: new Date().toISOString(),
          })
          .eq('id', confirmedOrderId);
      }

      queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
      toast.success('Payment verified! Searching for your dispatch rider.');
      setStep(6);
    } catch (e) {
      setStep(6);
    }
  };

  const handleSelectSavedPickup = (addr: SavedAddress) => {
    updateFormData({
      pickupAddress: addr.address,
      pickupLat: addr.latitude,
      pickupLng: addr.longitude,
      pickupDirections: addr.directions || '',
      senderName: addr.contact_name || formData.senderName,
      senderPhone: addr.contact_phone || formData.senderPhone,
    });
    toast.success(`Selected ${addr.label || 'Saved Address'}`);
  };

  const handleSelectSavedDropoff = (addr: SavedAddress) => {
    updateFormData({
      dropoffAddress: addr.address,
      dropoffLat: addr.latitude,
      dropoffLng: addr.longitude,
      dropoffDirections: addr.directions || '',
      dropoffRecipientName: addr.contact_name || formData.dropoffRecipientName,
      dropoffRecipientPhone: addr.contact_phone || formData.dropoffRecipientPhone,
    });
    toast.success(`Selected ${addr.label || 'Saved Address'}`);
  };

  const userInitial = (profile?.display_name || profile?.full_name || user?.email || 'B').charAt(0).toUpperCase();

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* 1. Top Global Navigation Header matching LinkUp mobile design */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <BrandLogo size="sm" />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandTitle}>Linkup</Text>
            <Text style={styles.brandSubtitle}>GLOBAL</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Bell size={20} color="#334155" strokeWidth={2.2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'CartTab' })}
            activeOpacity={0.7}
          >
            <ShoppingCart size={20} color="#334155" strokeWidth={2.2} />
            {totalCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCount > 9 ? '9+' : totalCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarTriggerBtn}
            onPress={() => setIsAccountMenuOpen(true)}
            activeOpacity={0.8}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && { paddingBottom: 400 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Flow Header with Back Button & Support */}
          {step <= 5 && (
            <View style={styles.flowHeader}>
              <View style={styles.flowHeaderLeft}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => {
                    if (step > 1) {
                      setStep((prev) => (prev - 1) as any);
                    } else {
                      navigation.navigate('MainTabs', { screen: 'HomeTab' });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={22} color="#0f172a" strokeWidth={2.5} />
                </TouchableOpacity>

                <View style={styles.flowTitleWrap}>
                  <Text style={styles.flowTitle}>Send a Package</Text>
                  <Text style={styles.flowSubtitle}>Send boxes, items, parcels etc.</Text>
                </View>
              </View>

              {/* Contact Support Button */}
              <TouchableOpacity
                style={styles.contactSupportBtn}
                onPress={() => setSupportModalOpen(true)}
                activeOpacity={0.8}
              >
                <Headphones size={16} color="#0f172a" strokeWidth={2.4} />
                <Text style={styles.contactSupportText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 5-Step Stepper Indicator */}
          {step <= 5 && <SendProgress currentStep={step} />}

          {/* ================= STEP 1: PACKAGE DETAILS ================= */}
          {step === 1 && (
            <View
              style={styles.stepSection}
              onLayout={(e) => {
                stepSectionY.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Package Details</Text>
                <Text style={styles.sectionSub}>Select the size and specify the contents of your parcel.</Text>
              </View>

              {/* Select Package Size Card */}
              <View
                style={styles.cardContainer}
                onLayout={(e) => {
                  step1SizeCardY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.cardHeader}>
                  <Package size={16} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.cardTitle}>SELECT PACKAGE SIZE</Text>
                </View>

                <View style={styles.packageSizesGrid}>
                  {PACKAGE_SIZES.map((s) => {
                    const isSelected = selectedSize === s.label;

                    return (
                      <TouchableOpacity
                        key={s.label}
                        style={[
                          styles.packageSizeCard,
                          isSelected && styles.packageSizeCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedSize(s.label);
                          updateFormData({ weightKg: s.weight });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.packageSizeTop}>
                          <Text style={[styles.packageSizeLabel, isSelected && { color: colors.primary }]}>
                            {s.label}
                          </Text>
                          <View style={[styles.packageSizeSubBadge, isSelected && styles.packageSizeSubBadgeSelected]}>
                            <Text style={[styles.packageSizeSubText, isSelected && { color: colors.primary }]}>
                              {s.sub}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.packageSizeDesc}>{s.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Weight (kg) */}
                <View
                  style={styles.weightWrap}
                  onLayout={(e) => {
                    fieldYOffsets.current['customWeight'] = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.weightLabelRow}>
                    <Text style={styles.inputLabel}>Custom Weight (kg)</Text>
                    <Text style={styles.weightValueText}>{formData.weightKg} kg</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={formData.weightKg ? formData.weightKg.toString() : ''}
                    onChangeText={(val) => {
                      const parsed = parseFloat(val);
                      if (!isNaN(parsed)) updateFormData({ weightKg: parsed });
                    }}
                    onFocus={() => handleFieldFocus('customWeight')}
                    placeholder="e.g. 1.5"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* What are you sending? */}
              <View
                style={styles.cardContainer}
                onLayout={(e) => {
                  step1CardY.current = e.nativeEvent.layout.y;
                }}
              >
                <View
                  style={styles.cardPadding}
                  onLayout={(e) => {
                    fieldYOffsets.current['packageContents'] = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.inputLabel}>
                    What are you sending? <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Books, Laptop in bag, Clothes, Documents"
                    placeholderTextColor="#94a3b8"
                    value={formData.packageContents}
                    onChangeText={(val) => updateFormData({ packageContents: val })}
                    onFocus={() => handleFieldFocus('packageContents')}
                  />
                  {errors.packageContents && (
                    <Text style={styles.fieldError}>{errors.packageContents}</Text>
                  )}

                  {/* Fragile Item Toggle */}
                  <TouchableOpacity
                    style={styles.fragileRow}
                    onPress={() => {
                      updateFormData({ isFragile: !formData.isFragile });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.fragileLeft}>
                      <View style={styles.fragileIconCircle}>
                        <Sparkles size={16} color="#d97706" />
                      </View>
                      <View>
                        <Text style={styles.fragileTitle}>Fragile Item (+₦300)</Text>
                        <Text style={styles.fragileSub}>Requires extra delicate handling</Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, formData.isFragile && styles.checkboxActive]}>
                      {formData.isFragile && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Insurance Banner */}
              <View style={styles.trustBanner}>
                <ShieldCheck size={18} color="#2563eb" />
                <Text style={styles.trustBannerText}>
                  Every parcel is insured and safely tracked from pickup to delivery.
                </Text>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleStep1Next}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>Continue to Pickup Location</Text>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 2: PICKUP LOCATION ================= */}
          {step === 2 && (
            <View
              style={styles.stepSection}
              onLayout={(e) => {
                stepSectionY.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Pickup Location</Text>
                <Text style={styles.sectionSub}>Where should the verified courier pick up this package?</Text>
              </View>

              {/* Saved Addresses Selector */}
              {savedAddresses.length > 0 && (
                <View style={styles.savedSection}>
                  <Text style={styles.savedHeading}>Pick from Saved Addresses:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {savedAddresses.map((addr) => (
                      <TouchableOpacity
                        key={addr.id}
                        style={styles.savedChip}
                        onPress={() => handleSelectSavedPickup(addr)}
                      >
                        <Tag size={12} color={colors.primary} />
                        <Text style={styles.savedChipText}>{addr.label || addr.address.split(',')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View
                style={styles.cardContainer}
                onLayout={(e) => {
                  step2CardY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.cardPadding}>
                  <View
                    onLayout={(e) => {
                      fieldYOffsets.current['senderName'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Sender Full Name <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. John Doe"
                      placeholderTextColor="#94a3b8"
                      value={formData.senderName}
                      onChangeText={(val) => updateFormData({ senderName: val })}
                      onFocus={() => handleFieldFocus('senderName')}
                    />
                    {errors.senderName && <Text style={styles.fieldError}>{errors.senderName}</Text>}
                  </View>

                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['senderPhone'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Sender Contact Phone <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 08012345678"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={formData.senderPhone}
                      onChangeText={(val) => updateFormData({ senderPhone: val })}
                      onFocus={() => handleFieldFocus('senderPhone')}
                    />
                    {errors.senderPhone && <Text style={styles.fieldError}>{errors.senderPhone}</Text>}
                  </View>

                  {/* Pickup Address Autocomplete */}
                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['pickupAddress'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <AddressAutocompleteInput
                      label="Pickup Address"
                      placeholder="Enter pickup street address, area or estate..."
                      value={formData.pickupAddress}
                      latitude={formData.pickupLat}
                      longitude={formData.pickupLng}
                      mode="pickup"
                      onChangeAddress={(val) => updateFormData({ pickupAddress: val })}
                      onSelectLocation={(data) => {
                        updateFormData({
                          pickupAddress: data.address,
                          pickupLat: data.latitude,
                          pickupLng: data.longitude,
                        });
                      }}
                      onFocus={() => handleFieldFocus('pickupAddress')}
                    />
                    {errors.pickupAddress && <Text style={styles.fieldError}>{errors.pickupAddress}</Text>}
                  </View>

                  {/* Extra Directions / Landmark */}
                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['pickupDirections'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Landmark / Pickup Directions (Optional)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Opposite green gate, beside supermarket"
                      placeholderTextColor="#94a3b8"
                      value={formData.pickupDirections || ''}
                      onChangeText={(val) => updateFormData({ pickupDirections: val })}
                      onFocus={() => handleFieldFocus('pickupDirections')}
                    />
                  </View>

                  {/* Save address checkbox */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => updateFormData({ savePickupAddress: !formData.savePickupAddress })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, formData.savePickupAddress && styles.checkboxActive]}>
                      {formData.savePickupAddress && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Save this address for future deliveries</Text>
                  </TouchableOpacity>

                  {formData.savePickupAddress && (
                    <View
                      style={{ marginTop: 8 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['pickupAddressLabel'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <TextInput
                        style={styles.textInput}
                        placeholder="Address label (e.g. Home, Office, Branch)"
                        placeholderTextColor="#94a3b8"
                        value={formData.pickupAddressLabel || ''}
                        onChangeText={(val) => updateFormData({ pickupAddressLabel: val })}
                        onFocus={() => handleFieldFocus('pickupAddressLabel')}
                      />
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleStep2Next}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>Continue to Drop-off Location</Text>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 3: DROP-OFF LOCATION ================= */}
          {step === 3 && (
            <View
              style={styles.stepSection}
              onLayout={(e) => {
                stepSectionY.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Drop-off Location</Text>
                <Text style={styles.sectionSub}>Who is receiving the parcel and where should it be delivered?</Text>
              </View>

              {/* Saved Addresses Selector */}
              {savedAddresses.length > 0 && (
                <View style={styles.savedSection}>
                  <Text style={styles.savedHeading}>Pick from Saved Addresses:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {savedAddresses.map((addr) => (
                      <TouchableOpacity
                        key={addr.id}
                        style={styles.savedChip}
                        onPress={() => handleSelectSavedDropoff(addr)}
                      >
                        <Tag size={12} color={colors.primary} />
                        <Text style={styles.savedChipText}>{addr.label || addr.address.split(',')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View
                style={styles.cardContainer}
                onLayout={(e) => {
                  step3CardY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.cardPadding}>
                  <View
                    onLayout={(e) => {
                      fieldYOffsets.current['dropoffRecipientName'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Recipient Full Name <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Amaka Obi"
                      placeholderTextColor="#94a3b8"
                      value={formData.dropoffRecipientName}
                      onChangeText={(val) => updateFormData({ dropoffRecipientName: val })}
                      onFocus={() => handleFieldFocus('dropoffRecipientName')}
                    />
                    {errors.dropoffRecipientName && (
                      <Text style={styles.fieldError}>{errors.dropoffRecipientName}</Text>
                    )}
                  </View>

                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['dropoffRecipientPhone'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Recipient Phone Number <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 08123456789"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={11}
                      value={formData.dropoffRecipientPhone}
                      onChangeText={(val) => updateFormData({ dropoffRecipientPhone: val })}
                      onFocus={() => handleFieldFocus('dropoffRecipientPhone')}
                    />
                    {errors.dropoffRecipientPhone && (
                      <Text style={styles.fieldError}>{errors.dropoffRecipientPhone}</Text>
                    )}
                  </View>

                  {/* Dropoff Address Autocomplete */}
                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['dropoffAddress'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <AddressAutocompleteInput
                      label="Destination Address"
                      placeholder="Enter destination street address, apartment, or plaza..."
                      value={formData.dropoffAddress}
                      latitude={formData.dropoffLat}
                      longitude={formData.dropoffLng}
                      mode="dropoff"
                      onChangeAddress={(val) => updateFormData({ dropoffAddress: val })}
                      onSelectLocation={(data) => {
                        updateFormData({
                          dropoffAddress: data.address,
                          dropoffLat: data.latitude,
                          dropoffLng: data.longitude,
                        });
                      }}
                      onFocus={() => handleFieldFocus('dropoffAddress')}
                    />
                    {errors.dropoffAddress && (
                      <Text style={styles.fieldError}>{errors.dropoffAddress}</Text>
                    )}
                  </View>

                  {/* Landmark / Extra Drop-off Directions */}
                  <View
                    style={{ marginTop: 14 }}
                    onLayout={(e) => {
                      fieldYOffsets.current['dropoffDirections'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.inputLabel}>
                      Landmark / Delivery Instructions (Optional)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Call recipient upon arrival at security gate"
                      placeholderTextColor="#94a3b8"
                      value={formData.dropoffDirections || ''}
                      onChangeText={(val) => updateFormData({ dropoffDirections: val })}
                      onFocus={() => handleFieldFocus('dropoffDirections')}
                    />
                  </View>

                  {/* Save address checkbox */}
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => updateFormData({ saveDropoffAddress: !formData.saveDropoffAddress })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, formData.saveDropoffAddress && styles.checkboxActive]}>
                      {formData.saveDropoffAddress && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Save this address for future deliveries</Text>
                  </TouchableOpacity>

                  {formData.saveDropoffAddress && (
                    <View
                      style={{ marginTop: 8 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['dropoffAddressLabel'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <TextInput
                        style={styles.textInput}
                        placeholder="Address label (e.g. Mum's House, Store, Office)"
                        placeholderTextColor="#94a3b8"
                        value={formData.dropoffAddressLabel || ''}
                        onChangeText={(val) => updateFormData({ dropoffAddressLabel: val })}
                        onFocus={() => handleFieldFocus('dropoffAddressLabel')}
                      />
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleStep3Next}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>Continue to Review & Price</Text>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 4: REVIEW & PRICE ================= */}
          {step === 4 && (
            <View style={styles.stepSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Review & Price</Text>
                <Text style={styles.sectionSub}>Verified GPS route distance and estimated delivery fees.</Text>
              </View>

              {/* LIVE NATIVE ROUTE MAP */}
              <RoutePreviewMap
                pickupLat={formData.pickupLat}
                pickupLng={formData.pickupLng}
                dropoffLat={formData.dropoffLat}
                dropoffLng={formData.dropoffLng}
                distanceKm={pricing.distanceKm}
                estimatedMinutes={pricing.estimatedMinutesRange}
              />

              {/* Vehicle Mode Selector */}
              <View style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>CHOOSE DELIVERY VEHICLE</Text>
                </View>
                <View style={styles.cardPadding}>
                  <View style={styles.vehicleRow}>
                    {VEHICLES.map((v) => {
                      const Icon = v.icon;
                      const active = selectedVehicle === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                          onPress={() => setSelectedVehicle(v.id)}
                          activeOpacity={0.8}
                        >
                          <Icon size={24} color={active ? colors.primary : '#64748b'} />
                          <Text style={[styles.vehicleLabel, active && styles.vehicleLabelActive]}>
                            {v.label}
                          </Text>
                          <Text style={styles.vehicleDesc}>{v.desc.split(',')[0]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Trip Details Card */}
              <View style={styles.cardContainer}>
                <View style={styles.cardPadding}>
                  <View style={styles.reviewItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewLabel}>PICKUP FROM</Text>
                      <Text style={styles.reviewAddress}>{formData.pickupAddress}</Text>
                      <Text style={styles.reviewPerson}>{formData.senderName} • {formData.senderPhone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(2)} style={styles.editBtn}>
                      <Edit2 size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.reviewDivider} />

                  <View style={styles.reviewItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewLabel}>DELIVER TO</Text>
                      <Text style={styles.reviewAddress}>{formData.dropoffAddress}</Text>
                      <Text style={styles.reviewPerson}>{formData.dropoffRecipientName} • {formData.dropoffRecipientPhone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(3)} style={styles.editBtn}>
                      <Edit2 size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.reviewDivider} />

                  <View style={styles.reviewItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewLabel}>PARCEL SPECIFICATIONS</Text>
                      <Text style={styles.reviewAddress}>
                        {selectedSize} Size ({formData.weightKg} kg) - {formData.packageContents}
                      </Text>
                      {formData.isFragile && (
                        <Text style={[styles.reviewPerson, { color: '#d97706' }]}>
                          ⚡ Fragile handling protection included
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setStep(1)} style={styles.editBtn}>
                      <Edit2 size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Price Breakdown Card */}
              <View style={styles.cardContainer}>
                <View style={styles.cardPadding}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Base Fare ({vehicleObj.label})</Text>
                    <Text style={styles.priceVal}>{formatPrice(pricing.baseFee + vehicleBaseOffset)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Distance Fee ({pricing.distanceKm} km)</Text>
                    <Text style={styles.priceVal}>{formatPrice(pricing.distanceFee)}</Text>
                  </View>
                  {pricing.packageSurcharge > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Weight Surcharge ({formData.weightKg} kg)</Text>
                      <Text style={styles.priceVal}>+{formatPrice(pricing.packageSurcharge)}</Text>
                    </View>
                  )}
                  {formData.isFragile && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Fragile Protection Fee</Text>
                      <Text style={styles.priceVal}>+{formatPrice(pricing.fragileSurcharge)}</Text>
                    </View>
                  )}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Platform Service Fee</Text>
                    <Text style={styles.priceVal}>{formatPrice(pricing.serviceFee)}</Text>
                  </View>

                  {pricing.isFreeDelivery && (
                    <View style={[styles.priceRow, { backgroundColor: '#f0fdf4', padding: 6, borderRadius: 8 }]}>
                      <Text style={[styles.priceLabel, { color: '#16a34a', fontWeight: '800' }]}>
                        Free Delivery Promo
                      </Text>
                      <Text style={[styles.priceVal, { color: '#16a34a', fontWeight: '800' }]}>-100%</Text>
                    </View>
                  )}

                  <View style={styles.priceDivider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Estimated Total</Text>
                    <Text style={styles.totalVal}>{formatPrice(finalCalculatedFee)}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleStep4Next}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>Proceed to Confirm & Pay</Text>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 5: CONFIRM & PAY ================= */}
          {step === 5 && (
            <View style={styles.stepSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>Confirm & Dispatch</Text>
                <Text style={styles.sectionSub}>Review payment details and finalize courier booking.</Text>
              </View>

              {/* Payment Method Selector */}
              <View style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>SELECT PAYMENT METHOD</Text>
                </View>
                <View style={styles.cardPadding}>
                  {/* Option 1: Wallet */}
                  <TouchableOpacity
                    style={[
                      styles.paymentOptionCard,
                      paymentMethod === 'wallet' && styles.paymentOptionActive,
                    ]}
                    onPress={() => setPaymentMethod('wallet')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.paymentOptionLeft}>
                      <View style={[styles.paymentIconWrap, { backgroundColor: '#fff7ed' }]}>
                        <Wallet size={20} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.paymentOptionTitle}>LinkUp Wallet</Text>
                        <Text style={styles.paymentOptionSub}>
                          Available Balance: {formatPrice(walletBalance)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, paymentMethod === 'wallet' && styles.radioCircleActive]}>
                      {paymentMethod === 'wallet' && <Check size={12} color="#ffffff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Paystack Card / Transfer */}
                  <TouchableOpacity
                    style={[
                      styles.paymentOptionCard,
                      paymentMethod === 'paystack' && styles.paymentOptionActive,
                      { marginTop: 10 },
                    ]}
                    onPress={() => setPaymentMethod('paystack')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.paymentOptionLeft}>
                      <View style={[styles.paymentIconWrap, { backgroundColor: '#eff6ff' }]}>
                        <CreditCard size={20} color="#2563eb" />
                      </View>
                      <View>
                        <Text style={styles.paymentOptionTitle}>Paystack Gateway</Text>
                        <Text style={styles.paymentOptionSub}>Debit Card, Bank Transfer, USSD</Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, paymentMethod === 'paystack' && styles.radioCircleActive]}>
                      {paymentMethod === 'paystack' && <Check size={12} color="#ffffff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Escrow Guarantee Banner */}
              <View style={styles.trustBanner}>
                <ShieldCheck size={20} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trustBannerTitle}>LinkUp Escrow Protection Active</Text>
                  <Text style={styles.trustBannerText}>
                    Your payment is safely held until the package is delivered and confirmed.
                  </Text>
                </View>
              </View>

              {/* Terms checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                  {agreedToTerms && <Check size={14} color="#ffffff" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I accept the LinkUp Send terms & conditions and understand courier insurance rules.
                </Text>
              </TouchableOpacity>

              {/* Confirm & Request Courier Button */}
              <TouchableOpacity
                style={[styles.primaryActionBtn, loading && { opacity: 0.8 }]}
                onPress={handleConfirmAndPay}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Navigation size={20} color="#ffffff" strokeWidth={2.4} />
                    <Text style={styles.primaryActionBtnText}>
                      Confirm & Request Courier ({formatPrice(finalCalculatedFee)})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 6: PAYMENT SUCCESS ================= */}
          {step === 6 && (
            <StepPaymentSuccess
              orderId={confirmedOrderId}
              formData={formData}
              onReset={() => {
                setStep(1);
                setFormData({
                  senderName: profile?.full_name || '',
                  senderPhone: profile?.phone || '',
                  pickupAddress: '',
                  pickupLat: null,
                  pickupLng: null,
                  pickupDirections: '',
                  savePickupAddress: false,
                  pickupAddressLabel: '',

                  dropoffRecipientName: '',
                  dropoffRecipientPhone: '',
                  dropoffAddress: '',
                  dropoffLat: null,
                  dropoffLng: null,
                  dropoffDirections: '',
                  saveDropoffAddress: false,
                  dropoffAddressLabel: '',

                  weightKg: 1.5,
                  packageContents: '',
                  isFragile: false,
                });
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Orange Customer Support Button */}
      {!isKeyboardVisible && (
        <TouchableOpacity
          style={styles.floatingSupportBtn}
          onPress={() => setSupportModalOpen(true)}
          activeOpacity={0.85}
        >
          <Headphones size={22} color="#ffffff" strokeWidth={2.4} />
        </TouchableOpacity>
      )}

      {/* Account Menu Flyout Modal */}
      <AccountMenuModal
        visible={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
      />

      {/* Support Modal */}
      <SendSupportModal
        visible={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        orderId={confirmedOrderId}
      />

      {/* Paystack Webview Modal */}
      <PaystackWebViewModal
        visible={paystackModalVisible}
        email={user?.email || `${formData.senderPhone.replace(/\D/g, '') || 'customer'}@linkup.delivery`}
        amount={finalCalculatedFee}
        reference={`PAYSTACK_${confirmedOrderId}_${Date.now()}`}
        metadata={{ order_id: confirmedOrderId, order_type: 'send_order' }}
        onSuccess={handlePaystackSuccess}
        onCancel={() => {
          setPaystackModalVisible(false);
          toast.error('Payment cancelled');
        }}
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTextWrap: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  avatarTriggerBtn: {
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 60,
  },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  flowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowTitleWrap: {
    flex: 1,
  },
  flowTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  flowSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  contactSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffbe1a',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  contactSupportText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  stepSection: {
    gap: 14,
  },
  sectionHeader: {
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  cardPadding: {
    padding: 16,
  },
  packageSizesGrid: {
    padding: 12,
    gap: 8,
  },
  packageSizeCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  packageSizeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  packageSizeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageSizeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  packageSizeSubBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  packageSizeSubBadgeSelected: {
    backgroundColor: '#ffedd5',
  },
  packageSizeSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  packageSizeDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  weightWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  weightLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  weightValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  fieldError: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '600',
  },
  fragileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  fragileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  fragileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fragileTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
  },
  fragileSub: {
    fontSize: 10.5,
    color: '#b45309',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  checkboxLabel: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 12,
  },
  trustBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  trustBannerText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
    flex: 1,
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  savedSection: {
    gap: 6,
    marginBottom: 4,
  },
  savedHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  savedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  vehicleCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  vehicleLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 6,
  },
  vehicleLabelActive: {
    color: colors.primary,
  },
  vehicleDesc: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reviewLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  reviewAddress: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  reviewPerson: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  editBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  priceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
  },
  paymentOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentOptionSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  floatingSupportBtn: {
    position: 'absolute',
    bottom: 82,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
