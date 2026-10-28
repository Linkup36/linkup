import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { MapPin, Navigation, X, Check } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'pickup' | 'dropoff';
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialAddress?: string;
  onSelectLocation: (data: { latitude: number; longitude: number; address: string }) => void;
}

const { width, height } = Dimensions.get('window');

export function LocationPickerModal({
  visible,
  onClose,
  mode,
  initialLatitude,
  initialLongitude,
  initialAddress,
  onSelectLocation,
}: LocationPickerModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const isPickup = mode === 'pickup';

  const defaultLat = initialLatitude || 9.0765; // Abuja default
  const defaultLng = initialLongitude || 7.3986;

  const [region, setRegion] = useState({
    latitude: defaultLat,
    longitude: defaultLng,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  const [markerCoords, setMarkerCoords] = useState({
    latitude: defaultLat,
    longitude: defaultLng,
  });

  const [currentAddress, setCurrentAddress] = useState(initialAddress || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  useEffect(() => {
    if (visible) {
      const lat = initialLatitude || 9.0765;
      const lng = initialLongitude || 7.3986;
      setMarkerCoords({ latitude: lat, longitude: lng });
      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });
      if (initialAddress) {
        setCurrentAddress(initialAddress);
      } else {
        reverseGeocodeCoords(lat, lng);
      }
    }
  }, [visible, initialLatitude, initialLongitude, initialAddress]);

  const reverseGeocodeCoords = async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    try {
      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (res && res.length > 0) {
        const item = res[0];
        const parts = [
          item.streetNumber,
          item.street,
          item.district || item.subregion,
          item.city,
        ].filter(Boolean);
        const formatted = parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setCurrentAddress(formatted);
      }
    } catch {
      setCurrentAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleMarkerDragEnd = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarkerCoords(coords);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    reverseGeocodeCoords(coords.latitude, coords.longitude);
  };

  const handleMapPress = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarkerCoords(coords);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    reverseGeocodeCoords(coords.latitude, coords.longitude);
  };

  const handleDetectCurrentGps = async () => {
    setIsDetectingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      setMarkerCoords({ latitude, longitude });
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);

      reverseGeocodeCoords(latitude, longitude);
    } catch {} finally {
      setIsDetectingGps(false);
    }
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSelectLocation({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      address: currentAddress || `${markerCoords.latitude.toFixed(5)}, ${markerCoords.longitude.toFixed(5)}`,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Map View */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={region}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
        >
          <Marker
            coordinate={markerCoords}
            draggable
            onDragEnd={handleMarkerDragEnd}
            title={isPickup ? 'Pickup Point' : 'Drop-off Point'}
            description={currentAddress}
            pinColor={isPickup ? '#16a34a' : '#2563eb'}
          />
        </MapView>

        {/* Top Header Floating Card */}
        <View style={styles.topHeaderCard}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>
              {isPickup ? 'Pin Exact Pickup Point' : 'Pin Drop-off Destination'}
            </Text>
            <Text style={styles.topSub}>Tap or drag marker to set exact location</Text>
          </View>
        </View>

        {/* GPS Button */}
        <TouchableOpacity
          style={styles.gpsFloatingBtn}
          onPress={handleDetectCurrentGps}
          disabled={isDetectingGps}
          activeOpacity={0.8}
        >
          {isDetectingGps ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={20} color={colors.primary} />
          )}
        </TouchableOpacity>

        {/* Bottom Location Confirmation Sheet */}
        <View style={styles.bottomSheet}>
          <View style={styles.addressDisplayRow}>
            <View
              style={[
                styles.pinCircle,
                { backgroundColor: isPickup ? '#f0fdf4' : '#eff6ff' },
              ]}
            >
              <MapPin size={22} color={isPickup ? '#16a34a' : '#2563eb'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>
                {isPickup ? 'CONFIRMED PICKUP' : 'CONFIRMED DROP-OFF'}
              </Text>
              {isGeocoding ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.resolvingText}>Resolving street address...</Text>
                </View>
              ) : (
                <Text style={styles.addressText} numberOfLines={2}>
                  {currentAddress || 'Selected GPS Point'}
                </Text>
              )}
              <Text style={styles.coordsText}>
                {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Check size={18} color="#ffffff" strokeWidth={2.8} />
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  map: {
    width,
    height,
  },
  topHeaderCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  topSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  gpsFloatingBtn: {
    position: 'absolute',
    right: 18,
    bottom: 210,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  addressDisplayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  resolvingText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
    lineHeight: 18,
  },
  coordsText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 16,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
