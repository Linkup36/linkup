import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { SendOrder } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useSendOrderTracking(orderId?: string) {
  const queryClient = useQueryClient();
  const [liveOrder, setLiveOrder] = useState<SendOrder | null>(null);
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch current order from DB
  const {
    data: initialOrder,
    isLoading,
    error,
    refetch,
  } = useQuery<SendOrder | null>({
    queryKey: ['send_order', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      try {
        const { data, error: fetchErr } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (data) return data as SendOrder;
      } catch (err) {
        console.warn('[useSendOrderTracking] Supabase fetch error, checking AsyncStorage:', err);
      }

      // Fallback to AsyncStorage
      try {
        const localKey = `linkup_send_order_${orderId}`;
        const stored = await AsyncStorage.getItem(localKey);
        if (stored) return JSON.parse(stored);
      } catch {}

      return null;
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      const order = query.state.data;
      if (!order) return 3000;
      if (['delivered', 'cancelled'].includes(order.status)) return false;
      return 3000; // Real-time polling fallback while mission is active
    },
  });

  useEffect(() => {
    if (initialOrder) {
      setLiveOrder(initialOrder);
      if (initialOrder.rider_lat && initialOrder.rider_lng) {
        setRiderCoords({
          lat: Number(initialOrder.rider_lat),
          lng: Number(initialOrder.rider_lng),
        });
      }
    }
  }, [initialOrder]);

  // Realtime subscription via Supabase Channel
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`send_order_tracking_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'send_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as SendOrder;
            setLiveOrder(updated);
            if (updated.rider_lat && updated.rider_lng) {
              setRiderCoords({
                lat: Number(updated.rider_lat),
                lng: Number(updated.rider_lng),
              });
            }
            queryClient.setQueryData(['send_order', orderId], updated);
            queryClient.invalidateQueries({ queryKey: ['send_order', orderId] });
            queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'send_order_tracking_logs',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refetch();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient, refetch]);

  // If rider is assigned, listen to rider's telemetry from profiles table
  useEffect(() => {
    const riderId = liveOrder?.rider_id;
    if (!riderId) return;

    const profileChannel = supabase
      .channel(`rider_telemetry_${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${riderId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).latitude && (payload.new as any).longitude) {
            setRiderCoords({
              lat: Number((payload.new as any).latitude),
              lng: Number((payload.new as any).longitude),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [liveOrder?.rider_id]);

  return {
    order: liveOrder || initialOrder,
    riderCoords,
    isLoading,
    error,
    refetch,
  };
}
