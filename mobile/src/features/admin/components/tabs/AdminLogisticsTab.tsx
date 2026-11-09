import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import {
  Truck,
  MapPin,
  Compass,
  Plus,
  Edit2,
  Trash2,
  Check,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 8;

export function AdminLogisticsTab() {
  const [activeSubTab, setActiveSubTab] = useState<'zones' | 'cities'>('zones');
  const [zones, setZones] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zonesPage, setZonesPage] = useState(1);
  const [citiesPage, setCitiesPage] = useState(1);

  // Modals state
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);

  // Form inputs
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCityId, setNewZoneCityId] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [editFeeVal, setEditFeeVal] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLogisticsData = async () => {
    try {
      setLoading(true);
      const [zonesRes, citiesRes] = await Promise.all([
        supabase
          .from('delivery_zones')
          .select('id, name, is_active, delivery_fee, city_id, cities(name)')
          .order('name'),
        supabase
          .from('cities')
          .select('id, name, is_active')
          .order('name'),
      ]);

      if (zonesRes.error) throw zonesRes.error;
      if (citiesRes.error) throw citiesRes.error;

      setZones(zonesRes.data || []);
      setCities(citiesRes.data || []);
      if (citiesRes.data && citiesRes.data.length > 0 && !newZoneCityId) {
        setNewZoneCityId(citiesRes.data[0].id);
      }
    } catch (err: any) {
      console.warn('[AdminLogisticsTab] Fetch error:', err);
      toast.error('Failed to load logistics config', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
  }, []);

  const handleToggleZoneActive = async (zone: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextState = !zone.is_active;
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ is_active: nextState })
        .eq('id', zone.id);

      if (error) throw error;
      setZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, is_active: nextState } : z))
      );
      toast.success(nextState ? 'Zone Activated' : 'Zone Deactivated');
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    }
  };

  const handleSaveEditFee = async () => {
    if (!editingZone) return;
    const num = parseFloat(editFeeVal);
    if (isNaN(num) || num < 0) {
      toast.warning('Invalid Amount', { description: 'Please enter a valid numeric delivery fee.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ delivery_fee: num })
        .eq('id', editingZone.id);

      if (error) throw error;
      toast.success('Delivery Fee Updated');
      setEditingZone(null);
      fetchLogisticsData();
    } catch (err: any) {
      toast.error('Update Failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateZone = async () => {
    if (!newZoneName.trim() || !newZoneCityId) {
      toast.warning('Missing Fields', { description: 'Please enter a zone name and select a city.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('delivery_zones').insert({
        name: newZoneName.trim(),
        city_id: newZoneCityId,
        delivery_fee: parseFloat(newZoneFee) || 0,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Delivery Zone Added');
      setNewZoneName('');
      setNewZoneFee('');
      setIsAddZoneOpen(false);
      fetchLogisticsData();
    } catch (err: any) {
      toast.error('Creation Failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCity = async () => {
    if (!newCityName.trim()) {
      toast.warning('Missing City Name', { description: 'Please enter a city name.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('cities').insert({
        name: newCityName.trim(),
        is_active: true,
      });

      if (error) throw error;
      toast.success('City Added');
      setNewCityName('');
      setIsAddCityOpen(false);
      fetchLogisticsData();
    } catch (err: any) {
      toast.error('Creation Failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const formatNaira = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const totalZonesPages = Math.ceil(zones.length / PAGE_SIZE) || 1;
  const paginatedZones = zones.slice(
    (zonesPage - 1) * PAGE_SIZE,
    zonesPage * PAGE_SIZE
  );

  const totalCitiesPages = Math.ceil(cities.length / PAGE_SIZE) || 1;
  const paginatedCities = cities.slice(
    (citiesPage - 1) * PAGE_SIZE,
    citiesPage * PAGE_SIZE
  );

  return (
    <View style={styles.container}>
      {/* Sub-Tabs: Delivery Zones vs Cities */}
      <View style={styles.tabToggleRow}>
        <TouchableOpacity
          style={[styles.tabToggleBtn, activeSubTab === 'zones' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveSubTab('zones');
          }}
          activeOpacity={0.8}
        >
          <MapPin size={16} color={activeSubTab === 'zones' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              activeSubTab === 'zones' && styles.tabToggleTextActive,
            ]}
          >
            Delivery Zones ({zones.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabToggleBtn, activeSubTab === 'cities' && styles.tabToggleBtnActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveSubTab('cities');
          }}
          activeOpacity={0.8}
        >
          <Compass size={16} color={activeSubTab === 'cities' ? '#FFFFFF' : '#64748B'} />
          <Text
            style={[
              styles.tabToggleText,
              activeSubTab === 'cities' && styles.tabToggleTextActive,
            ]}
          >
            Cities ({cities.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Add Button */}
      <View style={styles.actionBar}>
        <Button
          title={activeSubTab === 'zones' ? 'Add Delivery Zone' : 'Add City'}
          icon={Plus}
          onPress={() => {
            if (activeSubTab === 'zones') setIsAddZoneOpen(true);
            else setIsAddCityOpen(true);
          }}
          style={{ height: 42 }}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading logistics network...</Text>
        </View>
      ) : activeSubTab === 'zones' ? (
        <View style={styles.list}>
          {paginatedZones.map((zone) => (
            <View key={zone.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.zoneIconBox}>
                  <MapPin size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{zone.name}</Text>
                  <Text style={styles.cardSub}>
                    City: {zone.cities?.name || 'General Area'} &bull;{' '}
                    {formatNaira(zone.delivery_fee)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEditingZone(zone);
                    setEditFeeVal((zone.delivery_fee || 0).toString());
                  }}
                  activeOpacity={0.7}
                >
                  <Edit2 size={15} color="#475569" />
                </TouchableOpacity>

                <Switch
                  value={zone.is_active}
                  onValueChange={() => handleToggleZoneActive(zone)}
                  trackColor={{ false: '#E2E8F0', true: colors.primaryBorder }}
                  thumbColor={zone.is_active ? colors.primary : '#FFFFFF'}
                />
              </View>
            </View>
          ))}

          <AdminPagination
            currentPage={zonesPage}
            totalPages={totalZonesPages}
            totalItems={zones.length}
            onPageChange={setZonesPage}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {paginatedCities.map((city) => (
            <View key={city.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.zoneIconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Compass size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{city.name}</Text>
                  <Text style={styles.cardSub}>
                    Status: {city.is_active ? 'Active Market' : 'Inactive'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <View style={styles.cityPill}>
                  <Text style={styles.cityPillText}>
                    {city.is_active ? 'ENABLED' : 'PAUSED'}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <AdminPagination
            currentPage={citiesPage}
            totalPages={totalCitiesPages}
            totalItems={cities.length}
            onPageChange={setCitiesPage}
          />
        </View>
      )}

      {/* Edit Zone Delivery Fee Modal */}
      <AppModal
        visible={editingZone !== null}
        onClose={() => setEditingZone(null)}
        title="Edit Zone Delivery Fee"
      >
        {editingZone && (
          <View style={styles.modalContent}>
            <Text style={styles.modalZoneName}>{editingZone.name}</Text>
            <Text style={styles.modalZoneSub}>
              City: {editingZone.cities?.name || 'General City'}
            </Text>

            <Text style={styles.inputLabel}>Flat Delivery Fee (₦)</Text>
            <TextInput
              placeholder="e.g. 1500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={styles.textInput}
              value={editFeeVal}
              onChangeText={setEditFeeVal}
            />

            <Button
              title="Save Delivery Fee"
              onPress={handleSaveEditFee}
              loading={saving}
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </AppModal>

      {/* Add Zone Modal */}
      <AppModal
        visible={isAddZoneOpen}
        onClose={() => setIsAddZoneOpen(false)}
        title="Add Delivery Zone"
      >
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>Zone Name</Text>
          <TextInput
            placeholder="e.g. Lekki Phase 1 / Victoria Island"
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
            value={newZoneName}
            onChangeText={setNewZoneName}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Select City</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityPickerScroll}>
            {cities.map((c) => {
              const active = newZoneCityId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.cityPickerChip, active && styles.cityPickerChipActive]}
                  onPress={() => setNewZoneCityId(c.id)}
                >
                  <Text style={[styles.cityPickerText, active && styles.cityPickerTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Default Delivery Fee (₦)</Text>
          <TextInput
            placeholder="e.g. 1500"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            style={styles.textInput}
            value={newZoneFee}
            onChangeText={setNewZoneFee}
          />

          <Button
            title="Create Delivery Zone"
            onPress={handleCreateZone}
            loading={saving}
            style={{ marginTop: 18 }}
          />
        </View>
      </AppModal>

      {/* Add City Modal */}
      <AppModal
        visible={isAddCityOpen}
        onClose={() => setIsAddCityOpen(false)}
        title="Add Operational City"
      >
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>City Name</Text>
          <TextInput
            placeholder="e.g. Abuja, Port Harcourt, Ibadan..."
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
            value={newCityName}
            onChangeText={setNewCityName}
          />

          <Button
            title="Add City"
            onPress={handleCreateCity}
            loading={saving}
            style={{ marginTop: 18 }}
          />
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    gap: 6,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  tabToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
  },
  actionBar: {
    marginBottom: 12,
  },
  loaderWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  zoneIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cityPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalZoneName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalZoneSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: '#F8FAFC',
  },
  cityPickerScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cityPickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  cityPickerChipActive: {
    backgroundColor: colors.primary,
  },
  cityPickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  cityPickerTextActive: {
    color: '#FFFFFF',
  },
});
