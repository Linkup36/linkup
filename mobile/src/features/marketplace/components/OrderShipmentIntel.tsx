import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { MapPin, Phone, User, LocateFixed } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { LiveTrackingMap } from './LiveTrackingMap';
import * as Location from 'expo-location';
import { toast } from '../../../components/ui/GooeyToast';

interface OrderShipmentIntelProps {
  shipment: any;
}

export function OrderShipmentIntel({ shipment }: OrderShipmentIntelProps) {
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);

  // Fetch rider profile with fallback for id/user_id
  const { data: riderProfile } = useQuery({
    queryKey: ['rider-profile', shipment?.rider_id],
    queryFn: async () => {
      if (!shipment?.rider_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, phone')
        .eq('id', shipment.rider_id)
        .maybeSingle();

      if (error || !data) {
        const { data: fallbackData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, phone')
          .eq('user_id', shipment.rider_id)
          .maybeSingle();
        return fallbackData;
      }
      return data;
    },
    enabled: !!shipment?.rider_id,
  });

  // Track rider coords realtime
  useEffect(() => {
    if (!shipment?.rider_id) return;

    const fetchRiderLocation = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', shipment.rider_id)
        .maybeSingle();

      if (data?.latitude && data?.longitude) {
        setRiderCoords({ lat: data.latitude, lng: data.longitude });
      }
    };

    fetchRiderLocation();

    const channel = supabase
      .channel(`rider-loc-${shipment.rider_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${shipment.rider_id}`,
        },
        (payload: any) => {
          if (payload.new?.latitude && payload.new?.longitude) {
            setRiderCoords({ lat: payload.new.latitude, lng: payload.new.longitude });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shipment?.rider_id]);

  // Buyer live location sharing
  useEffect(() => {
    if (!isSharingLocation || !shipment?.id) return;

    let sub: Location.LocationSubscription | null = null;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location permission denied');
        setIsSharingLocation(false);
        return;
      }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          setBuyerCoords({ lat: latitude, lng: longitude });

          await (supabase as any)
            .from('shipments')
            .update({
              buyer_latitude: latitude,
              buyer_longitude: longitude,
              buyer_location_last_updated: new Date().toISOString(),
            })
            .eq('id', shipment.id);
        }
      );
    }

    startTracking();

    return () => {
      if (sub) sub.remove();
    };
  }, [isSharingLocation, shipment?.id]);

  const handleCallRider = async () => {
    if (!riderProfile?.phone) {
      toast.info('No phone number on record for this courier');
      return;
    }
    const cleanPhone = riderProfile.phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Courier Contact', `Phone number: ${riderProfile.phone}`);
      }
    } catch {
      Alert.alert('Courier Contact', `Phone number: ${riderProfile.phone}`);
    }
  };

  const riderName =
    riderProfile?.display_name || 'Assigned Courier';

  return (
    <View style={styles.container}>
      {/* Live Map Preview */}
      <LiveTrackingMap riderCoords={riderCoords} buyerCoords={buyerCoords} height={180} />

      {/* Courier Profile Bar */}
      {!shipment?.rider_id ? (
        <View style={styles.awaitingBox}>
          <View style={styles.awaitingDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.awaitingTitle}>Awaiting Courier Assignment</Text>
            <Text style={styles.awaitingSub}>
              A dispatch courier will be assigned to deliver this order shortly.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.courierBar}>
          <View style={styles.courierLeft}>
            {riderProfile?.avatar_url ? (
              <Image source={{ uri: riderProfile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={18} color="#ffffff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.courierSub}>VERIFIED DISPATCH</Text>
              <Text style={styles.courierName}>{riderName}</Text>
              {riderProfile?.phone ? (
                <TouchableOpacity onPress={handleCallRider} activeOpacity={0.7} style={styles.phoneLinkWrap}>
                  <Phone size={10} color={colors.primary} />
                  <Text style={styles.courierPhone}>{riderProfile.phone}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noPhoneText}>No phone registered</Text>
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.callBtn, !riderProfile?.phone && styles.callBtnDisabled]} 
            onPress={handleCallRider} 
            activeOpacity={0.8}
          >
            <Phone size={14} color="#ffffff" />
            <Text style={styles.callText}>Call Courier</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Live Buyer GPS Sharing Toggle */}
      <View style={styles.sharingRow}>
        <View style={styles.sharingLeft}>
          <LocateFixed size={16} color={isSharingLocation ? '#16a34a' : '#64748b'} />
          <View>
            <Text style={styles.sharingTitle}>Share Precise Dropoff GPS</Text>
            <Text style={styles.sharingSub}>Helps the dispatch rider find your door faster</Text>
          </View>
        </View>

        <Switch
          value={isSharingLocation}
          onValueChange={setIsSharingLocation}
          trackColor={{ false: '#cbd5e1', true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    marginVertical: 6,
  },
  courierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  courierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  courierName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#16a34a',
  },
  callBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  callText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  phoneLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  courierPhone: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  noPhoneText: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  awaitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  awaitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d97706',
  },
  awaitingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  awaitingSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 1,
  },
  sharingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sharingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sharingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  sharingSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});
