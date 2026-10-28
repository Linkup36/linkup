import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
} from 'react-native';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Home,
  Calendar,
  Truck,
  CheckCircle2,
  MapPin,
  Upload,
  Camera,
  FileText,
  RefreshCw,
  Edit2,
  X,
  Eye,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { prepareImageForUpload, uploadImageToStorage } from '../../seller/utils/sellerUtils';

interface LogisticsKYCTabV2Props {
  onScroll?: (e: any) => void;
  onVerificationUpdated?: () => void;
}

interface CityItem {
  id: string;
  name: string;
}

interface ZoneItem {
  id: string;
  name: string;
  city_id: string;
}

interface KycRecord {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone_number?: string;
  home_address?: string;
  date_of_birth?: string;
  nin_number?: string;
  passport_photo_url?: string;
  id_card_photo_url?: string;
  city_id?: string;
  zone_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export function LogisticsKYCTabV2({ onScroll, onVerificationUpdated }: LogisticsKYCTabV2Props) {
  const { user, profile, refreshProfile } = useAuth();

  // Core status & data
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [kycRecord, setKycRecord] = useState<KycRecord | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State (100% matching Web version)
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [dob, setDob] = useState('');
  const [ninNumber, setNinNumber] = useState('');
  const [passportUri, setPassportUri] = useState<string | null>(null);
  const [idCardUri, setIdCardUri] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');

  // Signed URLs for document preview in review/verified view
  const [passportSignedUrl, setPassportSignedUrl] = useState<string | null>(null);
  const [idCardSignedUrl, setIdCardSignedUrl] = useState<string | null>(null);

  // Reference tables
  const [cities, setCities] = useState<CityItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);

  // Document full-view modal
  const [previewModalUri, setPreviewModalUri] = useState<string | null>(null);
  const [previewModalTitle, setPreviewModalTitle] = useState<string>('');

  // Resolve signed URL helper for kyc-documents bucket
  const resolveSignedUrl = useCallback(async (path: string | null | undefined): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    try {
      const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
      if (error) {
        console.warn('[LogisticsKYC] createSignedUrl error:', error);
        return null;
      }
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  }, []);

