import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, StyleProp, ViewStyle, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { Truck, Store } from 'lucide-react-native';

interface TrackingMapProps {
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  riderCoords?: { lat: number; lng: number } | null;
  status?: string;
  etaText?: string;
  style?: StyleProp<ViewStyle>;
}

export function TrackingMap({
  pickupCoords,
  dropoffCoords,
  riderCoords,
  status = 'on_the_way',
  etaText = '8 min',
  style,
}: TrackingMapProps) {
  const mapRef = useRef<MapView | null>(null);

  // Default coordinate center (Abuja / Central Nigeria)
  const defaultCenter = {
    latitude: riderCoords?.lat || pickupCoords?.lat || 9.0765,
    longitude: riderCoords?.lng || pickupCoords?.lng || 7.3986,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  // Interpolate courier coords between pickup and dropoff if rider hasn't posted live GPS yet
  const effectiveCourierCoords =
    riderCoords && riderCoords.lat && riderCoords.lng
      ? { latitude: riderCoords.lat, longitude: riderCoords.lng }
      : pickupCoords && dropoffCoords
      ? {
          latitude: pickupCoords.lat * 0.45 + dropoffCoords.lat * 0.55,
          longitude: pickupCoords.lng * 0.45 + dropoffCoords.lng * 0.55,
        }
      : pickupCoords
      ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng }
      : null;

  const pointsToFit: { latitude: number; longitude: number }[] = [];
  if (pickupCoords?.lat && pickupCoords?.lng) {
    pointsToFit.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
  }
  if (dropoffCoords?.lat && dropoffCoords?.lng) {
    pointsToFit.push({ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng });
  }
  if (effectiveCourierCoords) {
    pointsToFit.push(effectiveCourierCoords);
  }

  useEffect(() => {
    if (mapRef.current && pointsToFit.length >= 2) {
      mapRef.current.fitToCoordinates(pointsToFit, {
        edgePadding: { top: 70, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [
    pickupCoords?.lat,
    pickupCoords?.lng,
    dropoffCoords?.lat,
    dropoffCoords?.lng,
    riderCoords?.lat,
    riderCoords?.lng,
  ]);

  // Completed segment: Pickup to Courier (Slate / Dark)
  const completedSegment =
    pickupCoords && effectiveCourierCoords
      ? [
          { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
          effectiveCourierCoords,
        ]
      : [];

  // Remaining segment: Courier to Dropoff (Vibrant LinkUp Orange #FA7E2B)
  const remainingSegment =
    effectiveCourierCoords && dropoffCoords
      ? [
          effectiveCourierCoords,
          { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
        ]
      : pickupCoords && dropoffCoords
      ? [
          { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
          { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
        ]
      : [];

  // -------------------------------------------------------------
  // WEB IMPLEMENTATION: Leaflet + Esri / OpenStreetMap Interactive Map
  // -------------------------------------------------------------
  if (Platform.OS === 'web') {
    const pLat = pickupCoords?.lat || 8.5071;
    const pLng = pickupCoords?.lng || 8.5395;
    const dLat = dropoffCoords?.lat || 9.0837;
    const dLng = dropoffCoords?.lng || 7.4746;
    const cLat = effectiveCourierCoords?.latitude || (pLat * 0.45 + dLat * 0.55);
    const cLng = effectiveCourierCoords?.longitude || (pLng * 0.45 + dLng * 0.55);

    const mapHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #E2E8F0; overflow: hidden; }
    
    /* Origin Pin */
    .origin-marker {
      width: 32px; height: 32px; border-radius: 16px;
      background: #FA7E2B; border: 3px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    }
    .origin-marker-dot {
      width: 10px; height: 10px; border-radius: 5px; background: #FFFFFF;
    }

    /* Destination Pin */
    .dest-marker {
      width: 34px; height: 34px; border-radius: 14px;
      background: #FFFFFF; border: 2px solid #E2E8F0;
      box-shadow: 0 3px 8px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }

    /* Live Courier Marker */
    .courier-marker {
      display: flex; flex-direction: column; align-items: center;
      transform: translateY(-8px);
    }
    .courier-eta-badge {
      display: flex; align-items: center; gap: 4px;
      background: #FFFFFF; border: 1px solid #F1F5F9;
      border-radius: 12px; padding: 3px 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px; font-weight: 800; color: #0F172A;
      margin-bottom: 3px; white-space: nowrap;
    }
    .courier-dot-wrap {
      position: relative; width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
    }
    .courier-pulse {
      position: absolute; width: 26px; height: 26px; border-radius: 13px;
      background: rgba(250, 126, 43, 0.35); animation: pulse 1.8s infinite;
    }
    .courier-dot {
      width: 15px; height: 15px; border-radius: 7.5px;
      background: #FA7E2B; border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
    }
    .courier-inner-dot {
      width: 5px; height: 5px; border-radius: 2.5px; background: #FFFFFF;
    }
    @keyframes pulse {
      0% { transform: scale(0.8); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 0.25; }
      100% { transform: scale(0.8); opacity: 0.8; }
    }
    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255, 255, 255, 0.75) !important;
      padding: 2px 5px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${cLat}, ${cLng}], 12);

    // Esri World Street Map Tiles (matching the mockup attribution)
    var esriTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors'
    }).addTo(map);

    // Fallback to OSM tiles if Esri is unreachable
    esriTiles.on('tileerror', function() {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    });

    // Completed polyline segment: Pickup -> Courier (Slate Grey)
    L.polyline([[${pLat}, ${pLng}], [${cLat}, ${cLng}]], {
      color: '#64748B',
      weight: 5,
      opacity: 0.95
    }).addTo(map);

    // Active remaining polyline segment: Courier -> Dropoff (Vibrant Orange #FA7E2B)
    L.polyline([[${cLat}, ${cLng}], [${dLat}, ${dLng}]], {
      color: '#FA7E2B',
      weight: 5,
      opacity: 1.0
    }).addTo(map);

    // Origin Marker (Custom Orange Circle)
    var originIcon = L.divIcon({
      className: '',
      html: '<div class="origin-marker"><div class="origin-marker-dot"></div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker([${pLat}, ${pLng}], { icon: originIcon }).addTo(map);

    // Destination Marker (Custom White Pin with Store Icon)
    var destIcon = L.divIcon({
      className: '',
      html: '<div class="dest-marker">🏬</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    L.marker([${dLat}, ${dLng}], { icon: destIcon }).addTo(map);

    // Live Courier Marker (Truck badge + pulsing dot)
    var courierIcon = L.divIcon({
      className: '',
      html: '<div class="courier-marker"><div class="courier-eta-badge">🚚 ${etaText}</div><div class="courier-dot-wrap"><div class="courier-pulse"></div><div class="courier-dot"><div class="courier-inner-dot"></div></div></div></div>',
      iconSize: [80, 48],
      iconAnchor: [40, 40]
    });
    L.marker([${cLat}, ${cLng}], { icon: courierIcon }).addTo(map);

    // Auto-fit to encompass all 3 points nicely
    var bounds = L.latLngBounds([
      [${pLat}, ${pLng}],
      [${cLat}, ${cLng}],
      [${dLat}, ${dLng}]
    ]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  </script>
</body>
</html>`;

    return (
      <View style={[styles.container, style]}>
        {React.createElement('iframe', {
          srcDoc: mapHtml,
          style: {
            width: '100%',
            height: '100%',
            border: 'none',
          },
          title: 'Live Tracking Map',
        })}
      </View>
    );
  }

  // -------------------------------------------------------------
  // NATIVE IMPLEMENTATION: react-native-maps with UrlTile fallback
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={defaultCenter}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* OpenStreetMap Tile Layer ensures map tiles render without paid Google Maps key on native */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          zIndex={-1}
        />

        {/* Completed Segment Polyline (Slate Blue/Grey) */}
        {completedSegment.length >= 2 && (
          <Polyline
            coordinates={completedSegment}
            strokeColor="#64748B"
            strokeWidth={4.5}
            lineDashPattern={[0]}
          />
        )}

        {/* Active Remaining Segment Polyline (LinkUp Vibrant Orange) */}
        {remainingSegment.length >= 2 && (
          <Polyline
            coordinates={remainingSegment}
            strokeColor="#FA7E2B"
            strokeWidth={4.5}
            lineDashPattern={[0]}
          />
        )}

        {/* Origin / Pickup Marker (Orange pin with white circle) */}
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            title="Pickup Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.originMarkerWrap}>
              <View style={styles.originPin}>
                <View style={styles.originPinDot} />
              </View>
            </View>
          </Marker>
        )}

        {/* Destination / Dropoff Marker (White rounded pin with Store icon) */}
        {dropoffCoords && (
          <Marker
            coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }}
            title="Delivery Destination"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.destMarkerWrap}>
              <View style={styles.destPin}>
                <Store size={16} color="#0F172A" strokeWidth={2.4} />
              </View>
            </View>
          </Marker>
        )}

        {/* Live Courier Marker (Orange Dot + White ETA Pill with Delivery Truck) */}
        {effectiveCourierCoords && (
          <Marker
            coordinate={effectiveCourierCoords}
            title="Live Courier"
            description={`Arriving in ${etaText}`}
            anchor={{ x: 0.5, y: 0.8 }}
          >
            <View style={styles.courierMarkerWrap}>
              {/* ETA Pill badge with orange truck */}
              <View style={styles.courierEtaBadge}>
                <Truck size={13} color="#FA7E2B" strokeWidth={2.5} />
                <Text style={styles.courierEtaText}>{etaText}</Text>
              </View>

              {/* Courier position dot */}
              <View style={styles.courierPulseRing} />
              <View style={styles.courierDot}>
                <View style={styles.courierInnerDot} />
              </View>
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
    height: '100%',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Origin Marker
  originMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  originPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  originPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },

  // Destination Marker
  destMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  destPin: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Live Courier Marker
  courierMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierEtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  courierEtaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  courierPulseRing: {
    position: 'absolute',
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(250, 126, 43, 0.28)',
  },
  courierDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FA7E2B',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierInnerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
});
