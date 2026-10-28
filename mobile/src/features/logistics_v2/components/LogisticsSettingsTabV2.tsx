import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
  Animated,
  Easing,
} from 'react-native';
import {
  User,
  Truck,
  Landmark,
  BellRing,
  MapPin,
  Shield,
  ShieldCheck,
  LogOut,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  Sparkles,
  Package,
  Banknote,
  Camera,
  Check,
  Lock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  prepareImageForUpload,
  uploadImageToStorage,
} from '../../seller/utils/sellerUtils';
import {
  triggerRiderMissionAlertAsync,
  triggerRiderEarningsAlertAsync,
} from '../../../services/notifications';

const VEHICLE_OPTIONS = [
  { id: 'Motorcycle', label: 'Motorcycle / Bike', icon: '🏍️', desc: 'Fast parcels & food dispatches' },
  { id: 'Bicycle', label: 'Bicycle', icon: '🚲', desc: 'Short campus & dense city runs' },
  { id: 'Car/Sedan', label: 'Car / Sedan', icon: '🚗', desc: 'Standard & boxed marketplace items' },
  { id: 'Van/Mini-bus', label: 'Van / Mini-bus', icon: '🚐', desc: 'Bulky, cartons & wholesale loads' },
  { id: 'Truck/Delivery Van', label: 'Truck / Haulage', icon: '🚚', desc: 'Heavy freight, furniture & cargo' },
];

/**
 * Reusable Framer Motion-style Spring Bottom Sheet Modal
 * Delivers buttery smooth backdrop fade, spring scale/slide pop-in, and graceful dismiss
 */
interface SmoothSpringModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  children: React.ReactNode;
  keyboardAvoiding?: boolean;
}

