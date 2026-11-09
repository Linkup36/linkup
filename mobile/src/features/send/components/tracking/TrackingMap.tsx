import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, MapViewRef } from '../../../../components/ui/LeafletMap';
import { Bike, Navigation } from 'lucide-react-native';
import { colors } from '../../../../theme/colors';

interface TrackingMapProps {
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  riderCoords?: { lat: number; lng: number } | null;
  status: string;
}

export function TrackingMap({
  pickupCoords,
  dropoffCoords,
  riderCoords,
  status,
}: TrackingMapProps) {
  const mapRef = useRef<MapViewRef | null>(null);

  const defaultCenter = {
    latitude: riderCoords?.lat || pickupCoords?.lat || 9.0765,
    longitude: riderCoords?.lng || pickupCoords?.lng || 7.3986,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const pointsToFit: { latitude: number; longitude: number }[] = [];
  if (pickupCoords) pointsToFit.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
  if (dropoffCoords) pointsToFit.push({ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng });
  if (riderCoords) pointsToFit.push({ latitude: riderCoords.lat, longitude: riderCoords.lng });

  useEffect(() => {
    if (mapRef.current && pointsToFit.length >= 2) {
      mapRef.current.fitToCoordinates(pointsToFit, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng, riderCoords?.lat, riderCoords?.lng]);

  const polylineCoords = [
    ...(riderCoords ? [{ latitude: riderCoords.lat, longitude: riderCoords.lng }] : []),
    ...(pickupCoords ? [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }] : []),
    ...(dropoffCoords ? [{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }] : []),
  ];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={defaultCenter}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Pickup Marker */}
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            title="Pickup Location"
            pinColor="#16a34a"
          />
        )}

        {/* Dropoff Marker */}
        {dropoffCoords && (
          <Marker
            coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }}
            title="Drop-off Destination"
            pinColor="#2563eb"
          />
        )}

        {/* Rider Bike Marker */}
        {riderCoords && (
          <Marker
            coordinate={{ latitude: riderCoords.lat, longitude: riderCoords.lng }}
            title="Live Courier"
            description="On the way"
          >
            <View style={styles.riderMarkerWrap}>
              <View style={styles.riderPulse} />
              <View style={styles.riderPinCircle}>
                <Bike size={18} color="#ffffff" strokeWidth={2.4} />
              </View>
            </View>
          </Marker>
        )}

        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.primary}
            strokeWidth={3.5}
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      <View style={styles.liveBanner}>
        <View style={styles.liveDot} />
        <Text style={styles.liveBannerText}>Live Courier GPS Satellite Link Active</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    position: 'relative',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  riderMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  riderPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(233, 111, 40, 0.3)',
  },
  riderPinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  liveBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveBannerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
