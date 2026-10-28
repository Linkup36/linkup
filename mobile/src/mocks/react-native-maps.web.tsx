import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_GOOGLE = 'google';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  onPress?: (e: any) => void;
  children?: React.ReactNode;
  provider?: string;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
}

export const MapView = forwardRef<any, MapViewProps>(
  ({ style, children, onPress, initialRegion, region }, ref) => {
    const containerRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
      fitToCoordinates: (_coordinates: any, _options?: any) => { },
      fitToSuppliedMarkers: (_markerIDs: any, _options?: any) => { },
      fitToElements: (_animated?: boolean) => { },
      animateToRegion: (_region: any, _duration?: number) => { },
      animateCamera: (_camera: any, _duration?: number) => { },
      setCamera: (_camera: any) => { },
      getCamera: async () => ({}),
      getMapBoundaries: async () => ({
        northEast: { latitude: 0, longitude: 0 },
        southWest: { latitude: 0, longitude: 0 },
      }),
    }));

    const handleClick = (e: any) => {
      if (!onPress) return;
      // Get click position relative to map element if in web
      const currentLat = region?.latitude || initialRegion?.latitude || 9.0765;
      const currentLng = region?.longitude || initialRegion?.longitude || 7.3986;

      let clickLat = currentLat;
      let clickLng = currentLng;

      if (e?.nativeEvent) {
        const { locationX, locationY } = e.nativeEvent;
        if (typeof locationX === 'number' && typeof locationY === 'number') {
          // Add slight delta based on click position
          const latDelta = (region?.latitudeDelta || 0.02) * (0.5 - locationY / 200);
          const lngDelta = (region?.longitudeDelta || 0.02) * (locationX / 300 - 0.5);
          clickLat += latDelta;
          clickLng += lngDelta;
        }
      }

      onPress({
        nativeEvent: {
          coordinate: {
            latitude: clickLat,
            longitude: clickLng,
          },
          position: { x: 0, y: 0 },
        },
      });
    };

    return (
      <View
        ref={containerRef}
        style={[styles.container, style]}
        // @ts-ignore
        onClick={handleClick}
      >
        {/* Subtle grid background simulation for map view */}
        <View style={styles.gridPattern} pointerEvents="none" />

        <View style={styles.watermarkBadge} pointerEvents="none">
          <Text style={styles.watermarkText}>🗺️ Map Preview (Native Google Maps active on iOS/Android)</Text>
        </View>

        {children}
      </View>
    );
  }
);

MapView.displayName = 'MapView';

export const Marker = ({ coordinate, title, description, children, onDragEnd }: any) => {
  return (
    <View style={styles.markerContainer}>
      {children || (
        <View style={styles.defaultPin}>
          <Text style={{ fontSize: 20 }}>📍</Text>
        </View>
      )}
      {title ? (
        <View style={styles.markerTooltip}>
          <Text style={styles.markerTitle} numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.markerDesc} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export const Polyline = ({ strokeColor = '#EB7D30', strokeWidth = 3 }: any) => (
  <View
    style={{
      height: strokeWidth,
      backgroundColor: strokeColor,
      width: '60%',
      alignSelf: 'center',
      marginVertical: 4,
      borderRadius: strokeWidth,
      opacity: 0.8,
    }}
  />
);

export const UrlTile = (_props: any) => null;
export const WMSTile = (_props: any) => null;
export const LocalTile = (_props: any) => null;
export const Polygon = (_props: any) => null;
export const Circle = (_props: any) => null;
export const Callout = ({ children }: any) => <View>{children}</View>;
export const Overlay = (_props: any) => null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  gridPattern: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
  watermarkBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  watermarkText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
    zIndex: 5,
  },
  defaultPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTooltip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 160,
  },
  markerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  markerDesc: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default MapView;