function SmoothSpringModal({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconBg,
  children,
  keyboardAvoiding = false,
}: SmoothSpringModalProps) {
  const [rendered, setRendered] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(380)).current;
  const sheetScale = useRef(new Animated.Value(0.93)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      backdropAnim.setValue(0);
      sheetTranslateY.setValue(380);
      sheetScale.setValue(0.93);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 24,
          stiffness: 240,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.spring(sheetScale, {
          toValue: 1,
          damping: 24,
          stiffness: 240,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 380,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
      });
    }
  }, [visible]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 380,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRendered(false);
      onClose();
    });
  };

  if (!rendered) return null;

  const content = (
    <View style={modalStyles.overlay}>
      <Animated.View style={[modalStyles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        style={[
          modalStyles.sheetContainer,
          {
            transform: [
              { translateY: sheetTranslateY },
              { scale: sheetScale },
            ],
          },
        ]}
      >
        <View style={modalStyles.grabHandle} />

        {title ? (
          <View style={modalStyles.sheetHeader}>
            <View style={modalStyles.sheetHeaderLeft}>
              {icon && (
                <View style={[modalStyles.iconPill, { backgroundColor: iconBg || '#FFF7ED' }]}>
                  {icon}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.sheetTitle} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={modalStyles.sheetSubtitle}>{subtitle}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={modalStyles.sheetCloseBtn}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : null}

        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}

export function LogisticsSettingsTabV2({
  onScroll,
  onSettingsUpdated,
}: {
  onScroll?: (e: any) => void;
  onSettingsUpdated?: () => void;
} = {}) {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Avatar Management
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Verification status
  const [kycStatus, setKycStatus] = useState<string>('verified');

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
        setFullName(pData.display_name || pData.full_name || '');
        setPhone(pData.phone || pData.phone_number || '');
        setAddress(pData.address || '');
        setBankName(pData.payout_bank_name || '');
        setAccountNumber(pData.payout_account_number || '');
        setAccountName(pData.payout_account_name || '');
        setSelectedCityId(pData.city_id || '');
        setSelectedZoneId(pData.zone_id || '');
        if (pData.avatar_url) setAvatarUri(pData.avatar_url);
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

      // 3. Fetch verification / KYC status
      const { data: kycData } = await (supabase as any)
        .from('logistics_kyc')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (kycData?.status) {
        setKycStatus(kycData.status);
      } else if (pData?.is_verified) {
        setKycStatus('verified');
      }

      // 4. Fetch cities and zones for territory selection
      const [citiesRes, zonesRes] = await Promise.all([
        supabase.from('cities').select('*').order('name'),
        supabase.from('zones').select('*').order('name'),
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

  // Pick / Change Avatar Photo
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri && user) {
        setUploadingAvatar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const localUri = result.assets[0].uri;
        const filename = `${user.id}/courier_avatar_${Date.now()}.jpg`;
        const prepared = await prepareImageForUpload(
          localUri,
          (result.assets[0] as any).fileSize
        );
        setAvatarUri(prepared.uri);

        const publicUrl = await uploadImageToStorage(
          prepared.uri,
          'avatars',
          filename,
          true
        );

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (error) throw error;
        setAvatarUri(publicUrl);
        toast.success('Photo Updated', { description: 'Your courier profile photo has been refreshed.' });
        if (refreshProfile) refreshProfile();
        onSettingsUpdated?.();
      }
    } catch (e: any) {
      toast.error('Upload Failed', { description: e?.message || 'Could not update profile photo.' });
      setAvatarUri(profile?.avatar_url || null);
    } finally {
      setUploadingAvatar(false);
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

      toast.success('Profile Saved', { description: 'Your courier identity details were updated.' });
      setProfileModalVisible(false);
      if (refreshProfile) refreshProfile();
      onSettingsUpdated?.();
    } catch (e: any) {
      toast.error('Profile Error', { description: e?.message || 'Failed to save profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Sign Out Handlers
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

      toast.success('Vehicle Updated', {
        description: `Primary delivery transport set to ${selectedVehicle}.`,
      });
      setVehicleModalVisible(false);
      onSettingsUpdated?.();
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
      toast.error('Missing Info', {
        description: 'Please provide Bank Name, 10-digit Account Number, and Account Name.',
      });
      return;
    }
    if (accountNumber.trim().length < 10) {
      toast.error('Account Number', {
        description: 'Nigerian bank account numbers must be 10 digits.',
      });
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

      toast.success('Settlement Bank Saved', {
        description: 'Earnings and courier tips will deposit directly here.',
      });
      setBankModalVisible(false);
      if (refreshProfile) refreshProfile();
      onSettingsUpdated?.();
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

      toast.success('Zone Saved', {
        description: 'Your dispatch working territory preference has been set.',
      });
      setZoneModalVisible(false);
      if (refreshProfile) refreshProfile();
      onSettingsUpdated?.();
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

  const currentCityName = cities.find((c) => c.id === selectedCityId)?.name || 'All Cities';
  const currentZoneName = zones.find((z) => z.id === selectedZoneId)?.name || 'All Zones (City-wide)';

  const initials = String(
    fullName || profile?.full_name || profile?.display_name || user?.email || 'R'
  )
    .charAt(0)
    .toUpperCase();

  const riderSnippet = user?.id ? `RD-${user.id.slice(0, 6).toUpperCase()}` : 'RD-COURIER';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FA7E2B" />
        <Text style={styles.loadingText}>Loading Courier Profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchSettings();
          }}
          tintColor="#FA7E2B"
          colors={['#FA7E2B']}
        />
      }
    >


      {/* 3. DELIVERY VEHICLE FLEET CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Truck size={20} color="#16A34A" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Delivery Vehicle Fleet</Text>
              <Text style={styles.cardSubtitle}>Your active transport for dispatches</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setVehicleModalVisible(true);
            }}
          >
            <Text style={styles.editActionText}>Switch</Text>
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
              {VEHICLE_OPTIONS.find((v) => v.id === selectedVehicle)?.desc || 'Standard parcel dispatch'}
            </Text>
          </View>
          <View style={styles.vehicleBadge}>
            <CheckCircle2 size={13} color="#16A34A" strokeWidth={2.5} />
            <Text style={styles.vehicleBadgeText}>ACTIVE</Text>
          </View>
        </View>
      </View>

      {/* 4. SETTLEMENT BANK CARD (MODERN DIGITAL DEBIT DESIGN) */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Landmark size={20} color="#059669" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Settlement & Payout</Text>
              <Text style={styles.cardSubtitle}>Where your mission fees deposit</Text>
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
          <View style={styles.digitalBankCard}>
            {/* Top Row with Chip & Brand */}
            <View style={styles.digitalCardTop}>
              <View style={styles.cardChipWrapper}>
                <View style={styles.cardChip} />
              </View>
              <View style={styles.digitalPayoutReadyPill}>
                <CheckCircle2 size={11} color="#10B981" strokeWidth={3} />
                <Text style={styles.digitalPayoutReadyText}>BANK LINKED</Text>
              </View>
            </View>

            {/* Masked Account Number */}
            <Text style={styles.digitalCardNumber}>
              •••• •••• {accountNumber.slice(-4)}
            </Text>

            {/* Bottom Row */}
            <View style={styles.digitalCardBottom}>
              <View style={{ flex: 1 }}>
                <Text style={styles.digitalCardLabel}>ACCOUNT HOLDER</Text>
                <Text style={styles.digitalCardValue} numberOfLines={1}>
                  {accountName.toUpperCase()}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.digitalCardLabel}>BANK NAME</Text>
                <Text style={styles.digitalCardValue} numberOfLines={1}>
                  {bankName.toUpperCase()}
                </Text>
              </View>
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
            <AlertCircle size={22} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.bankEmptyTitle}>No Settlement Bank Linked</Text>
              <Text style={styles.bankEmptySub}>
                Tap to configure your bank for automatic earnings withdrawal.
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 5. OPERATING DISPATCH TERRITORY */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <MapPin size={20} color="#2563EB" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Dispatch Territory</Text>
              <Text style={styles.cardSubtitle}>Active city & assigned dispatch radius</Text>
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
            <Text style={styles.zoneLabel}>City Coverage</Text>
            <View style={styles.zoneValuePill}>
              <Text style={styles.zoneValueCity}>{currentCityName}</Text>
            </View>
          </View>
          <View style={styles.zoneDivider} />
          <View style={styles.zoneRow}>
            <Text style={styles.zoneLabel}>Assigned Zone</Text>
            <Text style={styles.zoneValueZone}>{currentZoneName}</Text>
          </View>
        </View>
      </View>

      {/* 6. DISPATCH & PUSH ALERTS CARD */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <BellRing size={20} color="#D97706" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Dispatch Alerts</Text>
              <Text style={styles.cardSubtitle}>Real-time mission radar & push sounds</Text>
            </View>
          </View>
        </View>

        <View style={styles.notifTogglesContainer}>
          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>New Mission Radar Alerts</Text>
              <Text style={styles.notifSub}>Sound & popup when nearby parcel is available</Text>
            </View>
            <Switch
              value={notifSettings.new_order}
              onValueChange={() => toggleNotification('new_order')}
              trackColor={{ false: '#E2E8F0', true: '#FA7E2B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Escrow & Earnings Credited</Text>
              <Text style={styles.notifSub}>Instant alert upon mission completion & deposit</Text>
            </View>
            <Switch
              value={notifSettings.promoter_earnings}
              onValueChange={() => toggleNotification('promoter_earnings')}
              trackColor={{ false: '#E2E8F0', true: '#FA7E2B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Delivery Status Confirmations</Text>
              <Text style={styles.notifSub}>Notification when recipient signs & confirms receipt</Text>
            </View>
            <Switch
              value={notifSettings.order_delivered}
              onValueChange={() => toggleNotification('order_delivered')}
              trackColor={{ false: '#E2E8F0', true: '#FA7E2B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.notifDivider} />

          {/* Test Push Popups Row */}
          {/* <View style={{ paddingTop: 6 }}>
            <Text style={styles.testNotifHeaderTitle}>TEST PHONE PUSH NOTIFICATIONS</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
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
                <Package size={14} color="#FA7E2B" strokeWidth={2.5} />
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
                <Banknote size={14} color="#16A34A" strokeWidth={2.5} />
                <Text style={[styles.testNotifBtnText, { color: '#16A34A' }]}>
                  Test Earning Push
                </Text>
              </TouchableOpacity>
            </View>
          </View> */}
        </View>
      </View>

      {/* 7. SIGN OUT SECTION */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.85}
      >
        <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
        <Text style={styles.signOutText}>Sign Out of Courier Account</Text>
      </TouchableOpacity>

      {/* Footer Info */}
      <View style={styles.footerVersionBox}>
        <View style={styles.footerSecureRow}>
          <Lock size={11} color="#94A3B8" />
          <Text style={styles.footerVersionText}>LINKUP LOGISTICS COURIER v2.4.0</Text>
        </View>
        <Text style={styles.footerVersionSub}>
          Secured by LinkUp Escrow & Supabase Infrastructure
        </Text>
      </View>

      {/* Spacer to protect against bottom navigation overlay */}
      <View style={{ height: 120 }} />

      {/* ============================================================== */}
      {/* MODAL 1: Edit Profile (Smooth Framer Motion Spring Sheet) */}
      {/* ============================================================== */}
      <SmoothSpringModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        title="Edit Courier Identity"
        subtitle="Update legal full name, phone number, and dispatch address"
        icon={<User size={20} color="#FA7E2B" />}
        iconBg="#FFF7ED"
        keyboardAvoiding
      >
        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ paddingBottom: 20 }}
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
            <Text style={styles.inputLabel}>DISPATCH BASE ADDRESS</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
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
              <Text style={styles.submitActionText}>SAVE COURIER IDENTITY</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SmoothSpringModal>

      {/* ============================================================== */}
      {/* MODAL 2: Change Vehicle (Smooth Framer Motion Spring Sheet) */}
      {/* ============================================================== */}
      <SmoothSpringModal
        visible={vehicleModalVisible}
        onClose={() => setVehicleModalVisible(false)}
        title="Delivery Vehicle Fleet"
        subtitle="Choose the active transport mode used for your missions"
        icon={<Truck size={20} color="#16A34A" />}
        iconBg="#F0FDF4"
      >
        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ paddingBottom: 20 }}
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
                      isChosen && { color: '#FA7E2B', fontWeight: '800' },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.vehicleOptionDesc}>{item.desc}</Text>
                </View>
                {isChosen ? (
                  <CheckCircle2 size={22} color="#FA7E2B" />
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
      </SmoothSpringModal>

      {/* ============================================================== */}
      {/* MODAL 3: Bank Settlement Details (Smooth Framer Motion Spring Sheet) */}
      {/* ============================================================== */}
      <SmoothSpringModal
        visible={bankModalVisible}
        onClose={() => setBankModalVisible(false)}
        title="Payment Bank Account"
        subtitle="Where your delivery fees and tips will deposit directly"
        icon={<Landmark size={20} color="#059669" />}
        iconBg="#ECFDF5"
        keyboardAvoiding
      >
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingBottom: 20 }}
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
              placeholder="e.g. GTBank, Zenith, Access, Kuda, OPay"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>10-DIGIT ACCOUNT NUMBER</Text>
            <TextInput
              style={[
                styles.textInput,
                { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' },
              ]}
              value={accountNumber}
              onChangeText={(val) => setAccountNumber(val.replace(/\D/g, ''))}
              placeholder="0123456789"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>ACCOUNT HOLDER FULL NAME</Text>
            <TextInput
              style={styles.textInput}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Full legal name as registered on bank"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitActionBtn,
              { backgroundColor: '#059669' },
              savingBank && { opacity: 0.6 },
            ]}
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
      </SmoothSpringModal>

      {/* ============================================================== */}
      {/* MODAL 4: Working Zone Territory (Smooth Framer Motion Spring Sheet) */}
      {/* ============================================================== */}
      <SmoothSpringModal
        visible={zoneModalVisible}
        onClose={() => setZoneModalVisible(false)}
        title="Operating Territory"
        subtitle="Select your base city and operating zone for mission alerts"
        icon={<MapPin size={20} color="#2563EB" />}
        iconBg="#EFF6FF"
      >
        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ paddingBottom: 20 }}
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

          <Text style={[styles.sectionPillHeader, { marginTop: 18 }]}>SELECT ZONE</Text>
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
            style={[
              styles.submitActionBtn,
              { backgroundColor: '#2563EB', marginTop: 24 },
              savingZone && { opacity: 0.6 },
            ]}
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
      </SmoothSpringModal>

      {/* ============================================================== */}
      {/* MODAL 5: Sign Out Confirmation (Smooth Framer Motion Spring Sheet) */}
      {/* ============================================================== */}
      <SmoothSpringModal
        visible={signOutModalVisible}
        onClose={() => {
          if (!signingOut) setSignOutModalVisible(false);
        }}
        title="Sign Out"
        subtitle="Confirm you want to log out of LinkUp Logistics"
        icon={<LogOut size={20} color="#DC2626" />}
        iconBg="#FEF2F2"
      >
        <View style={styles.signOutSheetContent}>
          <View style={styles.signOutIconWrapper}>
            <LogOut size={28} color="#DC2626" strokeWidth={2.4} />
          </View>

          <Text style={styles.signOutSheetTitle}>Sign Out</Text>
          <Text style={styles.signOutSheetSubtitle}>
            Are you sure you want to sign out of LinkUp Logistics?
          </Text>

          <View style={styles.signOutWarningBox}>
            <AlertCircle size={16} color="#D97706" strokeWidth={2.2} />
            <Text style={styles.signOutWarningText}>
              You will not receive any mission notifications or radar alerts until you log back in.
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
      </SmoothSpringModal>
    </ScrollView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
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
    flex: 1,
  },
  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
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
    marginLeft: 8,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 120,
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

  // 1. Rider Identity Hero Card
  heroIdentityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(250, 126, 43, 0.15)',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  heroRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#FA7E2B',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF7ED',
    borderWidth: 2.5,
    borderColor: '#FA7E2B',
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FA7E2B',
  },
  avatarInitialsText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FA7E2B',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  identityTextCol: {
    flex: 1,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courierName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  courierPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  courierIdPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  courierIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 0.4,
  },

  // 3-Column Cockpit Specs Row
  cockpitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cockpitCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cockpitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cockpitLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cockpitValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
    textAlign: 'center',
  },
  cockpitDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },

  // General Section Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
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
    marginBottom: 14,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 15,
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
    marginTop: 1,
  },
  editActionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
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
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    maxWidth: '55%',
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
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  vehicleSelectedIcon: {
    fontSize: 26,
    marginRight: 12,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  vehicleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.5,
  },

  // Digital Bank Debit Card
  digitalBankCard: {
    backgroundColor: '#064E3B',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  digitalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardChipWrapper: {
    width: 32,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#D97706',
    padding: 3,
    justifyContent: 'center',
  },
  cardChip: {
    width: '100%',
    height: '65%',
    borderRadius: 3,
    backgroundColor: '#FBBF24',
  },
  digitalPayoutReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  digitalPayoutReadyText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  digitalCardNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ECFDF5',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
    marginBottom: 16,
  },
  digitalCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  digitalCardLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6EE7B7',
    letterSpacing: 0.8,
  },
  digitalCardValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  bankEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
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
    borderRadius: 18,
    padding: 14,
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
  zoneValuePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  zoneValueCity: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563EB',
  },
  zoneValueZone: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  zoneDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },

  // Notifications
  notifTogglesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
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
  testNotifHeaderTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
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
    color: '#FA7E2B',
  },

  // Sign out & footer
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 4,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  footerVersionBox: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 8,
  },
  footerSecureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerVersionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  footerVersionSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#CBD5E1',
    marginTop: 3,
  },

  // Form Fields
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
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
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  // Vehicle Option in Modal
  vehicleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  vehicleOptionCardActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FA7E2B',
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

  // Sign Out Modal Content
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
