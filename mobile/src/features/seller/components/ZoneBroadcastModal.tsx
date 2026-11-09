import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import {
  Radio,
  MapPin,
  Clock,
  Users,
  Navigation,
  LocateFixed,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import { toast } from '../../../components/ui/GooeyToast';
import { useAuth } from '../../../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoneBroadcastModalProps {
  visible: boolean;
  onClose: () => void;
  onBroadcast: (
    zone: string,
    zoneId: string,
    pickupAddress: string,
    pickupTime: string,
    lat?: number,
    lng?: number
  ) => void;
  isBroadcasting?: boolean;
  defaultZone?: string;
  defaultPickupAddress?: string;
}

export function ZoneBroadcastModal({
  visible,
  onClose,
  onBroadcast,
  isBroadcasting = false,
  defaultZone,
  defaultPickupAddress,
}: ZoneBroadcastModalProps) {
  const { profile } = useAuth();

  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>(defaultZone || '');
  const [pickupPoint, setPickupPoint] = useState<string>(defaultPickupAddress || '');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [zoneAgentCount, setZoneAgentCount] = useState<number>(0);

  // Initialize defaults on open
  useEffect(() => {
    if (visible) {
      if (defaultPickupAddress) setPickupPoint(defaultPickupAddress);
      if (defaultZone) setSelectedZone(defaultZone);

      // Default pickup time: 2 hours from now formatted
      const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const hours = twoHoursLater.getHours().toString().padStart(2, '0');
      const mins = twoHoursLater.getMinutes().toString().padStart(2, '0');
      setPickupTime(`Today around ${hours}:${mins} (In ~2 hours)`);

      fetchZones();
    }
  }, [visible, defaultPickupAddress, defaultZone]);

  // Fetch zones matching seller's city (matches web ZoneBroadcastSelector)
  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const cityId = (profile as any)?.city_id;
      let query = (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true);

      if (cityId) {
        query = query.eq('city_id', cityId);
      } else {
        const { data: abuja } = await (supabase as any)
          .from('cities')
          .select('id')
          .eq('name', 'Abuja')
          .maybeSingle();
        if (abuja) query = query.eq('city_id', abuja.id);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;

      if (data) {
        const mapped = data.map((z: any) => ({
          id: z.id,
          name: z.name,
          label: z.name.split(' (')[0],
          area: z.name.split(' (')[1]?.replace(')', '') || z.name,
        }));
        setZones(mapped);

        if (!selectedZone && mapped.length > 0) {
          setSelectedZone(mapped[0].name);
        }
      }
    } catch (e) {
      console.warn('[ZoneBroadcastModal] fetchZones error:', e);
    } finally {
      setLoadingZones(false);
    }
  };

  // Count active agents in selected zone (matches web)
  useEffect(() => {
    async function fetchAgentCount() {
      if (!selectedZone || zones.length === 0) return;
      const zoneObj = zones.find((z) => z.name === selectedZone);
      if (!zoneObj) return;

      try {
        const { count } = await (supabase as any)
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('zone_id', zoneObj.id);

        setZoneAgentCount(count || 0);
      } catch (err) {
        console.warn('Agent count error:', err);
      }
    }

    fetchAgentCount();
  }, [selectedZone, zones]);

  // Handle GPS location capture
  const handlePinLocation = async () => {
    try {
      setIsLocating(true);
      Haptics.selectionAsync();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location permission was denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;
      setPickupCoords({ lat: latitude, lng: longitude });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Location Pinned! 📍', {
        description: `Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) captured for dispatch radar.`,
      });
    } catch (err: any) {
      toast.error('Location capture failed: ' + err.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    const zoneObj = zones.find((z) => z.name === selectedZone);
    if (!zoneObj) {
      toast.error('Please select an active delivery zone');
      return;
    }
    if (!pickupPoint.trim()) {
      toast.error('Please specify seller pickup location');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBroadcast(
      selectedZone,
      zoneObj.id,
      pickupPoint.trim(),
      pickupTime || 'Ready for Pickup',
      pickupCoords?.lat,
      pickupCoords?.lng
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Top Drag Pill */}
          <View style={styles.dragPillWrap}>
            <View style={styles.dragPill} />
          </View>

          {/* Header Bar matching Web ZoneBroadcastSelector */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.radarIconWrap}>
                <Radio size={24} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Find Delivery Partner</Text>
                <Text style={styles.headerSubtitle}>
                  Available partners in this area will be notified of your request.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Pickup Point Input (with GPS Pinning) */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>PRODUCT PICKUP POINT</Text>
                <TouchableOpacity
                  style={[
                    styles.pinLocationBtn,
                    pickupCoords && styles.pinLocationBtnActive,
                  ]}
                  onPress={handlePinLocation}
                  disabled={isLocating}
                  activeOpacity={0.8}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <LocateFixed
                        size={12}
                        color={pickupCoords ? colors.primary : '#FFFFFF'}
                        strokeWidth={2.5}
                      />
                      <Text
                        style={[
                          styles.pinLocationBtnText,
                          pickupCoords && styles.pinLocationBtnTextActive,
                        ]}
                      >
                        {pickupCoords ? 'Location Pinned' : 'Pin My GPS'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={pickupPoint}
                  onChangeText={setPickupPoint}
                  placeholder="Specify where the agent should pick up the product"
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.inputIconWrap}>
                  <MapPin size={18} color={colors.primary} />
                </View>
              </View>

              <Text style={styles.helperText}>
                {pickupCoords
                  ? `📍 GPS coordinates captured (${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)})`
                  : 'Tip: Pinning your location helps couriers navigate directly to your shop.'}
              </Text>
            </View>

            {/* 2. Pickup Window (Time) */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color="#64748B" strokeWidth={2.5} />
                  <Text style={styles.sectionLabel}>PICKUP WINDOW</Text>
                </View>
              </View>

              {/* Quick Time Pills */}
              <View style={styles.timePillsRow}>
                {[
                  'In ~1 Hour',
                  'In ~2 Hours',
                  'This Afternoon',
                  'Ready Tomorrow AM',
                ].map((preset) => {
                  const isSelected = pickupTime.includes(preset.replace('~', ''));
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.timePill,
                        isSelected && styles.timePillActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setPickupTime(preset);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.timePillText,
                          isSelected && styles.timePillTextActive,
                        ]}
                      >
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={pickupTime}
                  onChangeText={setPickupTime}
                  placeholder="e.g. Ready today by 3:00 PM"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Text style={styles.helperText}>
                When will the package be packaged and ready for handover?
              </Text>
            </View>

            {/* 3. Delivery Zone Selection (2-Column Grid matching Web) */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={12} color="#64748B" strokeWidth={2.5} />
                  <Text style={styles.sectionLabel}>SELECT DELIVERY ZONE</Text>
                </View>
              </View>

              {loadingZones ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading dispatch territories...</Text>
                </View>
              ) : (
                <View style={styles.zonesGrid}>
                  {zones.map((zone) => {
                    const isSelected = selectedZone === zone.name;
                    return (
                      <TouchableOpacity
                        key={zone.id}
                        style={[
                          styles.zoneCard,
                          isSelected && styles.zoneCardActive,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedZone(zone.name);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.zoneCardTop}>
                          <View
                            style={[
                              styles.zoneIndicatorDot,
                              { backgroundColor: isSelected ? colors.primary : '#94A3B8' },
                            ]}
                          />
                          {isSelected && (
                            <View style={styles.checkBadge}>
                              <Check size={10} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.zoneLabel} numberOfLines={1}>
                          {zone.label}
                        </Text>
                        <Text style={styles.zoneArea} numberOfLines={1}>
                          {zone.area}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 4. Zone Agent Stats Preview Card matching Web */}
            {selectedZone ? (
              <View style={styles.agentStatsCard}>
                <View style={styles.agentStatsLeft}>
                  <View style={styles.agentIconWrap}>
                    <Users size={18} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.agentCountTitle}>
                      {zoneAgentCount} Active Partners
                    </Text>
                    <Text style={styles.agentCountSub}>
                      In {selectedZone.split(' (')[0]} territory
                    </Text>
                  </View>
                </View>

                <View style={styles.liveRequestBadge}>
                  <Navigation size={10} color="#15803D" />
                  <Text style={styles.liveRequestBadgeText}>Live Request</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isBroadcasting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.broadcastBtn,
                (!selectedZone || !pickupPoint.trim() || isBroadcasting) && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleConfirm}
              disabled={!selectedZone || !pickupPoint.trim() || isBroadcasting}
              activeOpacity={0.85}
            >
              {isBroadcasting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.broadcastBtnText}>Finding partners...</Text>
                </>
              ) : (
                <>
                  <Radio size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.broadcastBtnText}>Find a Partner</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: SCREEN_HEIGHT * 0.72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragPillWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  radarIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },

  sectionWrap: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },

  pinLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pinLocationBtnActive: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pinLocationBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pinLocationBtnTextActive: {
    color: colors.primary,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputIconWrap: {
    paddingLeft: 8,
  },
  helperText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    paddingLeft: 4,
  },

  // Time Pills
  timePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timePillActive: {
    backgroundColor: '#FFF7F2',
    borderColor: colors.primary,
  },
  timePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
  },
  timePillTextActive: {
    color: colors.primary,
  },

  // 2-Column Zones Grid
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  zoneCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  zoneCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7F2',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  zoneCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  zoneIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  zoneArea: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  // Agent Stats Card
  agentStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
  },
  agentStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(235, 125, 48, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentCountTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#9A3412',
  },
  agentCountSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C2410C',
    marginTop: 1,
  },
  liveRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveRequestBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Footer Actions
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  broadcastBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  broadcastBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});