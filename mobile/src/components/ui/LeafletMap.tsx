import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_GOOGLE = 'google';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface MarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  draggable?: boolean;
  onDragEnd?: (e: any) => void;
  children?: React.ReactNode;
}

export interface PolylineProps {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}

export interface MapViewProps {
  initialRegion?: Region;
  region?: Region;
  style?: any;
  provider?: string;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
  children?: React.ReactNode;
}

export const Marker: React.FC<MarkerProps> = () => null;
export const Polyline: React.FC<PolylineProps> = () => null;

export interface MapViewRef {
  fitToCoordinates: (
    coordinates: LatLng[],
    options?: { edgePadding?: { top?: number; right?: number; bottom?: number; left?: number }; animated?: boolean }
  ) => void;
  animateToRegion: (region: Region, duration?: number) => void;
}

export type MapView = MapViewRef;

const MapViewComponent = forwardRef<MapViewRef, MapViewProps>(
  ({ initialRegion, region, style, onPress, children }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [loaded, setLoaded] = useState(false);

    const centerLat = region?.latitude || initialRegion?.latitude || 9.0765; // Abuja default
    const centerLng = region?.longitude || initialRegion?.longitude || 7.3986;

    // Extract markers and polylines from children
    const markers: { lat: number; lng: number; title: string }[] = [];
    const polylines: LatLng[][] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const childProps = child.props as any;
      if (child.type === Marker && childProps?.coordinate) {
        markers.push({
          lat: childProps.coordinate.latitude,
          lng: childProps.coordinate.longitude,
          title: childProps.title || '',
        });
      } else if (child.type === Polyline && childProps?.coordinates) {
        polylines.push(childProps.coordinates);
      }
    });

    useImperativeHandle(ref, () => ({
      fitToCoordinates: (coordinates) => {
        if (!webViewRef.current || coordinates.length === 0) return;
        const coordsJson = JSON.stringify(coordinates.map((c) => [c.latitude, c.longitude]));
        webViewRef.current.injectJavaScript(`
          if (window.map) {
            var bounds = L.latLngBounds(${coordsJson});
            window.map.fitBounds(bounds, { padding: [40, 40] });
          }
          true;
        `);
      },
      animateToRegion: (r) => {
        if (!webViewRef.current) return;
        webViewRef.current.injectJavaScript(`
          if (window.map) {
            window.map.panTo([${r.latitude}, ${r.longitude}]);
          }
          true;
        `);
      },
    }));

    useEffect(() => {
      if (loaded && webViewRef.current) {
        const markersJson = JSON.stringify(markers);
        const polylinesJson = JSON.stringify(
          polylines.map((line) => line.map((p) => [p.latitude, p.longitude]))
        );
        webViewRef.current.injectJavaScript(`
          if (window.updateLayers) {
            window.updateLayers(${markersJson}, ${polylinesJson});
          }
          true;
        `);
      }
    }, [loaded, JSON.stringify(markers), JSON.stringify(polylines)]);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f8fafc; }
          .leaflet-control-attribution { display: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 13);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          var markerLayerGroup = L.layerGroup().addTo(map);
          var polylineLayerGroup = L.layerGroup().addTo(map);

          window.updateLayers = function(markers, polylines) {
            markerLayerGroup.clearLayers();
            polylineLayerGroup.clearLayers();

            markers.forEach(function(m) {
              if (m.lat && m.lng) {
                var marker = L.marker([m.lat, m.lng]).addTo(markerLayerGroup);
                if (m.title) marker.bindPopup(m.title);
              }
            });

            polylines.forEach(function(coords) {
              if (coords.length > 0) {
                L.polyline(coords, { color: '#E96F28', weight: 4 }).addTo(polylineLayerGroup);
              }
            });
          };

          map.on('click', function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'click',
              coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
            }));
          });
        </script>
      </body>
      </html>
    `;

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onLoad={() => setLoaded(true)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'click' && onPress) {
                onPress({ nativeEvent: { coordinate: data.coordinate } });
              }
            } catch (err) {}
          }}
          scrollEnabled={false}
          style={styles.webview}
        />
      </View>
    );
  }
);

MapViewComponent.displayName = 'MapView';

export const MapView = MapViewComponent;

export default MapViewComponent;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
