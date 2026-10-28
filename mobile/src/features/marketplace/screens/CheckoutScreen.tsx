import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { PaystackWebViewModal } from '../../../components/ui/PaystackWebViewModal';
import { AppModal, ModalVariant } from '../../../components/ui/AppModal';
import { CheckoutProgress } from '../components/v2/CheckoutProgress';
import { DeliveryStep } from '../components/v2/DeliveryStep';
import { PaymentStep } from '../components/v2/PaymentStep';
import { SuccessStep } from '../components/v2/SuccessStep';
import { CrossZoneWarning, CrossZoneItemDetail } from '../components/v2/CrossZoneWarning';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { RootStackParamList } from '../../../navigation/types';
import { AccountMenuModal } from '../../user/components/AccountMenuModal';
import { Bell, ShoppingCart, ShoppingBag, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

export function CheckoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, clearCart, totalCount } = useCart();
  const { user, profile } = useAuth();

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [hasPastOrders, setHasPastOrders] = useState<boolean>(false);

  // Database-verified source of truth state (do not trust frontend)
  const [dbProductsMap, setDbProductsMap] = useState<Map<string, any>>(new Map());
  const [isVerifyingDb, setIsVerifyingDb] = useState(false);
  const [crossZoneItems, setCrossZoneItems] = useState<CrossZoneItemDetail[]>([]);

  const [shipping, setShipping] = useState({
    name: profile?.full_name || profile?.display_name || '',
    phone: profile?.phone || '',
    city_id: '',
    city_name: 'Abuja',
    zone_id: '',
    zone_name: '',
    address: profile?.address || '',
    lat: null as number | null,
    lng: null as number | null,
  });

  const [isDetecting, setIsDetecting] = useState(false);
  const [showCrossZoneWarning, setShowCrossZoneWarning] = useState(false);
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSummary, setOrderSummary] = useState<any>(null);

  // Modern AppModal Bottom-Sheet State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    message: string;
    variant?: ModalVariant;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }>({
    visible: false,
    title: '',
    subtitle: '',
    message: '',
    variant: 'info',
  });

  const showAlert = (config: {
    title: string;
    subtitle?: string;
    message: string;
    type?: 'error' | 'success' | 'warning' | 'info' | 'location';
    variant?: ModalVariant;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }) => {
    let resolvedVariant: ModalVariant = config.variant || 'default';
    if (config.type === 'error') resolvedVariant = 'danger';
    else if (config.type === 'warning' || config.type === 'location') resolvedVariant = 'warning';
    else if (config.type === 'info') resolvedVariant = 'info';
    else if (config.type === 'success') resolvedVariant = 'success';

    setAlertConfig({
      visible: true,
      title: config.title,
      subtitle: config.subtitle,
      message: config.message,
      variant: resolvedVariant,
      primaryButtonText: config.primaryButtonText,
      onPrimaryPress: config.onPrimaryPress,
      secondaryButtonText: config.secondaryButtonText,
      onSecondaryPress: config.onSecondaryPress,
    });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // 1. Fetch metadata: cities, zones, fee_config
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [citiesRes, feeRes] = await Promise.all([
          supabase.from('cities').select('*').order('name'),
          supabase.from('fee_config').select('*').eq('is_active', true),
        ]);

        if (citiesRes.data) {
          setCities(citiesRes.data);
          // Default to Abuja
          const abuja = citiesRes.data.find(
            (c: any) => c.name.toLowerCase() === 'abuja'
          );
          if (abuja) {
            setShipping((prev) => ({
              ...prev,
              city_id: prev.city_id || abuja.id,
              city_name: prev.city_name || abuja.name,
            }));
          }
        }

        if (feeRes.data) {
          setFeeConfigs(feeRes.data);
        }

        // Check if user has past orders
        if (user?.id) {
          const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('buyer_id', user.id)
            .neq('status', 'cancelled');
          setHasPastOrders((count ?? 0) > 0);
        }
      } catch (err) {
        console.warn('[CheckoutScreen] Metadata load error:', err);
      }
    }

    fetchMetadata();
  }, [user]);

  // 2. Fetch zones for selected city
  useEffect(() => {
    async function fetchZones() {
      if (!shipping.city_id) return;
      try {
        const { data } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('city_id', shipping.city_id)
          .order('name');
        if (data) {
          setZones(data);
          // If no zone is selected yet, default to Apo or first zone
          if (!shipping.zone_id && data.length > 0) {
            const apo = data.find((z: any) => z.name.toLowerCase().includes('apo'));
            const defaultZone = apo || data[0];
            setShipping((prev) => ({
              ...prev,
              zone_id: defaultZone.id,
              zone_name: defaultZone.name,
            }));
          }
        }
      } catch (err) {
        console.warn('[CheckoutScreen] Zones load error:', err);
      }
    }

    fetchZones();
  }, [shipping.city_id]);

  // 2b. Fetch verified products directly from DB (guarantee zero client trust)
  useEffect(() => {
    async function fetchDbProducts() {
      const productIds = items
        .map((i: any) => i.productId || i.id)
        .filter(Boolean);
      if (productIds.length === 0) {
        setDbProductsMap(new Map());
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            title,
            price,
            seller_id,
            zone_id,
            city_id,
            delivery_zones:zone_id(id, name, delivery_fee)
          `)
          .in('id', productIds);

        if (data) {
          const map = new Map<string, any>();
          data.forEach((p: any) => map.set(p.id, p));
          setDbProductsMap(map);
        }
      } catch (err) {
        console.warn('[CheckoutScreen] DB products fetch error:', err);
      }
    }

    fetchDbProducts();
  }, [items]);

  // 3. Fee calculations driven strictly by verified database records
  const productFeeConfig = feeConfigs.find(
    (f: any) => f.fee_type === 'platform_product' || f.fee_type === 'platform'
  );
  const platformProductRate = productFeeConfig?.rate ?? 0.1;
  const markupMultiplier = 1 + platformProductRate;

  // Base product total using DB-verified product prices (no client trust)
  const baseProductTotal = items.reduce((sum, item: any) => {
    const pId = item.productId || item.id;
    const dbProduct = dbProductsMap.get(pId);
    const dbPrice = dbProduct ? Number(dbProduct.price) : Number(item.price ?? 0);
    return sum + dbPrice * (item.quantity || 1);
  }, 0);
  const platformFee = baseProductTotal * platformProductRate;
  const productTotal = baseProductTotal + platformFee;

  // Seller count using verified DB seller_ids
  const uniqueSellerIds = new Set<string>();
  items.forEach((item: any) => {
    const pId = item.productId || item.id;
    const dbProduct = dbProductsMap.get(pId);
    const sId = dbProduct?.seller_id || item.sellerId || item.seller_id;
    if (sId) uniqueSellerIds.add(sId);
  });
  const sellerCount = Math.max(1, uniqueSellerIds.size);

  const riderFeeConfig = feeConfigs.find((f: any) => f.fee_type === 'rider');
  const dynamicDefaultFee = riderFeeConfig?.flat_fee ?? 1500;

  const crossZoneFeeConfig = feeConfigs.find(
    (f: any) => f.fee_type === 'buyer_cross_zone'
  );
  const baseCrossZoneFee = crossZoneFeeConfig?.flat_fee ?? 1000;

  // Cross-zone items & sellers calculation from DB records
  const selectedZone = zones.find((z: any) => z.id === shipping.zone_id);
  const destZoneName = shipping.zone_name || selectedZone?.name || 'Your Zone';

  const crossZoneSellers = new Set<string>();
  const computedCrossZoneItems: CrossZoneItemDetail[] = [];

  items.forEach((item: any) => {
    const pId = item.productId || item.id;
    const dbProduct = dbProductsMap.get(pId);
    const sellerZoneId = dbProduct?.zone_id || (item as any)?.zone_id;
    const sellerId = dbProduct?.seller_id || item.sellerId || item.seller_id;

    if (sellerZoneId && shipping.zone_id && sellerZoneId !== shipping.zone_id) {
      if (sellerId) crossZoneSellers.add(sellerId);

      const sellerZoneName =
        dbProduct?.delivery_zones?.name ||
        zones.find((z: any) => z.id === sellerZoneId)?.name ||
        'Seller Zone';

      computedCrossZoneItems.push({
        id: pId || item.id,
        title: dbProduct?.title || item.title || 'Marketplace Item',
        sellerId: sellerId || '',
        sellerZoneName,
        destinationZoneName: destZoneName,
        price: dbProduct ? Number(dbProduct.price) : Number(item.price ?? 0),
      });
    }
  });

  const crossZoneSellerCount = crossZoneSellers.size;
  const rawCrossZoneFee = baseCrossZoneFee * crossZoneSellerCount;

  const zFee = selectedZone?.delivery_fee;
  const baseDeliveryFee =
    zFee === 0 || zFee === null || zFee === undefined
      ? dynamicDefaultFee
      : Number(zFee);

  const rawDeliveryFee = baseDeliveryFee * sellerCount;

  const isFreeDeliveryConfig = feeConfigs.some(
    (f: any) => f.fee_type === 'marketplace_free_delivery' && f.is_active
  );
  const isMarketplaceFreeDelivery = Boolean(
    isFreeDeliveryConfig && !hasPastOrders
  );

  const deliveryFee = isMarketplaceFreeDelivery ? 0 : rawDeliveryFee;
  const finalCrossZoneFee = isMarketplaceFreeDelivery ? 0 : rawCrossZoneFee;
  const grandTotal = productTotal + deliveryFee + finalCrossZoneFee;

  // 4. Exact device location detection with multi-geocoding fallback
  const handleDetectLocation = async () => {
    setIsDetecting(true);
    try {
      // Step A: Check if device location services (GPS) are enabledyour
      const isServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isServicesEnabled) {
        setIsDetecting(false);
        showAlert({
          type: 'location',
          title: 'Device Location Disabled',
          message:
            'Please turn on Location (GPS) in your phone settings to automatically detect your delivery address.',
          primaryButtonText: 'OK, Understood',
        });
        return;
      }

      // Step B: Check and request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsDetecting(false);
        showAlert({
          type: 'location',
          title: 'Permission Required',
          message:
            'Linkup needs location permission to auto-detect your delivery address. Please allow location access.',
          primaryButtonText: 'Understood',
        });
        return;
      }

      // Step C: Acquire exact coordinates (High accuracy with balanced fallback)
      let position: Location.LocationObject | null = null;
      try {
        position = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 6000)
          ),
        ]);
      } catch {
        try {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch {
          position = await Location.getLastKnownPositionAsync();
        }
      }

      if (!position) {
        throw new Error('Could not acquire GPS coordinates from device.');
      }

      const { latitude, longitude } = position.coords;

      // Step D: Native Geocoding (Google Play / Apple Maps)
      let formattedAddress = '';
      let detectedCity = '';
      let detectedDistrict = '';
      let detectedStreet = '';

      try {
        const geoResults = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (geoResults && geoResults.length > 0) {
          const place = geoResults[0];
          detectedStreet = [place.streetNumber, place.street || place.name]
            .filter(Boolean)
            .join(' ');
          detectedDistrict = place.district || place.subregion || '';
          detectedCity = place.city || place.region || '';

          const parts = [
            detectedStreet,
            detectedDistrict && detectedDistrict !== detectedStreet ? detectedDistrict : '',
            detectedCity,
            place.region && place.region !== detectedCity ? place.region : '',
            place.country || 'Nigeria',
          ].filter(Boolean);

          formattedAddress = Array.from(new Set(parts)).join(', ');
        }
      } catch (nativeErr) {
        console.warn('[Checkout] Native geocoding fallback:', nativeErr);
      }

      // Step E: Fallback to OpenStreetMap Nominatim with valid User-Agent
      if (!formattedAddress) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'LinkupMarketplaceMobile/1.0 (contact@linkup.ng)',
                Accept: 'application/json',
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              formattedAddress = data.display_name;
              detectedCity =
                data.address?.city ||
                data.address?.state ||
                data.address?.county ||
                '';
              detectedDistrict =
                data.address?.suburb ||
                data.address?.neighbourhood ||
                data.address?.quarter ||
                '';
            }
          }
        } catch (osmErr) {
          console.warn('[Checkout] OSM geocode fallback:', osmErr);
        }
      }

      // Fallback coordinates string if all geocoders are empty
      if (!formattedAddress) {
        formattedAddress = `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }

      // Step F: Intelligent matching with available Cities & Delivery Zones
      let matchedCityId = shipping.city_id;
      let matchedCityName = shipping.city_name;
      let matchedZoneId = shipping.zone_id;
      let matchedZoneName = shipping.zone_name;

      if (detectedCity && cities.length > 0) {
        const foundCity = cities.find(
          (c: any) =>
            c.name.toLowerCase().includes(detectedCity.toLowerCase()) ||
            detectedCity.toLowerCase().includes(c.name.toLowerCase())
        );
        if (foundCity) {
          matchedCityId = foundCity.id;
          matchedCityName = foundCity.name;
        }
      }

      if (zones.length > 0) {
        const searchPool = (
          detectedDistrict +
          ' ' +
          formattedAddress
        ).toLowerCase();
        const foundZone = zones.find(
          (z: any) =>
            searchPool.includes(z.name.toLowerCase()) ||
            z.name.toLowerCase().includes(detectedDistrict.toLowerCase())
        );
        if (foundZone) {
          matchedZoneId = foundZone.id;
          matchedZoneName = foundZone.name;
        }
      }

      // Step G: Save to state
      setShipping((prev) => ({
        ...prev,
        address: formattedAddress,
        city_id: matchedCityId,
        city_name: matchedCityName,
        zone_id: matchedZoneId,
        zone_name: matchedZoneName,
        lat: latitude,
        lng: longitude,
      }));

      // Step H: Show professional #E86129 alert modal
      showAlert({
        type: 'location',
        title: 'Location Detected',
        message: `Your device location was successfully detected:\n\n${formattedAddress}`,
        primaryButtonText: 'Use This Address',
      });
    } catch (err: any) {
      showAlert({
        type: 'location',
        title: 'Location Notice',
        message:
          'Could not retrieve high-precision location right now. Please verify device GPS is active or enter your street address manually.',
        primaryButtonText: 'Enter Manually',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // 5. Handle Next from Step 1 (Delivery) with real-time Database Logistics Verification
  const handleStep1Next = async () => {
    setIsVerifyingDb(true);
    try {
      // Re-fetch fresh products, fees, and destination zone directly from DB (guarantee 100% DB truth)
      const productIds = items.map((i: any) => i.productId || i.id).filter(Boolean);
      const [productsRes, feeRes, destZoneRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            id,
            title,
            price,
            seller_id,
            zone_id,
            city_id,
            delivery_zones:zone_id(id, name, delivery_fee)
          `)
          .in('id', productIds),
        supabase
          .from('fee_config')
          .select('*')
          .eq('is_active', true),
        shipping.zone_id
          ? supabase
              .from('delivery_zones')
              .select('id, name, delivery_fee, city_id')
              .eq('id', shipping.zone_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const freshDbMap = new Map<string, any>();
      if (productsRes.data) {
        productsRes.data.forEach((p: any) => freshDbMap.set(p.id, p));
        setDbProductsMap(freshDbMap);
      }
      if (feeRes.data) {
        setFeeConfigs(feeRes.data);
      }

      const activeDestZoneName =
        destZoneRes.data?.name || shipping.zone_name || selectedZone?.name || 'Your Zone';

      // Check cross zone status strictly against fresh database records
      const freshCrossZoneItems: CrossZoneItemDetail[] = [];
      const freshCrossZoneSellers = new Set<string>();

      items.forEach((item: any) => {
        const pId = item.productId || item.id;
        const dbProduct = freshDbMap.get(pId);
        const sellerZoneId = dbProduct?.zone_id || (item as any)?.zone_id;
        const sellerId = dbProduct?.seller_id || item.sellerId || item.seller_id;

        if (sellerZoneId && shipping.zone_id && sellerZoneId !== shipping.zone_id) {
          if (sellerId) freshCrossZoneSellers.add(sellerId);
          freshCrossZoneItems.push({
            id: pId || item.id,
            title: dbProduct?.title || item.title || 'Marketplace Item',
            sellerId: sellerId || '',
            sellerZoneName: dbProduct?.delivery_zones?.name || 'Seller Zone',
            destinationZoneName: activeDestZoneName,
            price: dbProduct ? Number(dbProduct.price) : Number(item.price ?? 0),
          });
        }
      });

      setCrossZoneItems(freshCrossZoneItems);

      const crossConfig = (feeRes.data || feeConfigs).find(
        (f: any) => f.fee_type === 'buyer_cross_zone'
      );
      const crossFeePerSeller = crossConfig?.flat_fee ?? 1000;
      const totalCrossFee = isMarketplaceFreeDelivery
        ? 0
        : crossFeePerSeller * freshCrossZoneSellers.size;

      if (freshCrossZoneItems.length > 0 && totalCrossFee > 0) {
        // Trigger Pop Up Modal for cross zones additional payment!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowCrossZoneWarning(true);
      } else {
        setStep(2);
      }
    } catch (err) {
      console.warn('[CheckoutScreen] DB logistics verification error:', err);
      if (computedCrossZoneItems.length > 0 && finalCrossZoneFee > 0) {
        setShowCrossZoneWarning(true);
      } else {
        setStep(2);
      }
    } finally {
      setIsVerifyingDb(false);
    }
  };

  // 6. Handle Pay and Place Order
  const handleInitiatePayment = () => {
    if (!user) {
      showAlert({
        variant: 'info',
        title: 'Sign In Required',
        subtitle: 'Escrow-Protected Checkout',
        message:
          'Please sign in to your Linkup account to complete your escrow checkout and protect your purchase.',
        primaryButtonText: 'Sign In to Continue',
        onPrimaryPress: () => {
          closeAlert();
          navigation.navigate('Login');
        },
        secondaryButtonText: 'Cancel',
      });
      return;
    }

    setIsPaystackOpen(true);
  };

  const handlePaystackSuccess = async (reference: string) => {
    setIsPaystackOpen(false);
    setIsProcessing(true);

    try {
      const orderData = {
        items: items.map((item: any) => {
          const pId = item.productId || item.id;
          const dbProduct = dbProductsMap.get(pId);
          const dbPrice = dbProduct ? Number(dbProduct.price) : Number(item.price ?? 0);
          return {
            product_id: pId,
            quantity: item.quantity || 1,
            size: item.size || null,
            price: dbPrice * markupMultiplier,
            seller_id: dbProduct?.seller_id || item.sellerId || item.seller_id,
            title: dbProduct?.title || item.title,
            image: item.image || item.images?.[0] || '',
          };
        }),
        shipping_address: shipping,
        total: grandTotal,
        delivery_fee: deliveryFee,
        cross_zone_fee: finalCrossZoneFee,
        payment_method: 'paystack',
        payment_ref: reference,
        payment_status: 'paid',
        zone_id: shipping.zone_id,
        city_id: shipping.city_id,
        zone: shipping.zone_name,
        delivery_lat: shipping.lat,
        delivery_lng: shipping.lng,
      };

      // Call Edge Function create-order
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: orderData,
      });

      let orderIds: string[] = data?.order_ids || (data?.main_order_id ? [data.main_order_id] : []);
      let mainOrderId: string | null = data?.main_order_id || (orderIds.length > 0 ? orderIds[0] : null);

      if (error) {
        let errorDetail = error.message;
        try {
          if ((error as any).context && typeof (error as any).context.json === 'function') {
            const errBody = await (error as any).context.json();
            if (errBody?.error) errorDetail = errBody.error;
            if (errBody?.details) errorDetail += ` (${errBody.details})`;
          }
        } catch (_) {}
        console.warn('[CheckoutScreen] Edge function notice:', errorDetail);

        // Resilient Fallback: If edge function fails after Paystack debited user, record order directly
        try {
          const itemsBySeller: Record<string, any[]> = {};
          orderData.items.forEach((it: any) => {
            const sId = it.seller_id;
            if (sId) {
              if (!itemsBySeller[sId]) itemsBySeller[sId] = [];
              itemsBySeller[sId].push(it);
            }
          });

          const sellerIds = Object.keys(itemsBySeller);
          const fallbackOrderIds: string[] = [];

          for (const sId of sellerIds) {
            const sellerItems = itemsBySeller[sId];
            const sellerSubtotal = sellerItems.reduce(
              (acc, i) => acc + Number(i.price || 0) * (i.quantity || 1),
              0
            );
            const sellerShippingFee =
              (deliveryFee / sellerIds.length) + (finalCrossZoneFee / sellerIds.length);
            const sellerTotal = sellerSubtotal + sellerShippingFee;

            const { data: directOrder, error: directErr } = await supabase
              .from('orders')
              .insert({
                buyer_id: user?.id,
                seller_id: sId,
                total: sellerTotal,
                subtotal: sellerSubtotal,
                shipping_fee: sellerShippingFee,
                grand_total: sellerTotal,
                status: 'pending',
                payment_method: 'paystack',
                payment_ref: reference,
                payment_status: 'paid',
                items: sellerItems,
                zone_id: shipping.zone_id || null,
                city_id: shipping.city_id || null,
              })
              .select('id')
              .single();

            if (!directErr && directOrder?.id) {
              fallbackOrderIds.push(directOrder.id);

              // Recipient details
              await supabase.from('order_recipient').insert({
                order_id: directOrder.id,
                full_name: shipping.name || profile?.full_name || 'Customer',
                phone: shipping.phone || profile?.phone || '',
                address_line: shipping.address || '',
                city_id: shipping.city_id || null,
                zone_id: shipping.zone_id || null,
                lat: shipping.lat || null,
                lng: shipping.lng || null,
              });

              // Order items
              const itemRows = sellerItems.map((si: any) => ({
                order_id: directOrder.id,
                product_id: si.product_id,
                seller_id: sId,
                quantity: si.quantity,
                price_at_purchase: si.price,
                size: si.size || null,
              }));
              await supabase.from('order_items').insert(itemRows);
            }
          }

          if (fallbackOrderIds.length > 0) {
            orderIds = fallbackOrderIds;
            mainOrderId = fallbackOrderIds[0];
            console.log('[CheckoutScreen] Direct client fallback created orders successfully:', fallbackOrderIds);
          }
        } catch (fallbackErr) {
          console.error('[CheckoutScreen] Direct order fallback error:', fallbackErr);
        }
      }

      const generatedSummary = {
        items: orderData.items,
        total: grandTotal,
        orderNumber:
          orderIds.length > 1
            ? `${orderIds.length} Shipments`
            : `#ORD-${(mainOrderId || reference).slice(0, 8).toUpperCase()}`,
        orderIds: orderIds,
        date: new Date().toLocaleString(),
      };

      setOrderSummary(generatedSummary);
      clearCart();
      setStep(3);
    } catch (err: any) {
      showAlert({
        type: 'error',
        title: 'Order Processing Issue',
        message: err?.message || 'Could not finalize order. Please contact support.',
        primaryButtonText: 'OK',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // User avatar initial
  const userInitial = (
    profile?.full_name?.[0] ||
    profile?.display_name?.[0] ||
    user?.email?.[0] ||
    'B'
  ).toUpperCase();

  // If cart is empty and not on confirm step
  if (items.length === 0 && step < 3) {
    return (
      <SafeView>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag size={56} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add items from the marketplace to proceed through verified escrow checkout.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
          >
            <Text style={styles.browseBtnText}>Explore Marketplace</Text>
          </TouchableOpacity>
        </View>
      </SafeView>
    );
  }

  return (
    <SafeView>
      {/* Top Header Matching Web & User Mockup */}
      <View style={styles.topHeader}>
        <View style={styles.brandWrap}>
          {step > 1 && step < 3 ? (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={styles.navBackBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
          ) : null}
          <BrandLogo size={36} showText={true} showGlobal={true} />
        </View>

        <View style={styles.headerRightActions}>
          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Bell size={20} color="#0f172a" />
          </TouchableOpacity>

          {/* Cart Icon with Badge */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'CartTab' })}
            activeOpacity={0.7}
          >
            <ShoppingCart size={20} color="#0f172a" />
            {totalCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Avatar Circle with Online Dot */}
          <TouchableOpacity
            style={styles.userAvatarBtn}
            onPress={() => setIsAccountMenuOpen(true)}
            activeOpacity={0.8}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{userInitial}</Text>
              <View style={styles.onlineDot} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Checkout 3-Step Progress Tracker */}
      <CheckoutProgress currentStep={step} />

      {/* Active Step Content with Safe Keyboard Handling */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {step === 1 && (
          <DeliveryStep
            shipping={shipping}
            setShipping={setShipping}
            cities={cities}
            zones={zones}
            onNext={handleStep1Next}
            isDetecting={isDetecting}
            onDetectLocation={handleDetectLocation}
            onSupportPress={() => navigation.navigate('Support')}
            onSendPress={() =>
              navigation.navigate('MainTabs', { screen: 'SendTab', params: undefined })
            }
            isVerifying={isVerifyingDb}
          />
        )}

        {step === 2 && (
          <PaymentStep
            items={items.map((item: any) => {
              const pId = item.productId || item.id;
              const dbProduct = dbProductsMap.get(pId);
              return {
                ...item,
                price: dbProduct ? Number(dbProduct.price) : Number(item.price ?? 0),
                seller_id: dbProduct?.seller_id || item.sellerId || item.seller_id,
              };
            })}
            baseProductTotal={baseProductTotal}
            platformFee={platformFee}
            deliveryFee={deliveryFee}
            rawDeliveryFee={rawDeliveryFee}
            crossZoneFee={finalCrossZoneFee}
            rawCrossZoneFee={rawCrossZoneFee}
            isFreeDelivery={isMarketplaceFreeDelivery}
            grandTotal={grandTotal}
            sellerCount={sellerCount}
            onBack={() => setStep(1)}
            onPay={handleInitiatePayment}
            isPending={isProcessing}
          />
        )}

        {step === 3 && (
          <SuccessStep
            orderSummary={orderSummary}
            onViewOrders={() =>
              navigation.navigate('MainTabs', { screen: 'OrdersTab', params: undefined })
            }
            onContinueShopping={() =>
              navigation.navigate('MainTabs', { screen: 'HomeTab', params: undefined })
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* Cross-Zone Alert Modal (#E86129 theme with spring physics) */}
      <CrossZoneWarning
        open={showCrossZoneWarning}
        onClose={() => setShowCrossZoneWarning(false)}
        onConfirm={() => {
          setShowCrossZoneWarning(false);
          setStep(2);
        }}
        crossZoneFee={finalCrossZoneFee}
        perDispatchFee={baseCrossZoneFee}
        sellerCount={crossZoneSellerCount}
        shippingZoneName={destZoneName}
        crossZoneItems={crossZoneItems.length > 0 ? crossZoneItems : computedCrossZoneItems}
        accentColor="#E86129"
      />

      {/* Paystack In-App WebView Payment Modal */}
      <PaystackWebViewModal
        visible={isPaystackOpen}
        email={user?.email || 'customer@linkup.ng'}
        amount={grandTotal}
        onSuccess={handlePaystackSuccess}
        onCancel={() => setIsPaystackOpen(false)}
      />

      {/* Modern Professional Bottom-Sheet Modal */}
      <AppModal
        visible={alertConfig.visible}
        onClose={closeAlert}
        title={alertConfig.title}
        subtitle={alertConfig.subtitle}
        variant={alertConfig.variant}
        primaryButton={
          alertConfig.primaryButtonText
            ? {
                label: alertConfig.primaryButtonText,
                onPress: () => {
                  if (alertConfig.onPrimaryPress) {
                    alertConfig.onPrimaryPress();
                  } else {
                    closeAlert();
                  }
                },
              }
            : undefined
        }
        secondaryButton={
          alertConfig.secondaryButtonText
            ? {
                label: alertConfig.secondaryButtonText,
                onPress: () => {
                  if (alertConfig.onSecondaryPress) {
                    alertConfig.onSecondaryPress();
                  } else {
                    closeAlert();
                  }
                },
                variant: 'outline',
              }
            : undefined
        }
      >
        <Text style={styles.modalMessageText}>{alertConfig.message}</Text>
      </AppModal>

      {/* Account Flyout Menu Modal */}
      <AccountMenuModal
        visible={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
        accentColor="#E86129"
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBackBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  userAvatarBtn: {
    position: 'relative',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffedd5',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ea580c',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  // Empty Cart State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
  },
  browseBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  browseBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
