import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Dimensions,
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
  AlertCircle,
  Search,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ChevronRight,
  Bus,
  Zap,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

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
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Mode: Dispatch Hub view (matching reference) vs Booking Flow view
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [paystackModalVisible, setPaystackModalVisible] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet');

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Live user orders
  const [userOrders, setUserOrders] = useState<any[]>([]);

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
  const [isDetectingPickupGps, setIsDetectingPickupGps] = useState(false);

  // Exact GPS detection for Pickup Address
  const handleDetectPickupLocation = async () => {
    setIsDetectingPickupGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location permission was denied. Please allow location access in your device settings.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
      let formatted = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      if (res && res.length > 0) {
        const item = res[0];
        const parts = [
          item.streetNumber,
          item.street,
          item.district || item.subregion,
          item.city,
          item.region,
        ].filter(Boolean);
        if (parts.length > 0) formatted = parts.join(', ');
      }

      updateFormData({
        pickupAddress: formatted,
        pickupLat: latitude,
        pickupLng: longitude,
      });

      if (errors.pickupAddress) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.pickupAddress;
          return next;
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success('Exact pickup location detected!');
    } catch (err: any) {
      console.warn('[LocationDetect] Error:', err);
      toast.error('Could not detect exact location. Please type your address manually.');
    } finally {
      setIsDetectingPickupGps(false);
    }
  };

  const [isDetectingDropoffGps, setIsDetectingDropoffGps] = useState(false);

  // Exact GPS detection for Dropoff Address
  const handleDetectDropoffLocation = async () => {
    setIsDetectingDropoffGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location permission was denied. Please allow location access in your device settings.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
      let formatted = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      if (res && res.length > 0) {
        const item = res[0];
        const parts = [
          item.streetNumber,
          item.street,
          item.district || item.subregion,
          item.city,
          item.region,
        ].filter(Boolean);
        if (parts.length > 0) formatted = parts.join(', ');
      }

      updateFormData({
        dropoffAddress: formatted,
        dropoffLat: latitude,
        dropoffLng: longitude,
      });

      if (errors.dropoffAddress) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.dropoffAddress;
          return next;
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success('Exact drop-off location detected!');
    } catch (err: any) {
      console.warn('[LocationDetect] Error:', err);
      toast.error('Could not detect exact location. Please type your destination address manually.');
    } finally {
      setIsDetectingDropoffGps(false);
    }
  };

  // Layout offset tracking for auto-scrolling focused fields to top
  const stepSectionY = useRef(110);
  const step1SizeCardY = useRef(80);
  const step1CardY = useRef(350);
  const step2CardY = useRef(80);
  const step3CardY = useRef(80);
  const fieldYOffsets = useRef<Record<string, number>>({});

  // Auto-manage keyboard visibility
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

  // Pre-populate sender name & phone from profile
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        senderName: prev.senderName || profile.display_name || profile.full_name || '',
        senderPhone: prev.senderPhone || profile.phone || '',
      }));
    }
  }, [profile]);

  // Fetch real send orders for current user + realtime listener
  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && data) {
          setUserOrders(data);
        }
      } catch (err) {
        console.warn('[SendPackageScreen] fetch orders error:', err);
      }
    };
    fetchOrders();

    const channel = supabase
      .channel(`public:send_orders:user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'send_orders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Pricing calculation
  const pricing = useSendPricing({
    pickupLat: formData.pickupLat,
    pickupLng: formData.pickupLng,
    dropoffLat: formData.dropoffLat,
    dropoffLng: formData.dropoffLng,
    weightKg: formData.weightKg,
    isFragile: formData.isFragile,
  });

  const vehicleBaseOffset = useMemo(() => {
    if (selectedVehicle === 'car') return 1000;
    if (selectedVehicle === 'van') return 3500;
    return 0;
  }, [selectedVehicle]);

  const finalCalculatedFee = pricing.totalFee + vehicleBaseOffset;

  const updateFormData = (fields: Partial<SendOrderFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleFieldFocus = (fieldKey: string) => {
    setTimeout(() => {
      const fieldOffset = fieldYOffsets.current[fieldKey] || 0;
      let targetScrollY = stepSectionY.current + fieldOffset - 80;
      if (step === 1 && fieldKey === 'customWeight') {
        targetScrollY = stepSectionY.current + step1SizeCardY.current + fieldOffset - 70;
      } else if (step === 1 && fieldKey === 'packageContents') {
        targetScrollY = stepSectionY.current + step1CardY.current + fieldOffset - 70;
      } else if (step === 2) {
        targetScrollY = stepSectionY.current + step2CardY.current + fieldOffset - 70;
      } else if (step === 3) {
        targetScrollY = stepSectionY.current + step3CardY.current + fieldOffset - 70;
      }
      scrollRef.current?.scrollTo({
        y: Math.max(0, targetScrollY),
        animated: true,
      });
    }, 150);
  };

  // Step 1 Validation
  const handleStep1Next = () => {
    const errs: Record<string, string> = {};
    if (!formData.packageContents.trim()) {
      errs.packageContents = 'Please describe the package contents';
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
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
    if (!formData.senderName.trim()) errs.senderName = 'Sender name is required';
    if (!formData.senderPhone.trim()) errs.senderPhone = 'Sender phone number is required';
    if (!formData.pickupAddress.trim()) errs.pickupAddress = 'Pickup address is required';

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

  // Broadcast instant push notification to couriers
  const broadcastRiderPushNotification = (orderId: string, fee: number) => {
    const pickupLoc = formData.pickupAddress.split(',')[0].trim() || 'Pickup Point';
    const dropoffLoc = formData.dropoffAddress.split(',')[0].trim() || 'Drop-off';
    const payout = Math.round(fee * 0.8);
    const payoutText = payout > 0 ? ` (₦${payout.toLocaleString('en-NG')} Payout)` : '';

    supabase.functions
      .invoke('send-push', {
        body: {
          role: 'logistics',
          title: `⚡ New Delivery Mission!${payoutText}`,
          message: `Package waiting for pickup: ${pickupLoc} → ${dropoffLoc}. Tap to claim!`,
          url: '/logistics',
          type: 'mission',
          save_notification: false,
        },
      })
      .catch((e) => console.warn('[send-push] Rider broadcast error:', e));
  };

  // Final Order Creation & Payment
  const handleConfirmAndPay = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the LinkUp delivery terms');
      return;
    }

    if (!user) {
      toast.error('Please sign in or create an account to book courier delivery');
      navigation.navigate('Login');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      const orderId = generateSendOrderId();
      const clientReference = `ref_${orderId}_${Date.now()}`;

      const orderRecord = {
        id: orderId,
        user_id: user.id,
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

      const { error: insertErr } = await (supabase as any)
        .from('send_orders')
        .insert(orderRecord);

      if (insertErr) {
        console.error('[SendPackageScreen] send_orders insert error:', insertErr);
        throw new Error(insertErr.message || 'Could not place delivery order. Please try again.');
      }

      await AsyncStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(orderRecord));
      await handleSaveAddressesIfNeeded();

      // Wallet Payment Branch
      if (paymentMethod === 'wallet') {
        const { data: payResult, error: payRpcErr } = await (supabase as any).rpc(
          'pay_send_order_with_wallet',
          {
            p_order_id: orderId,
          }
        );

        if (payRpcErr || !payResult?.success) {
          const errDetail =
            payRpcErr?.message ||
            payResult?.error ||
            'Insufficient LinkUp wallet balance. Please top up or pay with Paystack.';
          toast.error(errDetail);
          setLoading(false);
          return;
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

        toast.success(`Paid ₦${finalCalculatedFee.toLocaleString('en-NG')} from LinkUp Wallet!`);
        broadcastRiderPushNotification(orderId, finalCalculatedFee);
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

        broadcastRiderPushNotification(confirmedOrderId, finalCalculatedFee);
      }
      queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
      toast.success('Payment verified! Searching for your dispatch rider.');
      setStep(6);
    } catch {
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

  const formatPrice = (val: number) => `₦${Math.round(val).toLocaleString('en-NG')}`;

  const vehicleObj = VEHICLES.find((v) => v.id === selectedVehicle) || VEHICLES[0];

  // Dynamic greeting matching time of day
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning,';
    if (hr < 17) return 'Good afternoon,';
    return 'Good evening,';
  }, []);

  const userName = profile?.display_name || profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Guest');
  const userInitial = userName.charAt(0).toUpperCase();

  // Active or latest delivery reference
  const activeOrder = useMemo(() => {
    if (userOrders.length > 0) {
      const live = userOrders.find((o) => !['delivered', 'cancelled'].includes(o.status));
      return live || userOrders[0];
    }
    return null;
  }, [userOrders]);

  const activeTrackingCode = useMemo(() => {
    if (!activeOrder) return '';
    return activeOrder.id;
  }, [activeOrder]);

  const getOrderStatusLabel = (status?: string) => {
    if (!status) return 'Ready to Ship';
    switch (status) {
      case 'pending_payment':
        return 'Payment Pending';
      case 'finding_rider':
        return 'Finding Courier';
      case 'assigned_rider':
        return 'Assigned';
      case 'pickup':
        return 'Picking Up';
      case 'on_the_way':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replace(/_/g, ' ');
    }
  };

  const orderDateFormatted = useMemo(() => {
    if (!activeOrder?.created_at) return null;
    try {
      return new Date(activeOrder.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [activeOrder]);

  const estDeliveryDateFormatted = useMemo(() => {
    if (!activeOrder) return null;
    if (activeOrder.status === 'delivered') {
      if (activeOrder.delivered_at) {
        try {
          return `Delivered ${new Date(activeOrder.delivered_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}`;
        } catch { }
      }
      return 'Delivered';
    }
    if (activeOrder.estimated_delivery_time) {
      try {
        return `Est. ${new Date(activeOrder.estimated_delivery_time).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`;
      } catch { }
    }
    return 'Est. Same-Day Delivery';
  }, [activeOrder]);

  const deliveryStep = useMemo(() => {
    if (!activeOrder) return 0;
    switch (activeOrder.status) {
      case 'pending_payment':
        return 1;
      case 'finding_rider':
        return 1;
      case 'assigned_rider':
      case 'pickup':
        return 2;
      case 'on_the_way':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  }, [activeOrder]);

  // Shipments list for horizontal carousel
  const activeShipmentsList = useMemo(() => {
    return userOrders.slice(0, 6).map((o) => {
      const isPending = o.payment_status === 'pending' || o.status === 'pending_payment';
      return {
        id: o.id,
        origin: o.pickup_address?.split(',')[0]?.trim() || 'Pickup Point',
        destination: o.dropoff_address?.split(',')[0]?.trim() || 'Destination',
        originFlag: '📍',
        destFlag: '🎯',
        status: isPending ? 'Payment Pending' : getOrderStatusLabel(o.status),
        statusColor: o.status === 'delivered' ? '#15803D' : isPending ? '#B45309' : '#C2410C',
        statusBg: o.status === 'delivered' ? '#DCFCE7' : isPending ? '#FEF3C7' : '#FFEDD5',
        rawId: o.id,
      };
    });
  }, [userOrders]);

  // Dynamic analytics computed from real order activity
  const analytics = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekLabel = `${startOfWeek.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })} – ${now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })}`;

    const weeklyOrders = userOrders.filter((o) => {
      const orderDate = new Date(o.created_at);
      return orderDate >= startOfWeek;
    });

    const weeklyCount = weeklyOrders.length;
    const totalDelivered = userOrders.filter((o) => o.status === 'delivered').length;
    const totalCompleted = userOrders.filter((o) => ['delivered', 'cancelled'].includes(o.status)).length;
    const onTimeRate = totalCompleted > 0
      ? Math.round((totalDelivered / totalCompleted) * 100)
      : 100;

    // Daily breakdown for the 7 bars
    const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dEnd = dStart + 24 * 60 * 60 * 1000;
      dailyCounts[i] = userOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= dStart && t < dEnd;
      }).length;
    }

    const maxD = Math.max(...dailyCounts, 1);
    const barHeights = dailyCounts.map((c) =>
      c === 0 ? 18 : Math.round((c / maxD) * 80) + 20
    );

    return {
      weeklyCount,
      weekLabel,
      onTimeRate,
      barHeights,
    };
  }, [userOrders]);

  // Open booking wizard pre-selecting service
  const handleOpenBooking = (vehicleId: string = 'bike') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedVehicle(vehicleId);
    setStep(1);
    setIsBookingOpen(true);
  };

  return (
    <SafeView
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor="#FA7E2B"
      contentBackgroundColor="#F8FAFC"
      statusBarStyle="light-content"
      statusBarColor="#FA7E2B"
    >
      {/* ============================================================
          MODE 1: MODERN DISPATCH & DELIVERY HUB (MATCHING USER REFERENCE)
          ============================================================ */}
      {!isBookingOpen ? (
        <ScrollView
          style={styles.hubContainer}
          contentContainerStyle={styles.hubContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Top Curvy Peach/Orange Header with Hero Current Delivery Card */}
          <View style={styles.topCurvyBanner}>
            {/* Profile Greeting Row */}
            <View style={styles.profileRow}>
              <View style={styles.profileLeft}>
                <TouchableOpacity
                  style={styles.backToHomeBtn}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
                  activeOpacity={0.8}
                  accessibilityLabel="Back to Home"
                >
                  <ArrowLeft size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarCircle}
                  onPress={() => setIsAccountMenuOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.avatarInitialText}>{userInitial}</Text>
                </TouchableOpacity>
                <View style={styles.greetingWrap}>
                  <Text style={styles.greetingSub}>{greeting}</Text>
                  <Text style={styles.greetingName} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.8}
              >
                <Bell size={20} color="#1E293B" strokeWidth={2.4} />
                <View style={styles.bellBadgeDot} />
              </TouchableOpacity>
            </View>

            {/* Current Delivery Card Hero */}
            <View style={styles.heroDeliveryCard}>
              <View style={styles.heroDeliveryTop}>
                <Text style={styles.heroDeliveryLabel}>
                  {activeOrder ? 'Current Delivery' : 'Instant Dispatch'}
                </Text>
                <View style={styles.heroStatusPill}>
                  <View style={[styles.pulsingDot, !activeOrder && styles.pulsingDotGreen]} />
                  <Text style={styles.heroStatusText}>
                    {getOrderStatusLabel(activeOrder?.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.heroTrackingRow}>
                <Text style={styles.heroTrackingCode} numberOfLines={1}>
                  {activeOrder ? activeOrder.id : 'Send a Parcel'}
                </Text>
                <TouchableOpacity
                  style={styles.heroActionBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (activeOrder?.id) {
                      navigation.navigate('SendTracking', { orderId: activeOrder.id });
                    } else {
                      handleOpenBooking('bike');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <ArrowUpRight size={22} color="#FFFFFF" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>

              {/* Dynamic dates or feature highlights */}
              <View style={styles.heroDateRow}>
                <Text style={styles.heroDateText}>
                  {orderDateFormatted || 'Fast 15-min Dispatch'}
                </Text>
                <Text style={styles.heroDateText}>
                  {estDeliveryDateFormatted || 'Door-to-door Delivery'}
                </Text>
              </View>

              {/* Milestone Stepper with Real Status Tracking & Matching Icons */}
              <View style={styles.timelineContainer}>
                {/* Step 1: Placed / Booked */}
                {deliveryStep > 1 ? (
                  <View style={styles.stepNodeBlack}>
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={styles.stepTruckBadge}>
                    <Package size={17} color="#FA7E2B" strokeWidth={2.5} />
                  </View>
                )}

                <View
                  style={[
                    styles.dottedConnector,
                    deliveryStep > 1 && styles.solidConnector,
                  ]}
                />

                {/* Step 2: Courier Assigned & At Pickup */}
                {deliveryStep > 2 ? (
                  <View style={styles.stepNodeBlack}>
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : deliveryStep === 2 ? (
                  <View style={styles.stepTruckBadge}>
                    <Bike size={17} color="#FA7E2B" strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.stepPendingBadge}>
                    <Bike size={13} color="rgba(255, 255, 255, 0.85)" strokeWidth={2.2} />
                  </View>
                )}

                <View
                  style={[
                    styles.dottedConnector,
                    deliveryStep > 2 && styles.solidConnector,
                  ]}
                />

                {/* Step 3: On The Way / In Transit */}
                {deliveryStep > 3 ? (
                  <View style={styles.stepNodeBlack}>
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : deliveryStep === 3 ? (
                  <View style={styles.stepTruckBadge}>
                    <Truck size={17} color="#FA7E2B" strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.stepPendingBadge}>
                    <Truck size={13} color="rgba(255, 255, 255, 0.85)" strokeWidth={2.2} />
                  </View>
                )}

                <View
                  style={[
                    styles.dottedConnector,
                    deliveryStep >= 4 && styles.solidConnector,
                  ]}
                />

                {/* Step 4: Safely Delivered */}
                {deliveryStep >= 4 ? (
                  <View style={[styles.stepTruckBadge, { borderColor: '#15803D' }]}>
                    <CheckCircle2 size={18} color="#15803D" strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.stepPendingBadge}>
                    <CheckCircle2 size={13} color="rgba(255, 255, 255, 0.85)" strokeWidth={2.2} />
                  </View>
                )}
              </View>

              {/* Milestone Step Labels */}
              <View style={styles.timelineLabelsRow}>
                <View style={styles.timelineLabelItem}>
                  <Text style={[styles.timelineLabel, deliveryStep === 1 && styles.timelineLabelActive]}>
                    Placed
                  </Text>
                </View>
                <View style={styles.timelineLabelItem}>
                  <Text style={[styles.timelineLabel, deliveryStep === 2 && styles.timelineLabelActive]}>
                    Pickup
                  </Text>
                </View>
                <View style={styles.timelineLabelItem}>
                  <Text style={[styles.timelineLabel, deliveryStep === 3 && styles.timelineLabelActive]}>
                    In Transit
                  </Text>
                </View>
                <View style={styles.timelineLabelItem}>
                  <Text style={[styles.timelineLabel, deliveryStep === 4 && styles.timelineLabelActive]}>
                    Delivered
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Overlapping Floating Search Bar */}
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchPill}>
              <Search size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchPillInput}
                placeholder={activeOrder ? `Try "${activeOrder.id}"` : 'Search tracking ID (e.g. LSEND-...)'}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (searchQuery.trim()) {
                    navigation.navigate('SendTracking', { orderId: searchQuery.trim() });
                  }
                }}
              />
            </View>
          </View>

          {/* 2. Services Section */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.servicesGrid}>
              {/* Ride (Motorbike) */}
              <TouchableOpacity
                style={styles.serviceTile}
                onPress={() => handleOpenBooking('bike')}
                activeOpacity={0.8}
              >
                <View style={styles.serviceIconBox}>
                  <Bike size={24} color="#EA580C" strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceLabel}>Ride</Text>
              </TouchableOpacity>

              {/* Transit (Bus / Interstate) */}
              <TouchableOpacity
                style={styles.serviceTile}
                onPress={() => handleOpenBooking('van')}
                activeOpacity={0.8}
              >
                <View style={styles.serviceIconBox}>
                  <Bus size={24} color="#DC2626" strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceLabel}>Transit</Text>
              </TouchableOpacity>

              {/* Car (Sedan) */}
              <TouchableOpacity
                style={styles.serviceTile}
                onPress={() => handleOpenBooking('car')}
                activeOpacity={0.8}
              >
                <View style={styles.serviceIconBox}>
                  <Car size={24} color="#D97706" strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceLabel}>Car</Text>
              </TouchableOpacity>

              {/* Truck (Haulage) */}
              <TouchableOpacity
                style={styles.serviceTile}
                onPress={() => handleOpenBooking('van')}
                activeOpacity={0.8}
              >
                <View style={styles.serviceIconBox}>
                  <Truck size={24} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceLabel}>Truck</Text>
              </TouchableOpacity>

              {/* Send (Instant Parcel Dispatch) */}
              <TouchableOpacity
                style={[styles.serviceTile, styles.serviceTileActive]}
                onPress={() => handleOpenBooking('bike')}
                activeOpacity={0.8}
              >
                <View style={[styles.serviceIconBox, styles.serviceIconBoxActive]}>
                  <Package size={24} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <Text style={[styles.serviceLabel, styles.serviceLabelActive]}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Active Shipments Section */}
          <View style={styles.shipmentsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Shipments</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SendHistory')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>View all ›</Text>
              </TouchableOpacity>
            </View>

            {activeShipmentsList.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shipmentsScroll}
              >
                {activeShipmentsList.map((item, idx) => (
                  <TouchableOpacity
                    key={item.rawId || idx}
                    style={styles.shipmentCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (item.rawId) {
                        navigation.navigate('SendTracking', { orderId: item.rawId });
                      } else {
                        navigation.navigate('SendHistory');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.shipmentCardHeader}>
                      <View style={styles.flagPairRow}>
                        <Text style={styles.flagText}>{item.originFlag || '📍'}</Text>
                        <Text style={styles.flagText}>{item.destFlag || '🎯'}</Text>
                      </View>
                      <View style={[styles.shipmentStatusPill, { backgroundColor: item.statusBg }]}>
                        <Text style={[styles.shipmentStatusText, { color: item.statusColor }]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.shipmentRouteText} numberOfLines={1}>
                      {item.origin} → {item.destination}
                    </Text>
                    <Text style={styles.shipmentOrderSnippet}>{item.id}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyShipmentsCard}>
                <View style={styles.emptyShipmentsIconCircle}>
                  <Package size={22} color="#FA7E2B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyShipmentsTitle}>No Active Shipments</Text>
                  <Text style={styles.emptyShipmentsSub}>
                    You have no active package deliveries right now.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.emptyShipmentsBtn}
                  onPress={() => handleOpenBooking('bike')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyShipmentsBtnText}>Send Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 4. This Week Analytics & Activity */}
          <View style={styles.analyticsSection}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <View style={styles.analyticsCardsRow}>
              {/* Parcels Sent Card */}
              <View style={styles.parcelsSentCard}>
                <View style={styles.parcelsSentHeader}>
                  <View style={styles.parcelsIconCircle}>
                    <Package size={16} color="#FA7E2B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analyticsCardTitle}>Parcels sent</Text>
                    <Text style={styles.analyticsCardSub}>{analytics.weekLabel}</Text>
                  </View>
                </View>

                <View style={styles.parcelsStatRow}>
                  <AnimatedCounter
                    value={analytics.weeklyCount}
                    prefix=""
                    duration={1000}
                    style={styles.parcelsStatNumber}
                  />
                  {analytics.weeklyCount > 0 ? (
                    <View style={styles.growthBadge}>
                      <Text style={styles.growthBadgeText}>Live</Text>
                    </View>
                  ) : null}
                </View>

                {/* 7-Day Mini Bar Chart matching user activity */}
                <View style={styles.miniBarChartRow}>
                  {analytics.barHeights.map((h, i) => (
                    <View key={i} style={styles.barCol}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${h}%`,
                            backgroundColor: i === 6 ? '#FA7E2B' : 'rgba(250, 126, 43, 0.25)',
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* On-Time Rate Card */}
              <View style={styles.onTimeCard}>
                <View style={styles.parcelsSentHeader}>
                  <View style={[styles.parcelsIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Zap size={16} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analyticsCardTitle}>On-time</Text>
                    <Text style={styles.analyticsCardSub}>Reliable</Text>
                  </View>
                </View>

                <View style={styles.onTimeStatWrap}>
                  <Text style={styles.onTimeNumber}>{analytics.onTimeRate}%</Text>
                  <Text style={styles.onTimeRatingText}>Escrow Protection</Text>
                </View>

                <View style={styles.escrowSafeRow}>
                  <ShieldCheck size={14} color="#059669" strokeWidth={2.5} />
                  <Text style={styles.escrowSafeText}>100% Escrow Safe</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Floating Dispatch Action Button */}
          <View style={styles.quickDispatchWrap}>
            <TouchableOpacity
              style={styles.quickDispatchBtn}
              onPress={() => handleOpenBooking('bike')}
              activeOpacity={0.88}
            >
              <Navigation size={18} color="#FFFFFF" strokeWidth={2.6} />
              <Text style={styles.quickDispatchBtnText}>+ SEND A PACKAGE NOW</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* ============================================================
           MODE 2: COMPLETE SEND PACKAGE BOOKING WIZARD (STEPS 1 TO 6)
           ============================================================ */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Sticky Curvy Orange Header Banner */}
          {step <= 5 && (
            <View style={styles.bookingCurvyBanner}>
              <View style={styles.flowHeader}>
                <View style={styles.flowHeaderLeft}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                      if (step > 1) {
                        setStep((prev) => (prev - 1) as any);
                      } else {
                        setIsBookingOpen(false);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>

                  <View style={styles.flowTitleWrap}>
                    <Text style={styles.flowTitle}>Send a Package</Text>
                    <Text style={styles.flowSubtitle}>Fast courier pickup & express drop-off</Text>
                  </View>
                </View>

                {/* Back to Hub shortcut button */}
                <TouchableOpacity
                  style={styles.hubExitBtn}
                  onPress={() => setIsBookingOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.hubExitBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* 5-Step Stepper Indicator */}
              <SendProgress currentStep={step} />
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              isKeyboardVisible && { paddingBottom: 400 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          >

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
                          <Text style={styles.fragileTitle}>Fragile Item</Text>
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
                  <Text style={styles.primaryActionBtnText}>Continue to Pickup Details</Text>
                  <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            )}

            {/* ================= STEP 2: PICKUP DETAILS ================= */}
            {step === 2 && (
              <View
                style={styles.stepSection}
                onLayout={(e) => {
                  stepSectionY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeading}>Pickup Details</Text>
                  <Text style={styles.sectionSub}>Where should the dispatch rider collect your package?</Text>
                </View>

                {savedAddresses.length > 0 && (
                  <View style={styles.savedAddressesWrap}>
                    <Text style={styles.savedSectionTitle}>SAVED LOCATIONS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {savedAddresses.map((addr) => (
                        <TouchableOpacity
                          key={addr.id}
                          style={styles.savedAddressPill}
                          onPress={() => handleSelectSavedPickup(addr)}
                          activeOpacity={0.75}
                        >
                          <MapPin size={13} color={colors.primary} />
                          <Text style={styles.savedAddressLabel}>{addr.label || 'Saved Location'}</Text>
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
                        Sender Phone Number <Text style={{ color: '#ef4444' }}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 08012345678"
                        placeholderTextColor="#94a3b8"
                        maxLength={11}
                        keyboardType="phone-pad"
                        value={formData.senderPhone}
                        onChangeText={(val) => updateFormData({ senderPhone: val })}
                        onFocus={() => handleFieldFocus('senderPhone')}
                      />
                      {errors.senderPhone && <Text style={styles.fieldError}>{errors.senderPhone}</Text>}
                    </View>

                    <View
                      style={{ marginTop: 14 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['pickupAddress'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>
                          Pickup Address <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        {formData.pickupLat != null && formData.pickupLng != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                            <CheckCircle2 size={11} color="#16a34a" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>GPS Matched</Text>
                          </View>
                        )}
                      </View>

                      {/* Detect Exact Location Action Button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          backgroundColor: isDetectingPickupGps ? '#fff7ed' : '#f0fdf4',
                          borderWidth: 1.5,
                          borderColor: isDetectingPickupGps ? colors.primary : '#86efac',
                          borderRadius: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          marginBottom: 8,
                        }}
                        onPress={handleDetectPickupLocation}
                        disabled={isDetectingPickupGps}
                        activeOpacity={0.75}
                      >
                        {isDetectingPickupGps ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Navigation size={15} color="#16a34a" />
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDetectingPickupGps ? colors.primary : '#15803d' }}>
                          {isDetectingPickupGps ? 'Detecting Your Exact Location...' : 'Tap to Detect Exact Location (GPS)'}
                        </Text>
                      </TouchableOpacity>

                      {/* Manual Address Input Box */}
                      <View
                        style={[
                          styles.textInput,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 0,
                            height: 48,
                          },
                          Boolean(errors.pickupAddress) && { borderColor: '#ef4444' },
                        ]}
                      >
                        <MapPin size={17} color="#16a34a" style={{ marginRight: 8 }} />
                        <TextInput
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: '#0f172a',
                            fontWeight: '600',
                            height: '100%',
                            paddingVertical: 0,
                          }}
                          placeholder="Type or edit pickup address manually..."
                          placeholderTextColor="#94a3b8"
                          value={formData.pickupAddress}
                          onChangeText={(val) => {
                            updateFormData({ pickupAddress: val });
                            if (errors.pickupAddress) {
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.pickupAddress;
                                return next;
                              });
                            }
                          }}
                          onBlur={async () => {
                            if (formData.pickupAddress.trim() && !formData.pickupLat) {
                              try {
                                const geocoded = await Location.geocodeAsync(formData.pickupAddress);
                                if (geocoded && geocoded.length > 0) {
                                  updateFormData({
                                    pickupLat: geocoded[0].latitude,
                                    pickupLng: geocoded[0].longitude,
                                  });
                                }
                              } catch {}
                            }
                          }}
                          onFocus={() => handleFieldFocus('pickupAddress')}
                        />
                        {Boolean(formData.pickupAddress.length > 0) && (
                          <TouchableOpacity
                            onPress={() => {
                              updateFormData({
                                pickupAddress: '',
                                pickupLat: null,
                                pickupLng: null,
                              });
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ padding: 4 }}
                          >
                            <Text style={{ fontSize: 14, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {errors.pickupAddress && <Text style={styles.fieldError}>{errors.pickupAddress}</Text>}
                    </View>

                    <View
                      style={{ marginTop: 14 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['pickupDirections'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={styles.inputLabel}>Pickup Directions / Landmarks (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Opposite the blue gate, call on arrival"
                        placeholderTextColor="#94a3b8"
                        value={formData.pickupDirections}
                        onChangeText={(val) => updateFormData({ pickupDirections: val })}
                        onFocus={() => handleFieldFocus('pickupDirections')}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleStep2Next}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryActionBtnText}>Continue to Drop-off Details</Text>
                  <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            )}

            {/* ================= STEP 3: DROPOFF DETAILS ================= */}
            {step === 3 && (
              <View
                style={styles.stepSection}
                onLayout={(e) => {
                  stepSectionY.current = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeading}>Drop-off Details</Text>
                  <Text style={styles.sectionSub}>Who is receiving the parcel and where should it go?</Text>
                </View>

                {savedAddresses.length > 0 && (
                  <View style={styles.savedAddressesWrap}>
                    <Text style={styles.savedSectionTitle}>SAVED LOCATIONS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {savedAddresses.map((addr) => (
                        <TouchableOpacity
                          key={addr.id}
                          style={styles.savedAddressPill}
                          onPress={() => handleSelectSavedDropoff(addr)}
                          activeOpacity={0.75}
                        >
                          <MapPin size={13} color={colors.primary} />
                          <Text style={styles.savedAddressLabel}>{addr.label || 'Saved Location'}</Text>
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
                        placeholder="e.g. Sarah Connor"
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
                        placeholder="e.g. 08087654321"
                        placeholderTextColor="#94a3b8"
                        maxLength={11}
                        keyboardType="phone-pad"
                        value={formData.dropoffRecipientPhone}
                        onChangeText={(val) => updateFormData({ dropoffRecipientPhone: val })}
                        onFocus={() => handleFieldFocus('dropoffRecipientPhone')}
                      />
                      {errors.dropoffRecipientPhone && (
                        <Text style={styles.fieldError}>{errors.dropoffRecipientPhone}</Text>
                      )}
                    </View>

                    <View
                      style={{ marginTop: 14 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['dropoffAddress'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>
                          Destination Address <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        {formData.dropoffLat != null && formData.dropoffLng != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                            <CheckCircle2 size={11} color="#16a34a" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>GPS Matched</Text>
                          </View>
                        )}
                      </View>

                      {/* Detect Exact Location Action Button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          backgroundColor: isDetectingDropoffGps ? '#fff7ed' : '#eff6ff',
                          borderWidth: 1.5,
                          borderColor: isDetectingDropoffGps ? colors.primary : '#93c5fd',
                          borderRadius: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          marginBottom: 8,
                        }}
                        onPress={handleDetectDropoffLocation}
                        disabled={isDetectingDropoffGps}
                        activeOpacity={0.75}
                      >
                        {isDetectingDropoffGps ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Navigation size={15} color="#2563eb" />
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDetectingDropoffGps ? colors.primary : '#1d4ed8' }}>
                          {isDetectingDropoffGps ? 'Detecting Drop-off Location...' : 'Tap to Detect Current Location (GPS)'}
                        </Text>
                      </TouchableOpacity>

                      {/* Manual Address Input Box */}
                      <View
                        style={[
                          styles.textInput,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 0,
                            height: 48,
                          },
                          Boolean(errors.dropoffAddress) && { borderColor: '#ef4444' },
                        ]}
                      >
                        <MapPin size={17} color={colors.primary} style={{ marginRight: 8 }} />
                        <TextInput
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: '#0f172a',
                            fontWeight: '600',
                            height: '100%',
                            paddingVertical: 0,
                          }}
                          placeholder="Type or edit destination address manually..."
                          placeholderTextColor="#94a3b8"
                          value={formData.dropoffAddress}
                          onChangeText={(val) => {
                            updateFormData({ dropoffAddress: val });
                            if (errors.dropoffAddress) {
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.dropoffAddress;
                                return next;
                              });
                            }
                          }}
                          onBlur={async () => {
                            if (formData.dropoffAddress.trim() && !formData.dropoffLat) {
                              try {
                                const geocoded = await Location.geocodeAsync(formData.dropoffAddress);
                                if (geocoded && geocoded.length > 0) {
                                  updateFormData({
                                    dropoffLat: geocoded[0].latitude,
                                    dropoffLng: geocoded[0].longitude,
                                  });
                                }
                              } catch {}
                            }
                          }}
                          onFocus={() => handleFieldFocus('dropoffAddress')}
                        />
                        {Boolean(formData.dropoffAddress.length > 0) && (
                          <TouchableOpacity
                            onPress={() => {
                              updateFormData({
                                dropoffAddress: '',
                                dropoffLat: null,
                                dropoffLng: null,
                              });
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ padding: 4 }}
                          >
                            <Text style={{ fontSize: 14, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {errors.dropoffAddress && <Text style={styles.fieldError}>{errors.dropoffAddress}</Text>}
                    </View>

                    <View
                      style={{ marginTop: 14 }}
                      onLayout={(e) => {
                        fieldYOffsets.current['dropoffDirections'] = e.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={styles.inputLabel}>Drop-off Instructions (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Leave with receptionist on 2nd floor"
                        placeholderTextColor="#94a3b8"
                        value={formData.dropoffDirections}
                        onChangeText={(val) => updateFormData({ dropoffDirections: val })}
                        onFocus={() => handleFieldFocus('dropoffDirections')}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleStep3Next}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryActionBtnText}>Review Route & Price</Text>
                  <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            )}

            {/* ================= STEP 4: ROUTE MAP & VEHICLE ================= */}
            {step === 4 && (
              <View style={styles.stepSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeading}>Route & Courier Vehicle</Text>
                  <Text style={styles.sectionSub}>Select the appropriate vehicle and review the delivery fee.</Text>
                </View>

                <RoutePreviewMap
                  pickupLat={formData.pickupLat}
                  pickupLng={formData.pickupLng}
                  dropoffLat={formData.dropoffLat}
                  dropoffLng={formData.dropoffLng}
                  distanceKm={pricing.distanceKm}
                />

                <View style={styles.cardContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>CHOOSE DELIVERY VEHICLE</Text>
                  </View>
                  <View style={styles.vehiclesList}>
                    {VEHICLES.map((v) => {
                      const IconComponent = v.icon;
                      const isSelected = selectedVehicle === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.vehicleOption, isSelected && styles.vehicleOptionActive]}
                          onPress={() => {
                            setSelectedVehicle(v.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.vehicleIconCircle, isSelected && styles.vehicleIconCircleActive]}>
                            <IconComponent size={22} color={isSelected ? '#ffffff' : '#475569'} strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.vehicleName, isSelected && { color: colors.primary }]}>
                              {v.label}
                            </Text>
                            <Text style={styles.vehicleDesc}>{v.desc}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
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
                    <TouchableOpacity
                      style={[styles.paymentMethodCard, paymentMethod === 'wallet' && styles.paymentMethodCardActive]}
                      onPress={() => {
                        setPaymentMethod('wallet');
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      <Wallet size={20} color={paymentMethod === 'wallet' ? colors.primary : '#64748b'} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentMethodTitle}>LinkUp Wallet</Text>
                        <Text style={styles.paymentMethodSub}>Instant one-tap payment from available balance</Text>
                      </View>
                      <View style={[styles.radioCircle, paymentMethod === 'wallet' && styles.radioCircleActive]}>
                        {paymentMethod === 'wallet' && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.paymentMethodCard, paymentMethod === 'paystack' && styles.paymentMethodCardActive]}
                      onPress={() => {
                        setPaymentMethod('paystack');
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.8}
                    >
                      <CreditCard size={20} color={paymentMethod === 'paystack' ? colors.primary : '#64748b'} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentMethodTitle}>Debit Card / Bank Transfer (Paystack)</Text>
                        <Text style={styles.paymentMethodSub}>Mastercard, Visa, Verve & USSD checkout</Text>
                      </View>
                      <View style={[styles.radioCircle, paymentMethod === 'paystack' && styles.radioCircleActive]}>
                        {paymentMethod === 'paystack' && <View style={styles.radioDot} />}
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
                  setIsBookingOpen(false);
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
      />

      {/* Paystack Payment WebView Modal */}
      <PaystackWebViewModal
        visible={paystackModalVisible}
        onCancel={() => setPaystackModalVisible(false)}
        onSuccess={handlePaystackSuccess}
        email={user?.email || 'customer@linkup.com'}
        amount={finalCalculatedFee}
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  // Modern Hub Container
  hubContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hubContentContainer: {
    paddingBottom: 40,
  },

  // 1. Top Curvy Banner
  topCurvyBanner: {
    backgroundColor: '#FA7E2B',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 48,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
  },
  backToHomeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarInitialText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  greetingWrap: {
    gap: 1,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    maxWidth: 200,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EA580C',
  },

  // Hero Current Delivery Card
  heroDeliveryCard: {
    backgroundColor: '#FA7E2B',
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderWidth: 0,
  },
  heroDeliveryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroDeliveryLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FA7E2B',
  },
  pulsingDotGreen: {
    backgroundColor: '#22C55E',
  },
  heroStatusText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  heroTrackingCode: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  heroActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  heroDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  heroDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
  },

  // Milestone Timeline
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepNodeBlack: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  dottedConnector: {
    flex: 1,
    height: 0,
    borderWidth: 1,
    borderColor: 'rgba(120, 53, 15, 0.55)',
    borderStyle: 'dashed',
    marginHorizontal: 3,
  },
  solidConnector: {
    borderStyle: 'solid',
    borderColor: '#0F172A',
    borderWidth: 1.5,
  },
  stepTruckBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  stepPendingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 8,
  },
  timelineLabelItem: {
    alignItems: 'center',
    width: 64,
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(120, 53, 15, 0.9)',
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Overlapping Search Bar
  searchBarWrapper: {
    marginTop: -25,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchPillInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // 2. Services Grid
  servicesSection: {
    paddingHorizontal: 20,
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceTile: {
    alignItems: 'center',
    gap: 6,
  },
  serviceTileActive: {
    transform: [{ scale: 1.02 }],
  },
  serviceIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  serviceIconBoxActive: {
    backgroundColor: '#FA7E2B',
    borderColor: '#FA7E2B',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  serviceLabelActive: {
    color: '#FA7E2B',
    fontWeight: '900',
  },

  // 3. Active Shipments Carousel
  shipmentsSection: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  shipmentsScroll: {
    paddingLeft: 20,
    paddingRight: 8,
    gap: 12,
  },
  shipmentCard: {
    width: 230,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 6,
  },
  shipmentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  flagPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flagText: {
    fontSize: 16,
  },
  shipmentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  shipmentStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  shipmentRouteText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  shipmentOrderSnippet: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyShipmentsCard: {
    marginHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyShipmentsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyShipmentsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyShipmentsSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  emptyShipmentsBtn: {
    backgroundColor: '#FA7E2B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  emptyShipmentsBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // 4. This Week Analytics
  analyticsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  analyticsCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  parcelsSentCard: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  onTimeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'space-between',
  },
  parcelsSentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  parcelsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(250, 126, 43, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  analyticsCardSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  parcelsStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  parcelsStatNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  growthBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  growthBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  miniBarChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 36,
    gap: 4,
    marginTop: 4,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  onTimeStatWrap: {
    marginVertical: 4,
  },
  onTimeNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  onTimeRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  escrowSafeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  escrowSafeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },

  // Floating CTA Button
  quickDispatchWrap: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickDispatchBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FA7E2B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  quickDispatchBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Booking Flow Header
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 60,
  },
  bookingCurvyBanner: {
    backgroundColor: '#FA7E2B',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
  },
  flowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowTitleWrap: {
    flex: 1,
  },
  flowTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  flowSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 1,
  },
  hubExitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  hubExitBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Step Section
  stepSection: {
    gap: 16,
    marginTop: 10,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafbfc',
  },
  cardTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.8,
  },
  cardPadding: {
    padding: 16,
  },

  // Package Sizes
  packageSizesGrid: {
    padding: 14,
    gap: 10,
  },
  packageSizeCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  packageSizeCardSelected: {
    backgroundColor: '#fff7ed',
    borderColor: colors.primary,
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
    paddingVertical: 3,
    borderRadius: 8,
  },
  packageSizeSubBadgeSelected: {
    backgroundColor: '#ffedd5',
  },
  packageSizeSubText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  packageSizeDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },

  // Weight & Inputs
  weightWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  weightLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  weightValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  fieldError: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 4,
  },

  // Fragile Toggle
  fragileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  fragileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  fragileSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // Trust Banner
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  trustBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
  },
  trustBannerText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1e3a8a',
    lineHeight: 14,
  },

  // Primary Action Button
  primaryActionBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  // Saved Addresses
  savedAddressesWrap: {
    gap: 6,
  },
  savedSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  savedAddressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  savedAddressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },

  // Vehicles List
  vehiclesList: {
    padding: 14,
    gap: 10,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  vehicleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  vehicleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehicleIconCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  vehicleName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  vehicleDesc: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },

  // Price Breakdown
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  priceVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },

  // Payment Options
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  paymentMethodCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
  },
  paymentMethodTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentMethodSub: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // Terms Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 16,
  },
});
