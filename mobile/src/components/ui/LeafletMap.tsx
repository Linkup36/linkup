import React, { forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';
import { Navigation, ArrowUpRight, MapPin } from 'lucide-react-native';

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

// ── Web Mercator Projection Utilities ───────────────────────────────────────
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const siny = Math.sin((lat * Math.PI) / 180);
  const clampedSiny = Math.min(Math.max(siny, -0.9999), 0.9999);
  const scale = 256 * Math.pow(2, zoom);
  const x = scale * (0.5 + lng / 360);
  const y = scale * (0.5 - Math.log((1 + clampedSiny) / (1 - clampedSiny)) / (4 * Math.PI));
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = 256 * Math.pow(2, zoom);
  const lng = ((x / scale) - 0.5) * 360;
  const yNorm = 0.5 - (y / scale);
  const lat = 90 - (360 * Math.atan(Math.exp(-yNorm * 2 * Math.PI))) / Math.PI;
  return { latitude: lat, longitude: lng };
}

function getBoundsZoom(points: LatLng[], width: number, height: number, padding = 45): number {
  if (points.length <= 1) return 14;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  const targetW = Math.max(width - padding * 2, 40);
  const targetH = Math.max(height - padding * 2, 40);

  for (let z = 17; z >= 4; z--) {
    const p1 = project(maxLat, minLng, z);
    const p2 = project(minLat, maxLng, z);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    if (w <= targetW && h <= targetH) {
      return z;
    }
  }
  return 11;
}

