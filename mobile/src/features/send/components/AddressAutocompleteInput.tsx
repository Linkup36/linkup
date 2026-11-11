import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Compass,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LocationPickerModal } from './LocationPickerModal';
import { colors } from '../../../theme/colors';
import { inferNigerianCityFromCoords } from '../utils/addressFormatter';

interface AddressAutocompleteInputProps {
  label: string;
  placeholder?: string;
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  error?: string;
  isRequired?: boolean;
  mode?: 'pickup' | 'dropoff';
  showQuickPills?: boolean;
  onChangeAddress: (address: string) => void;
  onSelectLocation: (data: { address: string; latitude: number; longitude: number }) => void;
  onFocus?: () => void;
}

export function AddressAutocompleteInput({
  label,
  placeholder = 'Enter address, area or landmark...',
  value,
  latitude,
  longitude,
  error,
  isRequired = true,
  mode = 'dropoff',
  onChangeAddress,
  onSelectLocation,
  onFocus,
}: AddressAutocompleteInputProps) {
  const [query, setQuery] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const isPickup = mode === 'pickup';
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const handleTextChange = (text: string) => {
    setQuery(text);
    onChangeAddress(text);
  };

  const handleGpsDetect = async () => {
    setIsDetectingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;

      const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      let formatted = '';
      if (res && res.length > 0) {
        const item = res[0];
        const parts = [
          item.streetNumber,
          item.street || item.name,
          item.district || item.subregion,
          item.city || item.region,
        ].filter(Boolean);
        if (parts.length > 0) formatted = parts.join(', ');
      }
      if (!formatted) {
        const city = inferNigerianCityFromCoords(lat, lng);
        formatted = `${city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }

      setQuery(formatted);
      onChangeAddress(formatted);
      onSelectLocation({ address: formatted, latitude: lat, longitude: lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('GPS detection failed:', err);
    } finally {
      setIsDetectingGps(false);
      setIsFocused(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Label & Status */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {isRequired && <Text style={{ color: '#ef4444' }}>*</Text>}
        </Text>
        {hasCoords && (
          <View style={styles.verifiedBadge}>
            <CheckCircle2 size={11} color="#16a34a" />
            <Text style={styles.verifiedText}>GPS Matched</Text>
          </View>
        )}
      </View>

      {/* Main Input Box */}
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused, !!error && styles.inputWrapperError]}>
        <View style={styles.leftPinWrap}>
          <MapPin size={18} color={isPickup ? '#16a34a' : colors.primary} />
        </View>

        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
        />

        {isDetectingGps && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
      </View>

      {/* Action shortcuts under input: Detect Address & Pin on Map */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={handleGpsDetect}
          disabled={isDetectingGps}
          activeOpacity={0.7}
        >
          {isDetectingGps ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={13} color={colors.primary} />
          )}
          <Text style={styles.shortcutText}>
            {isDetectingGps ? 'Detecting Address...' : 'Detect Address'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => setIsMapModalOpen(true)}
          activeOpacity={0.7}
        >
          <Compass size={13} color="#2563eb" />
          <Text style={[styles.shortcutText, { color: '#2563eb' }]}>Pin on Live Map</Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {/* Interactive Map Picker Modal */}
      <LocationPickerModal
        visible={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        mode={mode}
        initialLatitude={latitude}
        initialLongitude={longitude}
        initialAddress={value}
        onSelectLocation={onSelectLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    position: 'relative',
    zIndex: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  leftPinWrap: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 10,
  },
  shortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
  },
});
