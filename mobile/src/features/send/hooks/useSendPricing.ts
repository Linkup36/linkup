import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { useRoadRoute, calculateHaversineDistance } from './useRoadRoute';
import { useAuth } from '../../../context/AuthContext';

export interface PricingInput {
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  weightKg: number;
  isFragile?: boolean;
}

export interface SendFeeBreakdown {
  baseFee: number;
  perKmRate: number;
  distanceKm: number;
  distanceFee: number;
  packageSurcharge: number;
  serviceFee: number;
  fragileSurcharge: number;
  rawTotalFee: number;
  totalFee: number;
  isFreeDelivery: boolean;
  riderEarnings?: number;
  platformFee?: number;
  currency: string;
  estimatedMinutesRange: string;
  estimatedPickupWindow: string;
  isBackendVerified: boolean;
}

export function useSendPricing({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  weightKg,
  isFragile = false,
}: PricingInput): SendFeeBreakdown {
  const { user } = useAuth();

  // Query real road route
  const { data: roadData } = useRoadRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // Authoritative backend fee calculation RPC
  const { data: rpcData } = useQuery({
    queryKey: [
      'calculate_send_delivery_fee',
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      weightKg,
      isFragile,
      roadData?.distanceKm || null,
    ],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any).rpc('calculate_send_delivery_fee', {
          p_pickup_lat: pickupLat || null,
          p_pickup_lng: pickupLng || null,
          p_dropoff_lat: dropoffLat || null,
          p_dropoff_lng: dropoffLng || null,
          p_weight_kg: weightKg || 1.0,
          p_is_fragile: isFragile,
          p_distance_km: roadData?.distanceKm || null,
        });
        if (error) throw error;
        return data;
      } catch (err) {
        return null;
      }
    },
    staleTime: 60000,
  });

  // Query fee configuration to check for promotional free delivery
  const { data: feeConfigs } = useQuery({
    queryKey: ['fee-config'],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('fee_config')
          .select('*')
          .eq('is_active', true);
        if (error) return [];
        return (data as any[]) || [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const isFreeDeliveryConfig = feeConfigs?.some(
    (f: any) => f.fee_type === 'send_free_delivery' && f.is_active
  );

  const { data: hasPastOrders } = useQuery({
    queryKey: ['user-has-past-send-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { count, error } = await (supabase as any)
        .from('send_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id && !!isFreeDeliveryConfig,
  });

  return useMemo(() => {
    let distanceKm = roadData?.distanceKm;
    if (typeof distanceKm !== 'number') {
      if (rpcData && typeof rpcData.distance_km === 'number') {
        distanceKm = Number(rpcData.distance_km);
      } else if (
        typeof pickupLat === 'number' &&
        typeof pickupLng === 'number' &&
        typeof dropoffLat === 'number' &&
        typeof dropoffLng === 'number'
      ) {
        distanceKm = calculateHaversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      } else {
        distanceKm = 5.0;
      }
    }

    const baseFee = rpcData?.base_fee ? Number(rpcData.base_fee) : 500;
    const perKmRate = rpcData?.per_km_rate ? Number(rpcData.per_km_rate) : 100;
    const distanceFee =
      rpcData?.distance_fee != null
        ? Number(rpcData.distance_fee)
        : Math.round(distanceKm * perKmRate);

    let packageSurcharge = 0;
    if (rpcData?.package_surcharge != null) {
      packageSurcharge = Number(rpcData.package_surcharge);
    } else if (weightKg <= 2) {
      packageSurcharge = 0;
    } else if (weightKg <= 5) {
      packageSurcharge = 200;
    } else if (weightKg <= 10) {
      packageSurcharge = 500;
    } else {
      packageSurcharge = 1000;
    }

    const serviceFee = rpcData?.service_fee ? Number(rpcData.service_fee) : 200;
    const fragileSurcharge = isFragile
      ? rpcData?.fragile_surcharge
        ? Number(rpcData.fragile_surcharge)
        : 300
      : 0;

    const rawCalculatedFee = baseFee + distanceFee + packageSurcharge + serviceFee + fragileSurcharge;
    const rawTotalFee = rpcData?.raw_total_fee != null ? Number(rpcData.raw_total_fee) : rawCalculatedFee;

    const isFirstTimeFreeDelivery = isFreeDeliveryConfig && !hasPastOrders;
    const isFreeDelivery = Boolean(rpcData?.is_free_delivery || isFirstTimeFreeDelivery);
    const totalFee = isFreeDelivery
      ? 0
      : rpcData?.total_fee != null
      ? Number(rpcData.total_fee)
      : rawCalculatedFee;

    const estimatedMinutesRange =
      roadData?.estimatedMinutesRange ||
      `${Math.round(15 + distanceKm * 2.5)} - ${Math.round(35 + distanceKm * 2.5)} mins`;

    return {
      baseFee,
      perKmRate,
      distanceKm,
      distanceFee,
      packageSurcharge,
      serviceFee,
      fragileSurcharge,
      rawTotalFee,
      totalFee,
      isFreeDelivery,
      riderEarnings: rpcData?.rider_earnings ? Number(rpcData.rider_earnings) : Math.round(rawTotalFee * 0.8),
      platformFee: isFreeDelivery ? 0 : rpcData?.platform_fee ? Number(rpcData.platform_fee) : Math.round(totalFee * 0.2),
      currency: 'NGN',
      estimatedMinutesRange,
      estimatedPickupWindow: '10 - 20 mins',
      isBackendVerified: Boolean(rpcData && typeof rpcData.total_fee === 'number'),
    };
  }, [
    roadData,
    rpcData,
    feeConfigs,
    isFreeDeliveryConfig,
    hasPastOrders,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    weightKg,
    isFragile,
  ]);
}
