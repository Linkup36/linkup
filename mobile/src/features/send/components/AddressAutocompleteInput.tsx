import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Tag,
  Building2,
  Sparkles,
  Compass,
  X,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import {
  searchAddresses,
  resolveSuggestionCoordinates,
  getPopularQuickPicks,
  AddressSuggestion,
} from '../services/addressSearchService';
import { LocationPickerModal } from './LocationPickerModal';
import { colors } from '../../../theme/colors';

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
  showQuickPills = true,
  onChangeAddress,
  onSelectLocation,
  onFocus,
}: AddressAutocompleteInputProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const { addresses: savedAddresses } = useSavedAddresses();

  const isPickup = mode === 'pickup';
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  const executeSearch = async (text: string) => {
    setIsLoading(true);
    try {
      const results = await searchAddresses(text, savedAddresses);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    onChangeAddress(text);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      setSuggestions(getPopularQuickPicks(savedAddresses));
      return;
    }

    debounceTimer.current = setTimeout(() => {
      executeSearch(text);
    }, 200);
  };

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsLoading(true);
    try {
      const resolved = await resolveSuggestionCoordinates(item);
      if (resolved) {
        setQuery(resolved.address);
        onChangeAddress(resolved.address);
        onSelectLocation(resolved);
      } else {
        setQuery(item.displayName || item.primaryTitle);
        onChangeAddress(item.displayName || item.primaryTitle);
      }
    } catch {} finally {
      setIsLoading(false);
      setIsFocused(false);
    }
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
      let formatted = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (res && res.length > 0) {
        const item = res[0];
        const parts = [
          item.streetNumber,
          item.street,
          item.district || item.subregion,
          item.city,
        ].filter(Boolean);
        if (parts.length > 0) formatted = parts.join(', ');
      }

      setQuery(formatted);
      onChangeAddress(formatted);
      onSelectLocation({ address: formatted, latitude: lat, longitude: lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {} finally {
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
      <View
        style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused, !!error && styles.inputWrapperError]}
      >
        <TouchableOpacity
          style={styles.leftPinWrap}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={0.8}
          accessibilityLabel="Focus address input"
        >
          <MapPin size={18} color={isPickup ? '#16a34a' : colors.primary} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
          ]}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={query}
          editable={true}
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={handleTextChange}
          onFocus={() => {
            setIsFocused(true);
            if (!query.trim()) {
              setSuggestions(getPopularQuickPicks(savedAddresses));
            } else {
              executeSearch(query);
            }
            onFocus?.();
          }}
          onBlur={() => {
            // Short delay so click on suggestion triggers first
            setTimeout(() => setIsFocused(false), 250);
          }}
        />

        {isLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />}

        {Boolean(query.length > 0) && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setQuery('');
              onChangeAddress('');
              setSuggestions(getPopularQuickPicks(savedAddresses));
              inputRef.current?.focus();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityLabel="Clear address input"
          >
            <View style={styles.clearBadge}>
              <X size={12} color="#64748b" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Action shortcuts under input: Use Current GPS & Pin on Map */}
      <View style={styles.shortcutsRow}>
        {isPickup && (
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
              {isDetectingGps ? 'Detecting GPS...' : 'Use Current Device Location'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={() => setIsMapModalOpen(true)}
          activeOpacity={0.7}
        >
          <Compass size={13} color="#2563eb" />
          <Text style={[styles.shortcutText, { color: '#2563eb' }]}>Pin on Live Map</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Pick Pills (if not focused or focused with empty query) */}
      {showQuickPills && (!isFocused || query.length === 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
        >
          {getPopularQuickPicks(savedAddresses).slice(0, 6).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.quickPill}
              onPress={() => handleSelectSuggestion(item)}
              activeOpacity={0.7}
              {...(Platform.OS === 'web' ? { onMouseDown: (e: any) => e.preventDefault?.() } : {})}
            >
              {item.isSaved ? (
                <Tag size={11} color={colors.primary} />
              ) : (
                <Building2 size={11} color="#64748b" />
              )}
              <Text style={styles.quickPillText} numberOfLines={1}>
                {item.primaryTitle}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Dropdown Suggestions Card */}
      {isFocused && suggestions.length > 0 && (
        <View style={styles.suggestionsCard}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 220 }}
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
                {...(Platform.OS === 'web' ? { onMouseDown: (e: any) => e.preventDefault?.() } : {})}
              >
                <View style={styles.suggestionIconWrap}>
                  {item.isSaved ? (
                    <Tag size={15} color={colors.primary} />
                  ) : item.category === 'mall' || item.category === 'plaza' ? (
                    <Building2 size={15} color="#2563eb" />
                  ) : (
                    <MapPin size={15} color="#64748b" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionPrimary} numberOfLines={1}>
                    {item.primaryTitle}
                  </Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: '#ffffff',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  leftPinWrap: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 10,
    minHeight: 40,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  pillsScroll: {
    paddingTop: 8,
    gap: 6,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  quickPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  suggestionsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionPrimary: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  suggestionSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  errorText: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '600',
  },
});
