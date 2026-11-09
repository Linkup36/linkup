import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Clock, Navigation } from 'lucide-react-native';
import { useRoadRoute } from '../hooks/useRoadRoute';
import { colors } from '../../../theme/colors';

interface RoutePreviewMapProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm?: number;
  estimatedMinutes?: string;
}

export function RoutePreviewMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  distanceKm,
  estimatedMinutes,
}: RoutePreviewMapProps) {
  const mapRef = useRef<MapView | null>(null);

  const { data: roadData } = useRoadRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

  const finalDistanceKm = typeof distanceKm === 'number' ? distanceKm : roadData?.distanceKm || 5.0;
  const finalEta = estimatedMinutes || roadData?.estimatedMinutesRange || '15 - 35 mins';

  const hasPickup = typeof pickupLat === 'number' && typeof pickupLng === 'number';
  const hasDropoff = typeof dropoffLat === 'number' && typeof dropoffLng === 'number';

  const defaultCenter = {
    latitude: pickupLat || 9.0765,
    longitude: pickupLng || 7.3986,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const polylineCoords =
    roadData?.coordinates && roadData.coordinates.length > 0
      ? roadData.coordinates
      : hasPickup && hasDropoff
      ? [
          { latitude: pickupLat!, longitude: pickupLng! },
          { latitude: dropoffLat!, longitude: dropoffLng! },
        ]
      : [];

  useEffect(() => {
    if (mapRef.current && hasPickup && hasDropoff) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: pickupLat!, longitude: pickupLng! },
          { latitude: dropoffLat!, longitude: dropoffLng! },
        ],
        {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: true,
        }
      );
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, hasPickup, hasDropoff]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={defaultCenter}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {hasPickup && (
          <Marker
            coordinate={{ latitude: pickupLat!, longitude: pickupLng! }}
            title="Pickup Point"
            pinColor="#16a34a"
          />
        )}

        {hasDropoff && (
          <Marker
            coordinate={{ latitude: dropoffLat!, longitude: dropoffLng! }}
            title="Drop-off Destination"
            pinColor="#2563eb"
          />
        )}

        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Floating Route Stats Pill */}
      <View style={styles.statsPill}>
        <View style={styles.statItem}>
          <Navigation size={13} color={colors.primary} />
          <Text style={styles.statText}>{finalDistanceKm} km</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Clock size={13} color="#16a34a" />
          <Text style={[styles.statText, { color: '#16a34a' }]}>{finalEta}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: 20,
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
  statsPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
  },
});
