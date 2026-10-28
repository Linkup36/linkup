import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '../../../theme/colors';

interface LiveTrackingMapProps {
  riderCoords: { lat: number; lng: number } | null;
  buyerCoords: { lat: number; lng: number } | null;
  height?: number;
}

export function LiveTrackingMap({
  riderCoords,
  buyerCoords,
  height = 200,
}: LiveTrackingMapProps) {
  const mapRef = useRef<MapView>(null);

  const defaultCoords = {
    latitude: 9.0765, // Abuja default
    longitude: 7.3986,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const coordinates = [];
    if (riderCoords) {
      coordinates.push({
        latitude: riderCoords.lat,
        longitude: riderCoords.lng,
      });
    }
    if (buyerCoords) {
      coordinates.push({
        latitude: buyerCoords.lat,
        longitude: buyerCoords.lng,
      });
    }

    if (coordinates.length === 2) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } else if (coordinates.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [riderCoords, buyerCoords]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={
          riderCoords
            ? {
                latitude: riderCoords.lat,
                longitude: riderCoords.lng,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }
            : buyerCoords
            ? {
                latitude: buyerCoords.lat,
                longitude: buyerCoords.lng,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }
            : defaultCoords
        }
      >
        {riderCoords && (
          <Marker
            coordinate={{
              latitude: riderCoords.lat,
              longitude: riderCoords.lng,
            }}
            title="Dispatch Rider"
            description="Live Location"
          >
            <View style={styles.riderMarker}>
              <Text style={styles.markerEmoji}>🏍️</Text>
            </View>
          </Marker>
        )}

        {buyerCoords && (
          <Marker
            coordinate={{
              latitude: buyerCoords.lat,
              longitude: buyerCoords.lng,
            }}
            title="Destination"
            description="Buyer Delivery Address"
          >
            <View style={styles.buyerMarker}>
              <Text style={styles.markerEmoji}>📍</Text>
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  riderMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  buyerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerEmoji: {
    fontSize: 18,
  },
});
