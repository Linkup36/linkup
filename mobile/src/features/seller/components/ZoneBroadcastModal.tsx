import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppModal } from '../../../components/ui/AppModal';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import { Truck, MapPin, Clock } from 'lucide-react-native';

interface ZoneBroadcastModalProps {
  visible: boolean;
  onClose: () => void;
  onBroadcast: (zone: string, zoneId: string, pickupAddress: string, pickupTime: string) => void;
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
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>(defaultZone || '');
  const [pickupAddress, setPickupAddress] = useState<string>(defaultPickupAddress || '');
  const [pickupTime, setPickupTime] = useState<string>('Ready for Pickup (Next 2 Hours)');
  const [loadingZones, setLoadingZones] = useState(false);

  useEffect(() => {
    if (visible) {
      if (defaultPickupAddress) setPickupAddress(defaultPickupAddress);
      if (defaultZone) setSelectedZone(defaultZone);
      fetchZones();
    }
  }, [visible, defaultZone, defaultPickupAddress]);

  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const { data } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setZones(data);
        if (!selectedZone && data.length > 0) {
          setSelectedZone(data[0].name);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch zones for broadcast:', e);
    } finally {
      setLoadingZones(false);
    }
  };

  const handleConfirm = () => {
    const zoneObj = zones.find((z) => z.name === selectedZone);
    const zoneId = zoneObj ? zoneObj.id : '';
    onBroadcast(selectedZone, zoneId, pickupAddress, pickupTime);
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Find Delivery Partner"
      subtitle="Broadcast Package Pickup to Active Local Couriers"
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Pickup Address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Seller Pickup Address</Text>
          <View style={styles.inputRow}>
            <MapPin size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.inputWithIcon}
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="e.g. Shop 12, Wuse 2 Commercial Plaza"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Pickup Time Window */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pickup Ready Window</Text>
          <View style={styles.inputRow}>
            <Clock size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.inputWithIcon}
              value={pickupTime}
              onChangeText={setPickupTime}
              placeholder="e.g. Immediate / Next 2 Hours"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Zone Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dispatch Pickup Zone</Text>
          {loadingZones ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zonesScroll}>
              {zones.map((z) => {
                const isSelected = selectedZone === z.name;
                return (
                  <TouchableOpacity
                    key={z.id}
                    style={[styles.zoneChip, isSelected && styles.zoneChipActive]}
                    onPress={() => setSelectedZone(z.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.zoneChipText, isSelected && styles.zoneChipTextActive]}>
                      {z.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Truck size={18} color="#0284c7" />
          <Text style={styles.infoText}>
            Broadcasting notifies verified nearby dispatch riders to claim the pickup. You will receive live courier GPS updates once accepted.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isBroadcasting}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.broadcastBtn}
            onPress={handleConfirm}
            disabled={isBroadcasting || !pickupAddress.trim()}
          >
            {isBroadcasting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Truck size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.broadcastBtnText}>Broadcast Mission</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  zonesScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  zoneChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  zoneChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  zoneChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  zoneChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  broadcastBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  broadcastBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