  // Fetch Cities
  const fetchCities = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('cities')
        .select('*')
        .order('name');
      if (error) throw error;
      const cityList: CityItem[] = data || [];
      setCities(cityList);
      return cityList;
    } catch (e) {
      console.warn('[LogisticsKYC] fetchCities error:', e);
      return [];
    }
  }, []);

  // Fetch Delivery Zones for a city
  const fetchZones = useCallback(async (targetCityId: string) => {
    if (!targetCityId) {
      setZones([]);
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('city_id', targetCityId)
        .order('name');
      if (error) throw error;
      setZones(data || []);
    } catch (e) {
      console.warn('[LogisticsKYC] fetchZones error:', e);
      setZones([]);
    }
  }, []);

  // Fetch Existing KYC record
  const fetchKycData = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('logistics_kyc')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setKycRecord(data);
        setFullName(data.full_name || profile?.display_name || profile?.full_name || '');
        setPhoneNumber(data.phone_number || profile?.phone || '');
        setHomeAddress(data.home_address || profile?.address || '');
        setDob(data.date_of_birth || '');
        setNinNumber(data.nin_number || '');
        setCityId(data.city_id || profile?.city_id || '');
        setZoneId(data.zone_id || profile?.zone_id || '');
        setPassportUri(data.passport_photo_url || null);
        setIdCardUri(data.id_card_photo_url || null);

        // Fetch signed URLs for documents preview
        if (data.passport_photo_url) {
          resolveSignedUrl(data.passport_photo_url).then(setPassportSignedUrl);
        }
        if (data.id_card_photo_url) {
          resolveSignedUrl(data.id_card_photo_url).then(setIdCardSignedUrl);
        }

        if (data.city_id) {
          fetchZones(data.city_id);
        }
      } else {
        // Pre-fill from profile if no KYC application exists yet
        setFullName(profile?.display_name || profile?.full_name || '');
        setPhoneNumber(profile?.phone || '');
        setHomeAddress(profile?.address || '');
        setCityId(profile?.city_id || '');
        setZoneId(profile?.zone_id || '');
        if (profile?.city_id) {
          fetchZones(profile?.city_id);
        }
      }
    } catch (err) {
      console.warn('[LogisticsKYCTabV2] fetch error:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user, profile, resolveSignedUrl, fetchZones]);

  // Initial Load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const loadedCities = await fetchCities();
      await fetchKycData();

      // Default to Abuja if no city selected (matching Web behavior)
      if (isMounted && loadedCities.length > 0 && !cityId) {
        const abuja = loadedCities.find((c) => c.name.toLowerCase().includes('abuja'));
        if (abuja) {
          setCityId(abuja.id);
          fetchZones(abuja.id);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // When city changes, load delivery zones
  const handleCityChange = (newCityId: string) => {
    Haptics.selectionAsync();
    setCityId(newCityId);
    setZoneId('');
    fetchZones(newCityId);
  };

  // Date of birth auto-formatter (YYYY-MM-DD)
  const handleDobChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    if (cleaned.length > 6) {
      formatted = `${formatted.slice(0, 7)}-${cleaned.slice(6, 8)}`;
    }
    setDob(formatted.slice(0, 10));
  };

  // Image Picker Action (Camera or Gallery)
  const handlePickImage = (target: 'passport' | 'idCard') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const title = target === 'passport' ? 'Passport Photograph' : "NIN / Voter's Card (Photo)";

    Alert.alert(
      title,
      'Select image source for document upload:',
      [
        {
          text: 'Take Photo with Camera',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                toast.warning('Camera Permission Required', {
                  description: 'Enable camera access in device settings to capture your document.',
                });
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.8,
                allowsEditing: true,
                aspect: target === 'passport' ? [1, 1] : [4, 3],
              });
              if (!res.canceled && res.assets?.[0]?.uri) {
                if (target === 'passport') {
                  setPassportUri(res.assets[0].uri);
                  setPassportSignedUrl(res.assets[0].uri);
                } else {
                  setIdCardUri(res.assets[0].uri);
                  setIdCardSignedUrl(res.assets[0].uri);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err: any) {
              console.error('[LogisticsKYC] Camera error:', err);
              toast.error('Camera Error', { description: err.message || 'Could not open camera.' });
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                toast.warning('Gallery Permission Required', {
                  description: 'Enable photo library access in device settings.',
                });
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
                allowsEditing: true,
                aspect: target === 'passport' ? [1, 1] : [4, 3],
              });
              if (!res.canceled && res.assets?.[0]?.uri) {
                if (target === 'passport') {
                  setPassportUri(res.assets[0].uri);
                  setPassportSignedUrl(res.assets[0].uri);
                } else {
                  setIdCardUri(res.assets[0].uri);
                  setIdCardSignedUrl(res.assets[0].uri);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err: any) {
              console.error('[LogisticsKYC] Gallery error:', err);
              toast.error('Gallery Error', { description: err.message || 'Could not pick image.' });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Sync with Server action
  const handleSyncWithServer = async () => {
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetchKycData(true);
    onVerificationUpdated?.();
    toast.success('KYC Status Refreshed', { description: 'Synced latest records with the server.' });
  };

  // Submit Application (100% matching Web fields and logic)
  const handleSubmit = async () => {
    if (!user) {
      toast.error('Authentication Error', { description: 'Please sign in to submit verification.' });
      return;
    }

    // 1. Validation (matches Web lines 130-134)
    if (!fullName.trim()) {
      toast.error('Missing Name', { description: 'Legal full name is required.' });
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error('Missing Phone', { description: 'Contact phone number is required.' });
      return;
    }
    if (!homeAddress.trim()) {
      toast.error('Missing Address', { description: 'Home residential address is required.' });
      return;
    }
    if (!dob.trim() || dob.trim().length < 10) {
      toast.error('Invalid Date of Birth', { description: 'Please enter Date of Birth in YYYY-MM-DD format.' });
      return;
    }
    if (!ninNumber.trim() || ninNumber.trim().length !== 11) {
      toast.error('Invalid NIN', { description: '11-digit National Identification Number is required.' });
      return;
    }
    if (!passportUri) {
      toast.error('Passport Photo Required', { description: 'Please attach your passport photograph.' });
      return;
    }
    if (!idCardUri) {
      toast.error('ID Document Required', { description: "Please attach your NIN or Voter's Card photograph." });
      return;
    }
    if (!cityId) {
      toast.error('City Required', { description: 'Please select your primary operational city.' });
      return;
    }
    if (!zoneId) {
      toast.error('Operational Zone Required', { description: 'Please select your designated delivery area.' });
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const uploadTimestamp = Date.now();

      // 1. Upload Passport Photograph (kyc-documents bucket)
      let passportPath = kycRecord?.passport_photo_url || '';
      if (passportUri && !passportUri.startsWith('http') && !passportUri.startsWith(`${user.id}/`)) {
        const preparedPassport = await prepareImageForUpload(passportUri);
        passportPath = await uploadImageToStorage(
          preparedPassport.uri,
          'kyc-documents',
          `${user.id}/passport_${uploadTimestamp}.jpg`,
          false
        );
      }

      // 2. Upload NIN / Voter's Card Document (kyc-documents bucket)
      let idCardPath = kycRecord?.id_card_photo_url || '';
      if (idCardUri && !idCardUri.startsWith('http') && !idCardUri.startsWith(`${user.id}/`)) {
        const preparedIdCard = await prepareImageForUpload(idCardUri);
        idCardPath = await uploadImageToStorage(
          preparedIdCard.uri,
          'kyc-documents',
          `${user.id}/id_card_${uploadTimestamp}.jpg`,
          false
        );
      }

      // 3. Upsert into logistics_kyc (matches Web lines 158-174)
      const kycPayload = {
        user_id: user.id,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        home_address: homeAddress.trim(),
        date_of_birth: dob.trim(),
        nin_number: ninNumber.trim(),
        passport_photo_url: passportPath,
        id_card_photo_url: idCardPath,
        city_id: cityId,
        zone_id: zoneId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      const { error: kycError } = await (supabase as any)
        .from('logistics_kyc')
        .upsert(kycPayload, { onConflict: 'user_id' });

      if (kycError) throw kycError;

      // 4. Update profile territory and personal info (matches Web lines 177-188)
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({
          city_id: cityId || null,
          zone_id: zoneId || null,
          display_name: fullName.trim(),
          phone: phoneNumber.trim(),
          address: homeAddress.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 5. Refresh context & notify
      if (refreshProfile) await refreshProfile();
      onVerificationUpdated?.();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Verification Submitted!', {
        description: 'Your KYC credentials are now under review by operations.',
      });

      // Exit edit mode and refresh view
      setIsEditMode(false);
      await fetchKycData(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('[LogisticsKYC] submission error:', err);
      toast.error('Submission Failed', {
        description: err.message || 'Could not submit your KYC documents.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading State (Matching Web line 201-207)
  if (loading) {
    return (
      <View style={styles.centerLoadingContainer}>
        <ActivityIndicator size="large" color="#FA7E2B" />
        <Text style={styles.loadingHeading}>Checking Profile Status...</Text>
        <Text style={styles.loadingSub}>Retrieving your rider credentials</Text>
      </View>
    );
  }

  const status = (kycRecord?.status || 'none').toLowerCase();
  const isVerified = status === 'verified';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  // 2. Verified or Pending Status Screen (Matching Web lines 209-284)
  if (kycRecord && (isVerified || isPending) && !isEditMode) {
    const selectedCity = cities.find((c) => c.id === kycRecord.city_id);
    const selectedZone = zones.find((z) => z.id === kycRecord.zone_id);

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.reviewCard}>
          {/* Header Banner */}
          <View style={[styles.reviewHero, isVerified ? styles.reviewHeroVerified : styles.reviewHeroPending]}>
            <View
              style={[
                styles.reviewIconSquare,
                isVerified ? styles.reviewIconSquareVerified : styles.reviewIconSquarePending,
              ]}
            >
              {isVerified ? (
                <CheckCircle2 size={38} color="#FFFFFF" strokeWidth={2.5} />
              ) : (
                <Clock size={38} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>

            <View
              style={[
                styles.reviewBadge,
                isVerified ? styles.reviewBadgeVerified : styles.reviewBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.reviewBadgeText,
                  isVerified ? styles.reviewBadgeTextVerified : styles.reviewBadgeTextPending,
                ]}
              >
                {isVerified ? 'Profile Confirmed' : 'Review in Progress'}
              </Text>
            </View>

            <Text style={styles.reviewTitle}>
              {isVerified ? 'Verified Partner' : 'Verification in Progress'}
            </Text>

            <Text style={styles.reviewDescription}>
              {isVerified
                ? 'Your identity has been confirmed. You are now authorized to accept and start missions.'
                : 'We are currently reviewing your documents. This process usually completes within 24-48 hours.'}
            </Text>
          </View>

          {/* Details Grid */}
          <View style={styles.reviewBody}>
            <View style={styles.reviewGrid}>
              <View style={styles.reviewFieldBox}>
                <Text style={styles.reviewFieldLabel}>FULL NAME</Text>
                <Text style={styles.reviewFieldValue}>{kycRecord.full_name || 'N/A'}</Text>
              </View>

              <View style={styles.reviewFieldBox}>
                <Text style={styles.reviewFieldLabel}>PHONE NUMBER</Text>
                <Text style={styles.reviewFieldValue}>{kycRecord.phone_number || 'N/A'}</Text>
              </View>

              <View style={[styles.reviewFieldBox, styles.reviewFieldFull]}>
                <Text style={styles.reviewFieldLabel}>IDENTIFICATION NUMBER</Text>
                <Text style={[styles.reviewFieldValue, styles.ninNumberValue]}>
                  {kycRecord.nin_number || 'ENC_HIDDEN'}
                </Text>
              </View>

              <View style={[styles.reviewFieldBox, styles.reviewFieldFull]}>
                <Text style={styles.reviewFieldLabel}>HOME ADDRESS</Text>
                <Text style={styles.reviewFieldValue}>{kycRecord.home_address || 'N/A'}</Text>
              </View>

              <View style={styles.reviewFieldBox}>
                <Text style={styles.reviewFieldLabel}>PRIMARY CITY</Text>
                <Text style={styles.reviewFieldValue}>
                  {selectedCity?.name || 'Abuja (Capital)'}
                </Text>
              </View>

              <View style={styles.reviewFieldBox}>
                <Text style={styles.reviewFieldLabel}>DELIVERY ZONE</Text>
                <Text style={styles.reviewFieldValue}>
                  {selectedZone?.name || 'Central Logistics Hub'}
                </Text>
              </View>
            </View>

            {/* Document Previews */}
            <View style={styles.docsPreviewSection}>
              <Text style={styles.docsSectionTitle}>ATTACHED IDENTITY PROOFS</Text>

              <View style={styles.docsRow}>
                {/* Passport Photo */}
                <TouchableOpacity
                  style={styles.docThumbnailCard}
                  onPress={() => {
                    if (passportSignedUrl) {
                      setPreviewModalUri(passportSignedUrl);
                      setPreviewModalTitle('Passport Photograph');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {passportSignedUrl ? (
                    <Image source={{ uri: passportSignedUrl }} style={styles.docThumbnail} />
                  ) : (
                    <View style={styles.docPlaceholderThumb}>
                      <User size={24} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.docThumbOverlay}>
                    <Eye size={14} color="#FFFFFF" />
                  </View>
                  <Text style={styles.docThumbLabel} numberOfLines={1}>
                    Passport Photo
                  </Text>
                </TouchableOpacity>

                {/* ID Card / NIN Photo */}
                <TouchableOpacity
                  style={styles.docThumbnailCard}
                  onPress={() => {
                    if (idCardSignedUrl) {
                      setPreviewModalUri(idCardSignedUrl);
                      setPreviewModalTitle("NIN / Voter's Card");
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {idCardSignedUrl ? (
                    <Image source={{ uri: idCardSignedUrl }} style={styles.docThumbnail} />
                  ) : (
                    <View style={styles.docPlaceholderThumb}>
                      <FileText size={24} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.docThumbOverlay}>
                    <Eye size={14} color="#FFFFFF" />
                  </View>
                  <Text style={styles.docThumbLabel} numberOfLines={1}>
                    NIN / ID Card
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sync / Update Actions */}
            <View style={styles.reviewActions}>
              {!isVerified && (
                <TouchableOpacity
                  style={styles.syncBtn}
                  onPress={handleSyncWithServer}
                  disabled={syncing}
                  activeOpacity={0.8}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color="#64748B" />
                  ) : (
                    <>
                      <RefreshCw size={14} color="#64748B" />
                      <Text style={styles.syncBtnText}>SYNC WITH SERVER</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsEditMode(true);
                }}
                activeOpacity={0.85}
              >
                <Edit2 size={15} color="#FA7E2B" />
                <Text style={styles.editBtnText}>
                  {isVerified ? 'UPDATE DETAILS' : 'EDIT APPLICATION'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Full Image Preview Modal */}
        <Modal visible={!!previewModalUri} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{previewModalTitle}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewModalUri(null)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {previewModalUri && (
              <Image
                source={{ uri: previewModalUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // 3. Form Screen (Matching Web lines 289-466)
  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Top Header Badge (Matching Web lines 291-300) */}
        <View style={styles.webStyleHeader}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.headerIconBox}>
              <Truck size={18} color="#FA7E2B" strokeWidth={2.5} />
            </View>
            <Text style={styles.headerBadgeText}>PARTNER VERIFICATION</Text>
          </View>
          <Text style={styles.headerTitle}>Identity Check</Text>
          <Text style={styles.headerSubtitle}>
            Submit your basic details to start accepting missions.
          </Text>
        </View>

        {/* Rejection Alert if application was rejected */}
        {isRejected && (
          <View style={styles.rejectedCallout}>
            <View style={styles.rejectedIconBox}>
              <AlertTriangle size={20} color="#DC2626" />
            </View>
            <View style={styles.rejectedTextWrap}>
              <Text style={styles.rejectedTitle}>VERIFICATION REJECTED</Text>
              <Text style={styles.rejectedSub}>
                Please check that your legal name, NIN, and uploaded photos match your government documents, then resubmit below.
              </Text>
            </View>
          </View>
        )}

        {/* Edit mode return option */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.cancelEditBtn}
            onPress={() => setIsEditMode(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelEditText}>← Back to Status Summary</Text>
          </TouchableOpacity>
        )}

        {/* Main KYC Form Card */}
        <View style={styles.formCard}>
          {/* Legal Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <User size={12} color="#FA7E2B" /> LEGAL FULL NAME
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="John Doe"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <Phone size={12} color="#FA7E2B" /> PHONE NUMBER
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="+234... or 08012345678"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={11}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
          </View>

          {/* Home Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <Home size={12} color="#FA7E2B" /> HOME ADDRESS
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="123 Street Name, Neighborhood"
                placeholderTextColor="#94A3B8"
                value={homeAddress}
                onChangeText={setHomeAddress}
              />
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <Calendar size={12} color="#FA7E2B" /> DATE OF BIRTH (YYYY-MM-DD)
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="1995-08-15"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                value={dob}
                onChangeText={handleDobChange}
              />
            </View>
            <Text style={styles.fieldHelper}>Format: Year-Month-Day (e.g. 1996-05-22)</Text>
          </View>

          {/* NIN Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <ShieldCheck size={12} color="#FA7E2B" /> NIN NUMBER
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="11-digit NIN"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={11}
                value={ninNumber}
                onChangeText={setNinNumber}
              />
            </View>
          </View>

          {/* Passport Photograph Upload Card */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <Upload size={12} color="#FA7E2B" /> PASSPORT PHOTOGRAPH
            </Text>
            <TouchableOpacity
              style={[styles.uploadBox, passportUri ? styles.uploadBoxActive : null]}
              onPress={() => handlePickImage('passport')}
              activeOpacity={0.85}
            >
              {passportSignedUrl || passportUri ? (
                <View style={styles.uploadPreviewRow}>
                  <Image
                    source={{ uri: passportSignedUrl || passportUri! }}
                    style={styles.uploadThumb}
                  />
                  <View style={styles.uploadTextWrap}>
                    <View style={styles.uploadStatusBadge}>
                      <CheckCircle2 size={12} color="#059669" />
                      <Text style={styles.uploadStatusText}>Photo Attached</Text>
                    </View>
                    <Text style={styles.uploadChangeLink}>Tap to take or choose different photo</Text>
                  </View>
                  <Camera size={18} color="#FA7E2B" />
                </View>
              ) : (
                <View style={styles.uploadEmptyRow}>
                  <View style={styles.uploadEmptyIcon}>
                    <Camera size={20} color="#FA7E2B" />
                  </View>
                  <View style={styles.uploadTextWrap}>
                    <Text style={styles.uploadMainTitle}>Upload Passport Photograph</Text>
                    <Text style={styles.uploadSubTitle}>Take photo or choose from gallery</Text>
                  </View>
                  <View style={styles.uploadTag}>
                    <Text style={styles.uploadTagText}>REQUIRED</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* NIN / Voter's Card (Photo) Upload Card */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <Upload size={12} color="#FA7E2B" /> NIN / VOTER'S CARD (PHOTO)
            </Text>
            <TouchableOpacity
              style={[styles.uploadBox, idCardUri ? styles.uploadBoxActive : null]}
              onPress={() => handlePickImage('idCard')}
              activeOpacity={0.85}
            >
              {idCardSignedUrl || idCardUri ? (
                <View style={styles.uploadPreviewRow}>
                  <Image
                    source={{ uri: idCardSignedUrl || idCardUri! }}
                    style={styles.uploadThumb}
                  />
                  <View style={styles.uploadTextWrap}>
                    <View style={styles.uploadStatusBadge}>
                      <CheckCircle2 size={12} color="#059669" />
                      <Text style={styles.uploadStatusText}>Document Attached</Text>
                    </View>
                    <Text style={styles.uploadChangeLink}>Tap to take or choose different photo</Text>
                  </View>
                  <FileText size={18} color="#FA7E2B" />
                </View>
              ) : (
                <View style={styles.uploadEmptyRow}>
                  <View style={styles.uploadEmptyIcon}>
                    <FileText size={20} color="#FA7E2B" />
                  </View>
                  <View style={styles.uploadTextWrap}>
                    <Text style={styles.uploadMainTitle}>Upload NIN or Voter's Card Document</Text>
                    <Text style={styles.uploadSubTitle}>Take photo or choose from gallery</Text>
                  </View>
                  <View style={styles.uploadTag}>
                    <Text style={styles.uploadTagText}>REQUIRED</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Primary City Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <MapPin size={12} color="#FA7E2B" /> PRIMARY OPERATIONAL CITY
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityPillsWrap}>
              {cities.map((city) => {
                const isSelected = cityId === city.id;
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.cityPill, isSelected && styles.cityPillActive]}
                    onPress={() => handleCityChange(city.id)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={13} color={isSelected ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.cityPillText, isSelected && styles.cityPillTextActive]}>
                      {city.name}
                    </Text>
                    {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Delivery Area Grid (Matching Web lines 403-446) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              <MapPin size={12} color="#FA7E2B" /> DELIVERY AREA
            </Text>
            {!cityId ? (
              <View style={styles.noCityBox}>
                <MapPin size={24} color="#94A3B8" />
                <Text style={styles.noCityText}>Please select a primary city first</Text>
              </View>
            ) : zones.length === 0 ? (
              <View style={styles.noCityBox}>
                <Text style={styles.noCityText}>Loading operational zones for this city...</Text>
              </View>
            ) : (
              <View style={styles.zonesGrid}>
                {zones.map((zone) => {
                  const isSelected = zoneId === zone.id;
                  return (
                    <TouchableOpacity
                      key={zone.id}
                      style={[styles.zoneCard, isSelected && styles.zoneCardActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setZoneId(zone.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.zoneCardTextWrap}>
                        <Text
                          style={[
                            styles.zoneCardSub,
                            isSelected && styles.zoneCardSubActive,
                          ]}
                        >
                          DELIVERY AREA
                        </Text>
                        <Text
                          style={[
                            styles.zoneCardName,
                            isSelected && styles.zoneCardNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {zone.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.zoneCardCheck,
                          isSelected && styles.zoneCardCheckActive,
                        ]}
                      >
                        <CheckCircle2
                          size={14}
                          color={isSelected ? '#FFFFFF' : '#CBD5E1'}
                          strokeWidth={2.5}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Warning Notice (Matching Web lines 449-454) */}
          <View style={styles.alertNotice}>
            <AlertTriangle size={18} color="#D97706" style={{ marginTop: 1 }} />
            <Text style={styles.alertNoticeText}>
              Ensure all information matches your legal documents. Inaccurate data will lead to verification rejection and potential account suspension.
            </Text>
          </View>

          {/* Submit Button (Matching Web lines 456-462) */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.submitBtnInner}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitBtnText}>SENDING INFORMATION...</Text>
              </View>
            ) : (
              <View style={styles.submitBtnInner}>
                <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.submitBtnText}>SUBMIT PROFILE FOR REVIEW</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Full Image Preview Modal */}
        <Modal visible={!!previewModalUri} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{previewModalTitle}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewModalUri(null)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {previewModalUri && (
              <Image
                source={{ uri: previewModalUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 130,
  },
  centerLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
    minHeight: 320,
  },
  loadingHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  loadingSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // Web-Style Header
  webStyleHeader: {
    marginBottom: 4,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(250, 126, 43, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FA7E2B',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },

  // Rejected Callout
  rejectedCallout: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  rejectedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedTextWrap: {
    flex: 1,
  },
  rejectedTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  rejectedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 15,
  },

  cancelEditBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelEditText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },

  // Form Card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  fieldHelper: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 4,
  },

  // Document Upload Box
  uploadBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 12,
  },
  uploadBoxActive: {
    borderColor: '#FA7E2B',
    borderStyle: 'solid',
    backgroundColor: 'rgba(250, 126, 43, 0.03)',
  },
  uploadEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(250, 126, 43, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  uploadTextWrap: {
    flex: 1,
  },
  uploadMainTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  uploadSubTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  uploadStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  uploadChangeLink: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FA7E2B',
    marginTop: 2,
  },
  uploadTag: {
    backgroundColor: 'rgba(250, 126, 43, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  uploadTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FA7E2B',
    letterSpacing: 0.5,
  },

  // City Pills
  cityPillsWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  cityPillActive: {
    backgroundColor: '#FA7E2B',
    borderColor: '#FA7E2B',
  },
  cityPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
  },
  cityPillTextActive: {
    color: '#FFFFFF',
  },

  // Delivery Area Grid
  noCityBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noCityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
  },
  zoneCardActive: {
    backgroundColor: 'rgba(250, 126, 43, 0.05)',
    borderColor: '#FA7E2B',
  },
  zoneCardTextWrap: {
    flex: 1,
    paddingRight: 6,
  },
  zoneCardSub: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  zoneCardSubActive: {
    color: '#FA7E2B',
  },
  zoneCardName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  zoneCardNameActive: {
    color: '#0F172A',
  },
  zoneCardCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCardCheckActive: {
    backgroundColor: '#FA7E2B',
  },

  // Warning Notice Callout
  alertNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  alertNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },

  // Submit Button
  submitBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },

  // Verified / Pending Status Card
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  reviewHero: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  reviewHeroVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderBottomColor: '#A7F3D0',
  },
  reviewHeroPending: {
    backgroundColor: 'rgba(250, 126, 43, 0.08)',
    borderBottomColor: '#FED7AA',
  },
  reviewIconSquare: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  reviewIconSquareVerified: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  reviewIconSquarePending: {
    backgroundColor: '#FA7E2B',
    shadowColor: '#FA7E2B',
  },
  reviewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  reviewBadgeVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  reviewBadgePending: {
    backgroundColor: 'rgba(250, 126, 43, 0.15)',
  },
  reviewBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  reviewBadgeTextVerified: {
    color: '#059669',
  },
  reviewBadgeTextPending: {
    color: '#FA7E2B',
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  reviewDescription: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },

  // Review Details Body
  reviewBody: {
    padding: 18,
    gap: 16,
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewFieldBox: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  reviewFieldFull: {
    width: '100%',
  },
  reviewFieldLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  reviewFieldValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  ninNumberValue: {
    letterSpacing: 2,
    color: '#0F172A',
  },

  // Document Proofs in Review
  docsPreviewSection: {
    gap: 8,
    marginTop: 4,
  },
  docsSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
  },
  docsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  docThumbnailCard: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  docThumbnail: {
    width: '100%',
    height: '100%',
  },
  docPlaceholderThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumbOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumbLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 3,
  },

  // Review Actions
  reviewActions: {
    gap: 10,
    marginTop: 6,
  },
  syncBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  editBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(250, 126, 43, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FA7E2B',
    letterSpacing: 1,
  },

  // Full Screen Image Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '75%',
  },
});
