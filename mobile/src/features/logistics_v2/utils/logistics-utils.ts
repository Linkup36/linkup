import { Linking, Platform } from 'react-native';

/**
 * Shared utility functions for Logistics v2 features (Mobile)
 */

/**
 * Safely extracts a display string from various address formats (string, JSONB object)
 */
export const ensureAddressString = (val: any): string | null => {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof val === 'object') {
    const addr = val.address || val.display_address || val.full_address || val.name;
    if (typeof addr === 'string') {
      const trimmed = addr.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
};

export const getPickupAddress = (shipment: any): string => {
  if (!shipment) return 'Pickup Point';

  const directPickup = ensureAddressString(
    shipment.pickup_address ||
    shipment.pickup_address_text ||
    shipment.origin_address
  );
  if (directPickup) return directPickup;

  const seller = Array.isArray(shipment.seller)
    ? shipment.seller[0]
    : (shipment.seller || shipment.order?.seller);
  const sellerAddr = ensureAddressString(seller?.address);
  if (sellerAddr) return sellerAddr;

  const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
  const orderPickup = ensureAddressString(order?.pickup_address || order?.pickup_address_text);
  if (orderPickup) return orderPickup;

  return 'Pickup Point';
};

export const getDeliveryAddress = (shipment: any): string => {
  if (!shipment) return 'Drop-off Node';

  const directDropoff = ensureAddressString(
    shipment.dropoff_address ||
    shipment.delivery_address ||
    shipment.delivery_address_text ||
    shipment.destination_address
  );
  if (directDropoff) return directDropoff;

  const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
  const recipient = order?.order_recipient?.[0] || order?.order_recipient;
  const recipientAddr = ensureAddressString(recipient?.address_line || recipient?.address);
  if (recipientAddr) return recipientAddr;

  const orderDropoff = ensureAddressString(
    order?.dropoff_address ||
    order?.delivery_address ||
    order?.delivery_address_text ||
    order?.shipping_address
  );
  if (orderDropoff) return orderDropoff;

  const buyer = order?.buyer || (order?.profiles && !Array.isArray(order.profiles) ? order.profiles : null) || shipment.buyer;
  const buyerAddr = ensureAddressString(buyer?.address);
  if (buyerAddr) return buyerAddr;

  return 'Drop-off Node';
};

export const getBuyerContact = (shipment: any): { name: string; phone: string } => {
  if (!shipment) return { name: 'Customer', phone: 'No phone' };

  if (shipment.is_send_order || shipment.dropoff_recipient_name || shipment.recipient_name) {
    return {
      name: shipment.dropoff_recipient_name || shipment.recipient_name || shipment.buyer?.name || 'Customer',
      phone: shipment.dropoff_recipient_phone || shipment.recipient_phone || shipment.buyer?.phone || 'No phone',
    };
  }

  const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
  const recipient = order?.order_recipient?.[0] || order?.order_recipient || {};
  const buyerProfile = order?.buyer || (order?.profiles && !Array.isArray(order.profiles) ? order.profiles : null) || shipment.buyer || {};

  return {
    name: recipient.full_name ||
          ensureAddressString(buyerProfile.full_name) ||
          ensureAddressString(buyerProfile.display_name) ||
          'Customer',
    phone: recipient.phone || buyerProfile.phone || 'No phone',
  };
};

export const getSellerInfo = (shipment: any): { name: string; phone: string } => {
  if (!shipment) return { name: 'Seller', phone: 'No phone' };

  if (shipment.is_send_order || shipment.sender_name) {
    return {
      name: shipment.sender_name || shipment.seller?.name || 'Sender',
      phone: shipment.sender_phone || shipment.seller?.phone || 'No phone',
    };
  }

  const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : shipment.seller;
  const orderSeller = shipment.order?.seller;
  const activeSeller = seller || orderSeller;

  return {
    name: activeSeller?.display_name || activeSeller?.business_name || 'Seller',
    phone: activeSeller?.phone || 'No phone',
  };
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const generateMapsUrl = (shipment: any, mode: 'pickup' | 'delivery' = 'delivery'): string => {
  if (!shipment) return '';
  let lat: number | undefined;
  let lng: number | undefined;
  let address: string | undefined;

  if (mode === 'pickup') {
    const seller = Array.isArray(shipment.seller) ? shipment.seller[0] : (shipment.seller || shipment.order?.seller);
    lat = shipment.pickup_lat || seller?.latitude || seller?.lat;
    lng = shipment.pickup_lng || seller?.longitude || seller?.lng;
    address = getPickupAddress(shipment);
  } else {
    const order = Array.isArray(shipment.order) ? shipment.order[0] : shipment.order;
    const recipient = order?.order_recipient?.[0] || order?.order_recipient;
    const buyer = order?.buyer || shipment.buyer;

    lat = shipment.delivery_lat || shipment.dropoff_lat || recipient?.lat || recipient?.latitude || buyer?.latitude || buyer?.lat;
    lng = shipment.delivery_lng || shipment.dropoff_lng || recipient?.lng || recipient?.longitude || buyer?.longitude || buyer?.lng;
    address = getDeliveryAddress(shipment);
  }

  if (lat && lng) {
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?daddr=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  if (address && address !== 'Pickup Point' && address !== 'Drop-off Node') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  return '';
};

export const openNavigationApp = async (shipment: any, mode: 'pickup' | 'delivery' = 'delivery') => {
  const url = generateMapsUrl(shipment, mode);
  if (!url) return false;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
  } catch (err) {
    console.warn('[openNavigationApp] Failed to open URL:', err);
  }
  return false;
};

export const callPhoneNumber = async (phoneNumber?: string) => {
  if (!phoneNumber) return false;
  const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
  if (!cleanPhone) return false;
  const url = `tel:${cleanPhone}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('[callPhoneNumber] Failed to call:', err);
    return false;
  }
};

/**
 * Computes rider's earnings cut strictly adhering to platform rules and fee_config
 */
export const calculateRiderEarnings = (
  shipment: any,
  feeConfig?: { payoutRate?: number; minPayout?: number }
): number => {
  if (!shipment) return 0;

  const payoutRate = feeConfig?.payoutRate ?? 0.80; // default 80%
  const minPayout = feeConfig?.minPayout ?? 0;       // default ₦0 (no deficit floor)

  const isSendOrder =
    shipment.is_send_order ||
    String(shipment.id || '').startsWith('LSEND') ||
    String(shipment.order_id || '').startsWith('LSEND');

  // 1. Explicit rider_earnings (ensure legacy floor does not exceed delivery_fee)
  if (typeof shipment.rider_earnings === 'number' && shipment.rider_earnings > 0) {
    const totalFee = Number(shipment.delivery_fee || 0);
    if (totalFee > 0 && shipment.rider_earnings > totalFee) {
      return Math.round(totalFee * payoutRate);
    }
    return Math.round(shipment.rider_earnings);
  }

  // 2. SEND package order
  if (isSendOrder) {
    let pkg = shipment.package_details;
    if (typeof pkg === 'string') {
      try { pkg = JSON.parse(pkg); } catch { pkg = {}; }
    }
    const breakdownEarnings = pkg?.pricing_breakdown?.riderEarnings ?? pkg?.pricing_breakdown?.rider_earnings;
    if (typeof breakdownEarnings === 'number' && breakdownEarnings > 0) {
      return Math.round(breakdownEarnings);
    }

    const totalFee = Number(shipment.delivery_fee || 0);
    const commissionCut = Math.round(totalFee * payoutRate);
    if (minPayout > 0) {
      return Math.min(totalFee, Math.max(minPayout, commissionCut));
    }
    return commissionCut;
  }

  // 3. Marketplace shipments rider_fee_breakdown
  if (shipment.rider_fee_breakdown) {
    let breakdown = shipment.rider_fee_breakdown;
    if (typeof breakdown === 'string') {
      try { breakdown = JSON.parse(breakdown); } catch { breakdown = {}; }
    }
    if (typeof breakdown.total === 'number' && breakdown.total > 0) {
      return Math.round(breakdown.total);
    }
  }

  const deliveryFee = Number(shipment.delivery_fee || shipment.order?.shipping_fee || 0);
  return Math.round(deliveryFee);
};
