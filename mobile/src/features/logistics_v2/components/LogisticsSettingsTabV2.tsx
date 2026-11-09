import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  User,
  Truck,
  Landmark,
  BellRing,
  MapPin,
  Shield,
  LogOut,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  Phone,
  Sparkles,
  Package,
  Banknote,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  triggerRiderMissionAlertAsync,
  triggerRiderEarningsAlertAsync,
} from '../../../services/notifications';

const VEHICLE_OPTIONS = [
  { id: 'Motorcycle', label: 'Motorcycle / Bike', icon: '🏍️', desc: 'Fast parcels & food' },
  { id: 'Bicycle', label: 'Bicycle', icon: '🚲', desc: 'Short campus/city runs' },
  { id: 'Car/Sedan', label: 'Car / Sedan', icon: '🚗', desc: 'Standard boxed items' },
  { id: 'Van/Mini-bus', label: 'Van / Mini-bus', icon: '🚐', desc: 'Bulky & wholesale loads' },
  { id: 'Truck/Delivery Van', label: 'Truck / Haulage', icon: '🚚', desc: 'Heavy freight & cargo' },
];

export function LogisticsSettingsTabV2() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState((profile as any)?.is_online || false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Profile Edit Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [fullName, setFullName] = useState(profile?.display_name || profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || (profile as any)?.phone_number || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Vehicle Modal State
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('Motorcycle');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Bank Settlement Modal State
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankName, setBankName] = useState((profile as any)?.payout_bank_name || '');
  const [accountNumber, setAccountNumber] = useState((profile as any)?.payout_account_number || '');
  const [accountName, setAccountName] = useState((profile as any)?.payout_account_name || '');
  const [savingBank, setSavingBank] = useState(false);

  // Operating Zone Modal State
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>(profile?.city_id || '');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(profile?.zone_id || '');
  const [savingZone, setSavingZone] = useState(false);

  // Notification Toggles
  const [notifSettings, setNotifSettings] = useState({
    new_order: true,
    order_delivered: true,
    issue_reported: true,
    promoter_earnings: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Modern Sign Out Modal State
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch latest profile
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (pData) {
        setIsOnline(pData.is_online || false);
        setFullName(pData.display_name || pData.full_name || '');
        setPhone(pData.phone || pData.phone_number || '');
        setAddress(pData.address || '');
        setBankName(pData.payout_bank_name || '');
        setAccountNumber(pData.payout_account_number || '');
        setAccountName(pData.payout_account_name || '');
        setSelectedCityId(pData.city_id || '');
        setSelectedZoneId(pData.zone_id || '');
      }

      // 2. Fetch logistics details
      const { data: logDetails } = await (supabase as any)
        .from('logistics_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (logDetails) {
        if (logDetails.vehicle_type) setSelectedVehicle(logDetails.vehicle_type);
        if (logDetails.notification_settings) {
          setNotifSettings((prev) => ({ ...prev, ...logDetails.notification_settings }));
        }
      }

      // 3. Fetch cities and zones for territory selection
      const [citiesRes, zonesRes] = await Promise.all([
        supabase.from('cities').select('*').order('name'),
        supabase.from('delivery_zones').select('*').order('name'),
      ]);

      if (citiesRes.data) setCities(citiesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
    } catch (e) {
      console.warn('[LogisticsSettings] Error fetching settings:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Online / Offline Toggle
  const handleToggleOnline = async (val: boolean) => {
    if (!user) return;
    try {
      setTogglingOnline(true);
      setIsOnline(val);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await (supabase as any)
        .from('profiles')
        .update({ is_online: val, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(val ? 'Online for Missions' : 'Offline Mode', {
        description: val
          ? 'You can now receive dispatch missions and radar alerts.'
          : 'Mission radar is paused. Take a break!',
      });
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      setIsOnline(!val);
      toast.error('Status Error', { description: e?.message || 'Could not update online status.' });
    } finally {
      setTogglingOnline(false);
    }
  };

  // Save Profile Details
  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Validation Error', { description: 'Full name is required.' });
      return;
    }
    try {
      setSavingProfile(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile Saved', { description: 'Your rider identity details were updated.' });
      setProfileModalVisible(false);
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      toast.error('Profile Error', { description: e?.message || 'Failed to save profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Sign Out Handlers (Modern Confirmation Modal)
  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSignOutModalVisible(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setSigningOut(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setSignOutModalVisible(false);
      await signOut();
    } catch (e: any) {
      toast.error('Sign Out Failed', { description: e?.message || 'Could not sign out.' });
    } finally {
      setSigningOut(false);
    }
  };

  // Save Vehicle
  const handleSaveVehicle = async () => {
    if (!user) return;
    try {
      setSavingVehicle(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await (supabase as any)
        .from('logistics_details')
        .upsert(
          {
            user_id: user.id,
            vehicle_type: selectedVehicle,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      toast.success('Vehicle Updated', { description: `Your primary delivery vehicle is now ${selectedVehicle}.` });
      setVehicleModalVisible(false);
    } catch (e: any) {
      toast.error('Vehicle Error', { description: e?.message || 'Failed to save vehicle.' });
    } finally {
      setSavingVehicle(false);
    }
  };

  // Save Bank Details
  const handleSaveBank = async () => {
    if (!user) return;
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast.error('Missing Info', { description: 'Please provide Bank Name, 10-digit Account Number, and Account Name.' });
      return;
    }
    if (accountNumber.trim().length < 10) {
      toast.error('Account Number', { description: 'Nigerian bank account numbers must be 10 digits.' });
      return;
    }

    try {
      setSavingBank(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('profiles')
        .update({
          payout_bank_name: bankName.trim(),
          payout_account_number: accountNumber.trim(),
          payout_account_name: accountName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Settlement Bank Saved', { description: 'Earnings withdrawals will deposit directly here.' });
      setBankModalVisible(false);
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      toast.error('Bank Sync Error', { description: e?.message || 'Could not save bank details.' });
    } finally {
      setSavingBank(false);
    }
  };

  // Save Working Zone
  const handleSaveZone = async () => {
    if (!user) return;
    try {
      setSavingZone(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          city_id: selectedCityId || null,
          zone_id: selectedZoneId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Zone Saved', { description: 'Your dispatch zone preference has been set.' });
      setZoneModalVisible(false);
      if (refreshProfile) refreshProfile();
    } catch (e: any) {
      toast.error('Zone Error', { description: e?.message || 'Could not save operating zone.' });
    } finally {
      setSavingZone(false);
    }
  };

  // Save Notification Preference Toggle
  const toggleNotification = async (key: keyof typeof notifSettings) => {
    if (!user) return;
    const next = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await (supabase as any)
        .from('logistics_details')
        .upsert(
          {
            user_id: user.id,
            notification_settings: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch (e) {
      console.warn('Error updating notif:', e);
    }
  };

  const currentCityName = cities.find((c) => c.id === selectedCityId)?.name || 'Default Territory';
  const currentZoneName = zones.find((z) => z.id === selectedZoneId)?.name || 'All Zones';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Logistics Settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchSettings();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* 1. Header & Online Mode Card */}
      <View style={styles.onlineCard}>
        <View style={styles.onlineInfo}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#94A3B8' }]} />
          <View>
            <Text style={styles.onlineTitle}>
              {isOnline ? 'Rider Status: ACTIVE' : 'Rider Status: OFFLINE'}
            </Text>
            <Text style={styles.onlineSub}>
              {isOnline ? 'Ready to accept nearby deliveries' : 'Turn switch on to receive missions'}
            </Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggleOnline}
          trackColor={{ false: '#E2E8F0', true: '#10B981' }}
          thumbColor="#FFFFFF"
          disabled={togglingOnline}
        />
      </View>

      {/* 2. Rider Profile Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7F2' }]}>
              <User size={20} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Rider Profile</Text>
              <Text style={styles.cardSubtitle}>Personal details & contact info</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setProfileModalVisible(true);
            }}
          >
            <Text style={styles.editActionText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileDetailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Full Name</Text>
            <Text style={styles.detailValue}>{fullName || 'Not configured'}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{phone || 'Not added'}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base Address</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {address || 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Delivery Fleet / Vehicle Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Truck size={20} color="#16A34A" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Delivery Vehicle</Text>
              <Text style={styles.cardSubtitle}>Your transport mode for orders</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setVehicleModalVisible(true);
            }}
          >
            <Text style={styles.editActionText}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.vehicleSelectedBox}>
          <Text style={styles.vehicleSelectedIcon}>
            {VEHICLE_OPTIONS.find((v) => v.id === selectedVehicle)?.icon || '🏍️'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleSelectedTitle}>
              {VEHICLE_OPTIONS.find((v) => v.id === selectedVehicle)?.label || selectedVehicle}
            </Text>
            <Text style={styles.vehicleSelectedDesc}>
              {VEHICLE_OPTIONS.find((v) => v.id === selectedVehicle)?.desc || 'Standard parcel delivery'}
            </Text>
          </View>
          <View style={styles.vehicleBadge}>
            <CheckCircle2 size={14} color="#16A34A" />
            <Text style={styles.vehicleBadgeText}>Selected</Text>
          </View>
        </View>
      </View>

      {/* 4. Bank Settlement / Payout Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Landmark size={20} color="#059669" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Bank Settlement</Text>
              <Text style={styles.cardSubtitle}>Where we send your earnings</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBankModalVisible(true);
            }}
          >
            <Text style={styles.editActionText}>{bankName ? 'Change' : 'Set Up'}</Text>
          </TouchableOpacity>
        </View>

        {bankName && accountNumber ? (
          <View style={styles.bankConfiguredBox}>
            <View style={styles.bankIconPill}>
              <CreditCard size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankNameText}>{bankName}</Text>
              <Text style={styles.bankAccountText}>
                •••• •••• {accountNumber.slice(-4)} ({accountName})
              </Text>
            </View>
            <View style={styles.bankActivePill}>
              <Text style={styles.bankActiveText}>READY</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.bankEmptyBox}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBankModalVisible(true);
            }}
          >
            <AlertCircle size={20} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.bankEmptyTitle}>No Bank Account Linked</Text>
              <Text style={styles.bankEmptySub}>Tap to configure direct bank withdrawal</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 5. Operating Territory Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MapPin size={20} color="#2563EB" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Working Territory</Text>
              <Text style={styles.cardSubtitle}>Your active city and delivery zone</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setZoneModalVisible(true);
            }}
          >
            <Text style={styles.editActionText}>Update</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.zoneDisplayBox}>
          <View style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>City Coverage:</Text>
            <Text style={styles.zoneValue}>{currentCityName}</Text>
          </View>
          <View style={styles.zoneDivider} />
          <View style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>Assigned Zone:</Text>
            <Text style={styles.zoneValue}>{currentZoneName}</Text>
          </View>
        </View>
      </View>

      {/* 6. Push Notifications Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <BellRing size={20} color="#D97706" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Dispatch Alerts</Text>
              <Text style={styles.cardSubtitle}>Mission reminders and updates</Text>
            </View>
          </View>
        </View>

        <View style={styles.notifTogglesContainer}>
          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>New Mission Alerts</Text>
              <Text style={styles.notifSub}>Notify when a nearby order is ready for pickup</Text>
            </View>
            <Switch
              value={notifSettings.new_order}
              onValueChange={() => toggleNotification('new_order')}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Escrow & Fee Credited</Text>
              <Text style={styles.notifSub}>Notify upon order completion and wallet deposit</Text>
            </View>
            <Switch
              value={notifSettings.promoter_earnings}
              onValueChange={() => toggleNotification('promoter_earnings')}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Delivery Status Updates</Text>
              <Text style={styles.notifSub}>Confirmation when buyer confirms receipt</Text>
            </View>
            <Switch
              value={notifSettings.order_delivered}
              onValueChange={() => toggleNotification('order_delivered')}
              trackColor={{ false: '#E2E8F0', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          {/* Test Push Popups Row */}
          <View style={{ paddingTop: 6 }}>
            <Text style={styles.testNotifHeaderTitle}>
              Test Phone Push Alerts
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                style={styles.testNotifBtn}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await triggerRiderMissionAlertAsync({
                    orderId: 'DEMO-8821',
                    payout: 2500,
                    pickupAddress: 'Victoria Island Central, Lagos',
                  });
                  toast.success('Mission Push Alert Sent', {
                    description: 'Heads-up notification triggered on your phone!',
                  });
                }}
                activeOpacity={0.8}
              >
                <Package size={13} color="#E96F28" strokeWidth={2.5} />
                <Text style={styles.testNotifBtnText}>Test Mission Push</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testNotifBtn, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await triggerRiderEarningsAlertAsync({
                    type: 'balance',
                    amount: 3200,
                    orderId: 'DEMO-8821',
                  });
                  toast.success('Earnings Push Alert Sent', {
                    description: 'Heads-up notification triggered on your phone!',
                  });
                }}
                activeOpacity={0.8}
              >
                <Banknote size={13} color="#16A34A" strokeWidth={2.5} />
                <Text style={[styles.testNotifBtnText, { color: '#16A34A' }]}>Test Earning Push</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* 7. Sign Out Section */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
        <Text style={styles.signOutText}>Sign Out of Rider Account</Text>
      </TouchableOpacity>



      {/* MODAL 1: Edit Profile (Modern Bottom Sheet + Keyboard Safe) */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setProfileModalVisible(false)}
              activeOpacity={1}
            />
          </View>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconPill, { backgroundColor: '#FFF7F2' }]}>
                  <User size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Edit Rider Profile</Text>
                  <Text style={styles.sheetSubtitle}>Update your name and primary phone</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>FULL LEGAL NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Ibrahim Musa"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={11}
                  placeholder="e.g. 08012345678"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>RESIDENTIAL / BASE ADDRESS</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street name, neighborhood, city"
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.submitActionBtn, savingProfile && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitActionText}>SAVE PROFILE</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: Change Vehicle (Modern Bottom Sheet) */}
      <Modal
        visible={vehicleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setVehicleModalVisible(false)}
              activeOpacity={1}
            />
          </View>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconPill, { backgroundColor: '#F0FDF4' }]}>
                  <Truck size={20} color="#16A34A" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Delivery Vehicle</Text>
                  <Text style={styles.sheetSubtitle}>Choose what you use for deliveries</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setVehicleModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {VEHICLE_OPTIONS.map((item) => {
                const isChosen = selectedVehicle === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.vehicleOptionCard, isChosen && styles.vehicleOptionCardActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedVehicle(item.id);
                    }}
                  >
                    <Text style={styles.vehicleOptionEmoji}>{item.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.vehicleOptionLabel,
                          isChosen && { color: colors.primary, fontWeight: '800' },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.vehicleOptionDesc}>{item.desc}</Text>
                    </View>
                    {isChosen ? (
                      <CheckCircle2 size={20} color={colors.primary} />
                    ) : (
                      <View style={styles.vehicleOptionUnselectedCircle} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.submitActionBtn, savingVehicle && { opacity: 0.6 }]}
                onPress={handleSaveVehicle}
                disabled={savingVehicle}
              >
                {savingVehicle ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitActionText}>CONFIRM VEHICLE</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Bank Settlement Details (Modern Bottom Sheet + Keyboard Safe) */}
      <Modal
        visible={bankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setBankModalVisible(false)}
              activeOpacity={1}
            />
          </View>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconPill, { backgroundColor: '#ECFDF5' }]}>
                  <Landmark size={20} color="#059669" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Payment Bank Account</Text>
                  <Text style={styles.sheetSubtitle}>Where we send your withdrawal earnings</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setBankModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.bankSecurityBanner}>
                <Shield size={16} color="#059669" />
                <Text style={styles.bankSecurityText}>
                  Bank credentials are encrypted & used exclusively for Rider fee deposits.
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>BANK NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. GTBank, Zenith, Access, Kuda"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>10-DIGIT ACCOUNT NUMBER</Text>
                <TextInput
                  style={[styles.textInput, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' }]}
                  value={accountNumber}
                  onChangeText={(val) => setAccountNumber(val.replace(/\D/g, ''))}
                  placeholder="0123456789"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>ACCOUNT HOLDER NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Full name as registered on bank"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitActionBtn, { backgroundColor: '#059669' }, savingBank && { opacity: 0.6 }]}
                onPress={handleSaveBank}
                disabled={savingBank}
              >
                {savingBank ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitActionText}>SAVE BANK DETAILS</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 4: Working Zone Territory (Modern Bottom Sheet) */}
      <Modal
        visible={zoneModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setZoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setZoneModalVisible(false)}
              activeOpacity={1}
            />
          </View>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconPill, { backgroundColor: '#EFF6FF' }]}>
                  <MapPin size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Operating Territory</Text>
                  <Text style={styles.sheetSubtitle}>Select your primary base city</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setZoneModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionPillHeader}>SELECT CITY</Text>
              <View style={styles.chipsContainer}>
                {cities.map((c) => {
                  const isCitySelected = selectedCityId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chipItem, isCitySelected && styles.chipItemSelected]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCityId(c.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipItemText,
                          isCitySelected && styles.chipItemTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionPillHeader, { marginTop: 16 }]}>SELECT ZONE</Text>
              <View style={styles.chipsContainer}>
                <TouchableOpacity
                  style={[styles.chipItem, !selectedZoneId && styles.chipItemSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedZoneId('');
                  }}
                >
                  <Text
                    style={[
                      styles.chipItemText,
                      !selectedZoneId && styles.chipItemTextSelected,
                    ]}
                  >
                    All Zones (Entire City)
                  </Text>
                </TouchableOpacity>

                {zones
                  .filter((z) => !selectedCityId || z.city_id === selectedCityId)
                  .map((z) => {
                    const isZoneSelected = selectedZoneId === z.id;
                    return (
                      <TouchableOpacity
                        key={z.id}
                        style={[styles.chipItem, isZoneSelected && styles.chipItemSelected]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedZoneId(z.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.chipItemText,
                            isZoneSelected && styles.chipItemTextSelected,
                          ]}
                        >
                          {z.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <TouchableOpacity
                style={[styles.submitActionBtn, { backgroundColor: '#2563EB', marginTop: 24 }, savingZone && { opacity: 0.6 }]}
                onPress={handleSaveZone}
                disabled={savingZone}
              >
                {savingZone ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitActionText}>SAVE TERRITORY</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: Modern Sign Out Confirmation Bottom Sheet */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!signingOut) setSignOutModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!signingOut) setSignOutModalVisible(false);
              }}
              activeOpacity={1}
            />
          </View>

          <View style={styles.bottomSheetContainer}>
            <View style={styles.grabHandle} />

            <View style={styles.signOutSheetContent}>
              <View style={styles.signOutIconWrapper}>
                <LogOut size={28} color="#DC2626" strokeWidth={2.4} />
              </View>

              <Text style={styles.signOutSheetTitle}>Sign Out</Text>
              <Text style={styles.signOutSheetSubtitle}>
                Are you sure you want to sign out of Linkup Logistics?
              </Text>

              <View style={styles.signOutWarningBox}>
                <AlertCircle size={16} color="#D97706" strokeWidth={2.2} />
                <Text style={styles.signOutWarningText}>
                  You will not be able to recieve any mission notifications untill you log in back.
                </Text>
              </View>

              <View style={styles.signOutActionsRow}>
                <TouchableOpacity
                  style={styles.signOutCancelBtn}
                  onPress={() => setSignOutModalVisible(false)}
                  disabled={signingOut}
                  activeOpacity={0.8}
                >
                  <Text style={styles.signOutCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.signOutConfirmBtn, signingOut && { opacity: 0.6 }]}
                  onPress={handleConfirmSignOut}
                  disabled={signingOut}
                  activeOpacity={0.8}
                >
                  {signingOut ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <LogOut size={16} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.signOutConfirmText}>Sign Out</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 64,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  // Online Card
  onlineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  onlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  onlineTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  onlineSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },

  // General Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  editActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Profile Details Box
  profileDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },

  // Vehicle Selected Box
  vehicleSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  vehicleSelectedIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  vehicleSelectedTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#14532D',
  },
  vehicleSelectedDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 2,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  vehicleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    textTransform: 'uppercase',
  },

  // Bank Box
  bankConfiguredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  bankIconPill: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#064E3B',
  },
  bankAccountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  bankActivePill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bankActiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bankEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bankEmptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  bankEmptySub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#B45309',
    marginTop: 2,
  },

  // Territory Box
  zoneDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  zoneValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2563EB',
  },
  zoneDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },

  // Notifications
  notifTogglesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notifLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  notifSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    paddingRight: 10,
  },
  notifDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },

  // Sign out & footer
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  footerVersionBox: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  footerVersionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerVersionSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#CBD5E1',
    marginTop: 2,
  },

  // Bottom Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  grabHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIconPill: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Form Fields
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  textInput: {
    height: 52,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  submitActionBtn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Vehicle Option in Modal
  vehicleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  vehicleOptionCardActive: {
    backgroundColor: '#FFF7F2',
    borderColor: colors.primary,
  },
  vehicleOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  vehicleOptionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleOptionDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  vehicleOptionUnselectedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },

  // Bank Security Banner
  bankSecurityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  bankSecurityText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 16,
  },

  // Chips in Territory Modal
  sectionPillHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipItemSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  chipItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  testNotifHeaderTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  testNotifBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  testNotifBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },

  // Modern Sign Out Confirmation Sheet
  signOutSheetContent: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  signOutIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#FEF2F2',
  },
  signOutSheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  signOutSheetSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  signOutWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
    width: '100%',
  },
  signOutWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  signOutActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signOutCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  signOutConfirmBtn: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