// ── Main MapView Component ──────────────────────────────────────────────────
const MapViewComponent = forwardRef<MapViewRef, MapViewProps>(
  ({ initialRegion, region, style, onPress, children }, ref) => {
    const [dimensions, setDimensions] = useState({ width: 360, height: 240 });
    const [tileError, setTileError] = useState(false);

    // Extract markers and polylines from children
    const { markers, polylines } = useMemo(() => {
      const mList: (MarkerProps & { id: string })[] = [];
      const pList: PolylineProps[] = [];

      React.Children.forEach(children, (child, index) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as any;
        if (child.type === Marker && props?.coordinate) {
          mList.push({ ...props, id: `marker-${index}` });
        } else if (child.type === Polyline && props?.coordinates) {
          pList.push(props);
        }
      });

      return { markers: mList, polylines: pList };
    }, [children]);

    // Active center coordinates
    const defaultLat = region?.latitude || initialRegion?.latitude || 9.0765;
    const defaultLng = region?.longitude || initialRegion?.longitude || 7.3986;

    const [center, setCenter] = useState<LatLng>({ latitude: defaultLat, longitude: defaultLng });
    const [zoomOverride, setZoomOverride] = useState<number | null>(null);

    // Synchronize center when region or markers change
    useImperativeHandle(ref, () => ({
      fitToCoordinates: (coordinates, options) => {
        if (!coordinates || coordinates.length === 0) return;
        let sumLat = 0;
        let sumLng = 0;
        for (const c of coordinates) {
          sumLat += c.latitude;
          sumLng += c.longitude;
        }
        setCenter({
          latitude: sumLat / coordinates.length,
          longitude: sumLng / coordinates.length,
        });
        const padding = options?.edgePadding?.top || 45;
        const z = getBoundsZoom(coordinates, dimensions.width, dimensions.height, padding);
        setZoomOverride(z);
      },
      animateToRegion: (r) => {
        setCenter({ latitude: r.latitude, longitude: r.longitude });
        if (r.latitudeDelta) {
          const z = Math.round(Math.log2(360 / r.latitudeDelta));
          setZoomOverride(Math.min(Math.max(z, 5), 18));
        }
      },
    }));

    // Calculate active zoom
    const allPoints: LatLng[] = [];
    if (markers.length > 0) {
      markers.forEach((m) => allPoints.push(m.coordinate));
    }
    polylines.forEach((poly) => {
      poly.coordinates.forEach((c) => allPoints.push(c));
    });

    const activeZoom =
      zoomOverride !== null
        ? zoomOverride
        : allPoints.length >= 2
        ? getBoundsZoom(allPoints, dimensions.width, dimensions.height)
        : 14;

    // Determine center: if points exist and no manual drag/override, center on centroid
    const activeCenter = useMemo(() => {
      if (allPoints.length >= 2 && zoomOverride === null) {
        let minLat = 90;
        let maxLat = -90;
        let minLng = 180;
        let maxLng = -180;
        for (const p of allPoints) {
          if (p.latitude < minLat) minLat = p.latitude;
          if (p.latitude > maxLat) maxLat = p.latitude;
          if (p.longitude < minLng) minLng = p.longitude;
          if (p.longitude > maxLng) maxLng = p.longitude;
        }
        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
        };
      }
      return center;
    }, [allPoints, zoomOverride, center]);

    const handleLayout = (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    const handlePress = (e: any) => {
      if (!onPress) return;
      const { locationX, locationY } = e.nativeEvent;
      const centerPixel = project(activeCenter.latitude, activeCenter.longitude, activeZoom);
      const minX = centerPixel.x - dimensions.width / 2;
      const minY = centerPixel.y - dimensions.height / 2;
      const clickedPixelX = minX + locationX;
      const clickedPixelY = minY + locationY;
      const coord = unproject(clickedPixelX, clickedPixelY, activeZoom);
      onPress({ nativeEvent: { coordinate: coord } });
    };

    // External Maps Deep Link
    const handleOpenExternalMaps = () => {
      const pickup = markers.find((m) => m.title?.toLowerCase().includes('pickup'))?.coordinate || markers[0]?.coordinate;
      const dropoff = markers.find((m) => m.title?.toLowerCase().includes('drop'))?.coordinate || (markers.length > 1 ? markers[markers.length - 1]?.coordinate : null);

      let url = '';
      if (pickup && dropoff) {
        const origin = `${pickup.latitude},${pickup.longitude}`;
        const dest = `${dropoff.latitude},${dropoff.longitude}`;
        url = Platform.select({
          ios: `maps://?saddr=${origin}&daddr=${dest}&dirflg=d`,
          default: `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
        }) || `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
      } else {
        const target = `${activeCenter.latitude},${activeCenter.longitude}`;
        url = Platform.select({
          ios: `maps://?q=${target}`,
          default: `https://www.google.com/maps/search/?api=1&query=${target}`,
        }) || `https://www.google.com/maps/search/?api=1&query=${target}`;
      }

      Linking.openURL(url).catch(() => {
        const fallback = `https://www.google.com/maps/search/?api=1&query=${activeCenter.latitude},${activeCenter.longitude}`;
        Linking.openURL(fallback);
      });
    };

    // Calculate visible tiles in Web Mercator
    const centerPixel = project(activeCenter.latitude, activeCenter.longitude, activeZoom);
    const minX = centerPixel.x - dimensions.width / 2;
    const maxX = centerPixel.x + dimensions.width / 2;
    const minY = centerPixel.y - dimensions.height / 2;
    const maxY = centerPixel.y + dimensions.height / 2;

    const minTileX = Math.floor(minX / 256);
    const maxTileX = Math.floor(maxX / 256);
    const minTileY = Math.floor(minY / 256);
    const maxTileY = Math.floor(maxY / 256);

    const tiles: { key: string; url: string; left: number; top: number }[] = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const sub = ['a', 'b', 'c', 'd'][Math.abs((tx + ty) % 4)];
        const url = tileError
          ? `https://${sub}.tile.openstreetmap.org/${activeZoom}/${tx}/${ty}.png`
          : `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${activeZoom}/${tx}/${ty}.png`;
        tiles.push({
          key: `${activeZoom}-${tx}-${ty}`,
          url,
          left: tx * 256 - minX,
          top: ty * 256 - minY,
        });
      }
    }

    return (
      <View style={[styles.container, style]} onLayout={handleLayout}>
        <TouchableOpacity
          activeOpacity={onPress ? 0.8 : 1}
          onPress={onPress ? handlePress : undefined}
          style={StyleSheet.absoluteFillObject}
        >
          {/* Tile Layer (Pure Native React Native Images) */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {tiles.map((t) => (
              <Image
                key={t.key}
                source={{ uri: t.url }}
                style={[
                  styles.tile,
                  {
                    left: t.left,
                    top: t.top,
                  },
                ]}
                onError={() => setTileError(true)}
                resizeMode="cover"
              />
            ))}
          </View>

          {/* Polyline Layer (SVG) */}
          {polylines.length > 0 && (
            <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {polylines.map((poly, idx) => {
                const pointsString = poly.coordinates
                  .map((c) => {
                    const p = project(c.latitude, c.longitude, activeZoom);
                    return `${(p.x - minX).toFixed(1)},${(p.y - minY).toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <SvgPolyline
                    key={idx}
                    points={pointsString}
                    stroke={poly.strokeColor || '#E96F28'}
                    strokeWidth={poly.strokeWidth || 3.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={poly.lineDashPattern ? poly.lineDashPattern.join(',') : undefined}
                  />
                );
              })}
            </Svg>
          )}

          {/* Markers Layer */}
          {markers.map((m) => {
            const p = project(m.coordinate.latitude, m.coordinate.longitude, activeZoom);
            const markerX = p.x - minX;
            const markerY = p.y - minY;
            const pinColor = m.pinColor || '#E96F28';

            // If marker has custom children (e.g. Courier bike icon with radar pulse)
            if (m.children) {
              return (
                <View
                  key={m.id}
                  style={[
                    styles.customMarkerWrap,
                    {
                      left: markerX - 22,
                      top: markerY - 22,
                    },
                  ]}
                  pointerEvents="none"
                >
                  {m.children}
                </View>
              );
            }

            // Default Clean Pin Badge
            return (
              <View
                key={m.id}
                style={[
                  styles.defaultPinWrap,
                  {
                    left: markerX - 16,
                    top: markerY - 32,
                  },
                ]}
                pointerEvents="none"
              >
                {m.title ? (
                  <View style={styles.pinTitlePill}>
                    <Text style={styles.pinTitleText} numberOfLines={1}>
                      {m.title}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.pinCircle, { backgroundColor: pinColor }]}>
                  <MapPin size={16} color="#ffffff" strokeWidth={2.4} />
                </View>
              </View>
            );
          })}
        </TouchableOpacity>

        {/* Floating One-Tap "Open in Google Maps" Action Badge */}
        <TouchableOpacity
          style={styles.openMapsButton}
          activeOpacity={0.85}
          onPress={handleOpenExternalMaps}
        >
          <Navigation size={12} color="#ffffff" strokeWidth={2.6} />
          <Text style={styles.openMapsButtonText}>Open in Google Maps</Text>
          <ArrowUpRight size={12} color="#ffffff" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
    );
  }
);

MapViewComponent.displayName = 'MapView';

export const MapView = MapViewComponent;
export default MapViewComponent;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
  },
  tile: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  customMarkerWrap: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  defaultPinWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 9,
  },
  pinTitlePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: 120,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  pinTitleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  pinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  openMapsButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 20,
  },
  openMapsButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
