import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {
  MapPin,
  User,
  Phone,
  Home,
  Navigation,
  ChevronDown,
  X,
  Check,
  Headphones,
  Send,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import * as Haptics from 'expo-haptics';

interface DeliveryStepProps {
  shipping: {
    name: string;
    address: string;
    city_id: string;
    city_name?: string;
    zone_id: string;
    zone_name?: string;
    phone: string;
    lat?: number | null;
    lng?: number | null;
  };
  setShipping: (data: any) => void;
  cities: any[];
  zones: any[];
  onNext: () => void;
  isDetecting?: boolean;
  onDetectLocation?: () => void;
  onSupportPress?: () => void;
  onSendPress?: () => void;
  isVerifying?: boolean;
}

export function DeliveryStep({
  shipping,
  setShipping,
  cities,
  zones,
  onNext,
  isDetecting = false,
  onDetectLocation,
  onSupportPress,
  onSendPress,
  isVerifying = false,
}: DeliveryStepProps) {
  const scrollViewRef = useRef<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Layout tracking for all input forms to position active input above the button & keyboard
  const fieldYPositions = useRef<Record<string, number>>({});

  const handleFieldFocus = (fieldKey: string) => {
    setFocusedField(fieldKey);
    setTimeout(() => {
      const y = fieldYPositions.current[fieldKey];
      if (typeof y === 'number' && scrollViewRef.current) {
        // Smoothly position the focused input cleanly in the upper viewport,
        // comfortably above the button and keyboard
        scrollViewRef.current.scrollTo({
          y: Math.max(0, y - 24),
          animated: true,
        });
      }
    }, Platform.OS === 'ios' ? 70 : 130);
  };

  // Auto-hide floating action buttons when keyboard is active
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setFocusedField(null);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!shipping.name.trim()) errs.name = 'Receiver name is required';
    if (!shipping.phone.trim() || shipping.phone.trim().length < 10)
      errs.phone = 'Valid phone number is required';
    if (!shipping.city_id) errs.city = 'Please select a delivery city';
    if (!shipping.zone_id) errs.zone = 'Please select a delivery zone';
    if (!shipping.address.trim() || shipping.address.trim().length < 5)
      errs.address = 'Full detailed address is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (validate()) {
      onNext();
    }
  };

  // Find active city and zone names for display
  const activeCityName =
    shipping.city_name ||
    cities.find((c: any) => c.id === shipping.city_id)?.name ||
    'Abuja';

  const activeZoneName =
    shipping.zone_name ||
    zones.find((z: any) => z.id === shipping.zone_id)?.name ||
    'Select Zone';

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            isKeyboardVisible && styles.contentContainerKeyboardOpen,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Card Container */}
          <View style={styles.card}>
            {/* Header Title */}
            <View style={styles.header}>
              <Text style={styles.title}>Delivery Details</Text>
              <Text style={styles.subtitle}>Where should we send your package?</Text>
            </View>

            {/* Receiver Name */}
            <View
              style={styles.fieldGroup}
              onLayout={(e) => {
                fieldYPositions.current['name'] = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.fieldLabel}>RECEIVER NAME</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === 'name' && styles.inputBoxFocused,
                  errors.name ? styles.inputError : null,
                ]}
              >
                <User
                  size={18}
                  color={focusedField === 'name' ? '#E86129' : colors.primary}
                />
                <TextInput
                  placeholder="Receiver full name"
                  placeholderTextColor="#94a3b8"
                  value={shipping.name}
                  returnKeyType="next"
                  onFocus={() => handleFieldFocus('name')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(txt) => {
                    setShipping({ ...shipping, name: txt });
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  style={styles.inputText}
                />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Phone Number */}
            <View
              style={styles.fieldGroup}
              onLayout={(e) => {
                fieldYPositions.current['phone'] = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === 'phone' && styles.inputBoxFocused,
                  errors.phone ? styles.inputError : null,
                ]}
              >
                <Phone
                  size={18}
                  color={focusedField === 'phone' ? '#E86129' : colors.primary}
                />
                <TextInput
                  placeholder="e.g. 08145096342"
                  maxLength={11}
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  value={shipping.phone}
                  onFocus={() => handleFieldFocus('phone')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(txt) => {
                    setShipping({ ...shipping, phone: txt });
                    if (errors.phone) setErrors({ ...errors, phone: '' });
                  }}
                  style={styles.inputText}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            {/* Location Header + Dropdowns */}
            <View
              style={styles.fieldGroup}
              onLayout={(e) => {
                fieldYPositions.current['location'] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.locationHeaderRow}>
                <Text style={styles.fieldLabel}>LOCATION</Text>
                {onDetectLocation && (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDetectLocation();
                    }}
                    disabled={isDetecting}
                    style={styles.detectBtn}
                    activeOpacity={0.7}
                  >
                    {isDetecting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Navigation size={13} color={colors.primary} />
                    )}
                    <Text style={styles.detectBtnText}>
                      {isDetecting ? 'DETECTING...' : 'AUTO-DETECT'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Two Side-By-Side Dropdown Selectors */}
              <View style={styles.dropdownsRow}>
                {/* City Dropdown */}
                <TouchableOpacity
                  style={[styles.dropdownBox, errors.city ? styles.inputError : null]}
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.selectionAsync();
                    setIsCityModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !shipping.city_id && !shipping.city_name && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {activeCityName}
                  </Text>
                  <ChevronDown size={18} color="#64748b" />
                </TouchableOpacity>

                {/* Zone Dropdown */}
                <TouchableOpacity
                  style={[styles.dropdownBox, errors.zone ? styles.inputError : null]}
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.selectionAsync();
                    setIsZoneModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !shipping.zone_id && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {activeZoneName}
                  </Text>
                  <ChevronDown size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              {errors.city || errors.zone ? (
                <Text style={styles.errorText}>
                  {errors.city || errors.zone}
                </Text>
              ) : null}
            </View>

            {/* Full Address */}
            <View
              style={styles.fieldGroup}
              onLayout={(e) => {
                fieldYPositions.current['address'] = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.fieldLabel}>FULL ADDRESS</Text>
              <View
                style={[
                  styles.inputBox,
                  styles.addressBox,
                  focusedField === 'address' && styles.inputBoxFocused,
                  errors.address ? styles.inputError : null,
                ]}
              >
                <Home
                  size={18}
                  color={focusedField === 'address' ? '#E86129' : colors.primary}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  placeholder="Street address, house number, apartment, estate..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  value={shipping.address}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onFocus={() => handleFieldFocus('address')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(txt) => {
                    setShipping({ ...shipping, address: txt });
                    if (errors.address) setErrors({ ...errors, address: '' });
                  }}
                  style={[styles.inputText, styles.addressInput]}
                />
              </View>
              {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
            </View>

            {/* Review & Pay CTA Button */}
            <View
              onLayout={(e) => {
                fieldYPositions.current['button'] = e.nativeEvent.layout.y;
              }}
            >
              <TouchableOpacity
                style={[styles.primaryBtn, isVerifying && { opacity: 0.85 }]}
                onPress={handleNext}
                disabled={isVerifying}
                activeOpacity={0.85}
              >
                {isVerifying ? (
                  <View style={styles.verifyingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.primaryBtnText}>Verifying Logistics...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Review & Pay  →</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Floating Action Button: Left Headphones (Support) - hidden during keyboard typing */}
      {onSupportPress && !isKeyboardVisible && (
        <TouchableOpacity
          style={styles.floatingSupportBtn}
          onPress={onSupportPress}
          activeOpacity={0.85}
        >
          <Headphones size={22} color="#ffffff" strokeWidth={2.4} />
        </TouchableOpacity>
      )}

      {/* Floating Action Button: Right Send Courier - hidden during keyboard typing */}
      {onSendPress && !isKeyboardVisible && (
        <TouchableOpacity
          style={styles.floatingSendBtn}
          onPress={onSendPress}
          activeOpacity={0.85}
        >
          <Send size={20} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.floatingSendLabel}>SEND</Text>
        </TouchableOpacity>
      )}

      {/* City Selector Modal */}
      <Modal
        visible={isCityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCityModalOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery City</Text>
              <TouchableOpacity onPress={() => setIsCityModalOpen(false)}>
                <X size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={cities}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  shipping.city_id === item.id || activeCityName === item.name;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalOptionRow,
                      isSelected && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShipping({
                        ...shipping,
                        city_id: item.id,
                        city_name: item.name,
                        zone_id: '',
                        zone_name: '',
                      });
                      if (errors.city) setErrors({ ...errors, city: '' });
                      setIsCityModalOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 300 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Zone Selector Modal */}
      <Modal
        visible={isZoneModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsZoneModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsZoneModalOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Zone</Text>
              <TouchableOpacity onPress={() => setIsZoneModalOpen(false)}>
                <X size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={zones}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = shipping.zone_id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalOptionRow,
                      isSelected && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShipping({
                        ...shipping,
                        zone_id: item.id,
                        zone_name: item.name,
                      });
                      if (errors.zone) setErrors({ ...errors, zone: '' });
                      setIsZoneModalOpen(false);
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.delivery_fee ? (
                        <Text style={styles.modalOptionSub}>
                          Delivery: ₦{Number(item.delivery_fee).toLocaleString()}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 360 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  contentContainerKeyboardOpen: {
    paddingBottom: 280,
  },
  inputBoxFocused: {
    borderColor: '#E86129',
    borderWidth: 1.5,
    backgroundColor: '#fffaf5',
    shadowColor: '#E86129',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  addressBox: {
    height: 'auto',
    minHeight: 80,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  addressInput: {
    height: 60,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 4,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detectBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dropdownsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 54,
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropdownPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: colors.primary, // #EB7D30
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  coverageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Floating Action Buttons
  floatingSupportBtn: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingSendBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingSendLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  modalOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  modalOptionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
