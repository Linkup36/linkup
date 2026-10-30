/**
 * SellerVerificationScreen — LinkUp Merchant KYC & Bank Verification
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  CreditCard,
  Upload,
  Camera,
  CheckCircle2,
  Clock,
  AlertCircle,
  Store,
  FileText,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { SafeView } from '../../../components/ui/SafeView';
import { AuthGuard } from '../../../components/auth/AuthGuard';
import { toast as GooeyToast } from '../../../components/ui/GooeyToast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { prepareImageForUpload, uploadImageToStorage } from '../utils/sellerUtils';

export function SellerVerificationScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingVerification, setExistingVerification] = useState<any | null>(null);
  const [resubmitMode, setResubmitMode] = useState(false);

  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const [nationalIdUri, setNationalIdUri] = useState<string>('');
  const [storePhotoUri, setStorePhotoUri] = useState<string>('');

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const [verifRes, citiesRes, zonesRes, profileRes] = await Promise.all([
          supabase
            .from('seller_verifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabase
            .from('delivery_zones')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabase
            .from('profiles')
            .select('*')
            .or(`user_id.eq.${user.id},id.eq.${user.id}`)
            .limit(1)
            .maybeSingle(),
        ]);

        setCities(citiesRes.data || []);
        setZones(zonesRes.data || []);

        const v = verifRes.data;
        const p = profileRes.data;

        if (v) {
          setExistingVerification(v);
          setBusinessName(v.business_name || p?.display_name || '');
          setPhoneNumber(v.phone_number || p?.phone || '');
          setBusinessAddress(v.business_address || p?.address || '');
          setSelectedCityId(v.city_id || p?.city_id || '');
          setSelectedZoneId(v.zone_id || p?.zone_id || '');
          const bd = (v.bank_details as any) || {};
          setBankName(v.bank_name || bd.bank_name || p?.payout_bank_name || '');
          setAccountNumber(
            v.account_number || bd.account_number || p?.payout_account_number || ''
          );
          setAccountName(
            v.account_name || bd.account_name || p?.payout_account_name || ''
          );
          if (v.national_id_url) setNationalIdUri(v.national_id_url);
          if (v.store_photo_url) setStorePhotoUri(v.store_photo_url);
        } else if (p) {
          setBusinessName(p.display_name || '');
          setPhoneNumber(p.phone || '');
          setBusinessAddress(p.address || '');
          setSelectedCityId(p.city_id || '');
          setSelectedZoneId(p.zone_id || '');
          setBankName(p.payout_bank_name || '');
          setAccountNumber(p.payout_account_number || '');
          setAccountName(p.payout_account_name || '');
        }
      } catch (err) {
        console.warn('[SellerVerificationScreen] Init error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [user?.id]);

  const filteredZones = selectedCityId
    ? zones.filter((z) => !z.city_id || z.city_id === selectedCityId)
    : zones;

  const pickDocumentImage = async (target: 'national_id' | 'store_photo') => {
    Alert.alert(
      target === 'national_id' ? 'Upload National ID' : 'Upload Store Photo',
      'Choose how you want to provide this photo:',
      [
        {
          text: 'Take Photo (Camera)',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              GooeyToast.warning('Permission Needed', 'Camera access is required.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              if (target === 'national_id') setNationalIdUri(res.assets[0].uri);
              else setStorePhotoUri(res.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              GooeyToast.warning('Permission Needed', 'Gallery access is required.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              if (target === 'national_id') setNationalIdUri(res.assets[0].uri);
              else setStorePhotoUri(res.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSubmitVerification = async () => {
    if (!user?.id) return;

    if (!businessName.trim() || !phoneNumber.trim() || !businessAddress.trim()) {
      GooeyToast.warning(
        'Missing Business Info',
        'Please fill in your business name, phone number, and address.'
      );
      return;
    }

    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      GooeyToast.warning(
        'Missing Bank Info',
        'Please complete your payout bank details.'
      );
      return;
    }

    if (!nationalIdUri || !storePhotoUri) {
      GooeyToast.warning(
        'Documents Required',
        'Please attach both your National ID photo and your Store photo.'
      );
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const uploadTimestamp = Date.now();
      const preparedNationalId = nationalIdUri.startsWith('http')
        ? null
        : await prepareImageForUpload(nationalIdUri);
      const uploadedNationalId = preparedNationalId
        ? await uploadImageToStorage(
            preparedNationalId.uri,
            'kyc-documents',
            `${user.id}/national_id_${uploadTimestamp}.jpg`,
            false
          )
        : nationalIdUri;

      const preparedStorePhoto = storePhotoUri.startsWith('http')
        ? null
        : await prepareImageForUpload(storePhotoUri);
      const uploadedStorePhoto = preparedStorePhoto
        ? await uploadImageToStorage(
            preparedStorePhoto.uri,
            'kyc-documents',
            `${user.id}/store_${uploadTimestamp}.jpg`,
            false
          )
        : storePhotoUri;

      const payload: Record<string, any> = {
        user_id: user.id,
        business_name: businessName.trim(),
        phone_number: phoneNumber.trim(),
        business_address: businessAddress.trim(),
        city_id: selectedCityId || null,
        zone_id: selectedZoneId || null,
        national_id_url: uploadedNationalId,
        store_photo_url: uploadedStorePhoto,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        bank_details: {
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
        },
        status: 'pending',
      };

      const { data: inserted, error: verifErr } = await supabase
        .from('seller_verifications')
        .insert(payload as any)
        .select('*')
        .single();

      if (verifErr) throw verifErr;

      // Also sync to profiles
      const profileUpdate: Record<string, any> = {
        display_name: businessName.trim(),
        phone: phoneNumber.trim(),
        address: businessAddress.trim(),
        city_id: selectedCityId || null,
        zone_id: selectedZoneId || null,
        payout_bank_name: bankName.trim(),
        payout_account_number: accountNumber.trim(),
        payout_account_name: accountName.trim(),
      };

      const { error: pErr } = await supabase
        .from('profiles')
        .update(profileUpdate as any)
        .eq('user_id', user.id);

      if (pErr) {
        await supabase
          .from('profiles')
          .update(profileUpdate as any)
          .eq('id', user.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      GooeyToast.success(
        'KYC Application Submitted!',
        'Our team will review your merchant verification shortly.'
      );
      setExistingVerification(inserted);
      setResubmitMode(false);
    } catch (err: any) {
      GooeyToast.error(
        'Submission Failed',
        err?.message || 'Unable to submit verification documents.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <AuthGuard
        fallbackTitle="Merchant Verification"
        fallbackDescription="Sign in to your LinkUp Merchant account to complete KYC verification and submit banking credentials."
      >
        <View />
      </AuthGuard>
    );
  }

  if (loading) {
    return (
      <SafeView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking verification status...</Text>
      </SafeView>
    );
  }

  // Verified State
  if (existingVerification?.status === 'verified' && !resubmitMode) {
    return (
      <SafeView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Merchant Verification</Text>
        </View>

        <View style={styles.centered}>
          <View style={[styles.statusBigCircle, { backgroundColor: '#ECFDF5' }]}>
            <CheckCircle2 size={46} color="#059669" />
          </View>
          <Text style={styles.statusTitle}>Verified LinkUp Merchant</Text>
          <Text style={styles.statusSub}>
            Congratulations! Your store "{existingVerification.business_name}" is verified and carries the trusted LinkUp Merchant badge.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SellerDashboard')}
          >
            <Text style={styles.primaryBtnText}>Go to Seller Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeView>
    );
  }

  // Pending State
  if (existingVerification?.status === 'pending' && !resubmitMode) {
    return (
      <SafeView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Merchant Verification</Text>
        </View>

        <View style={styles.centered}>
          <View style={[styles.statusBigCircle, { backgroundColor: '#FFFBEB' }]}>
            <Clock size={46} color="#D97706" />
          </View>
          <Text style={styles.statusTitle}>Verification Under Review</Text>
          <Text style={styles.statusSub}>
            Your KYC documents for "{existingVerification.business_name}" have been received and are being reviewed by our compliance team.
          </Text>

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Business Name</Text>
              <Text style={styles.summaryVal}>
                {existingVerification.business_name}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone</Text>
              <Text style={styles.summaryVal}>
                {existingVerification.phone_number}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submitted</Text>
              <Text style={styles.summaryVal}>
                {existingVerification.created_at
                  ? new Date(existingVerification.created_at).toLocaleDateString()
                  : 'Recently'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SellerDashboard')}
          >
            <Text style={styles.primaryBtnText}>Return to Seller Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeView>
    );
  }

  return (
    <SafeView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Seller KYC Verification</Text>
          <Text style={styles.headerSub}>
            Verify your business identity & payout account
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {existingVerification?.status === 'rejected' && (
          <View style={styles.rejectedBanner}>
            <AlertCircle size={18} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectedTitle}>
                Previous Application Was Rejected
              </Text>
              <Text style={styles.rejectedSub}>
                {existingVerification.rejection_reason ||
                  'Please ensure your ID and store photos are clear and match your business details.'}
              </Text>
            </View>
          </View>
        )}

        {/* Section 1: Business Details */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Building2 size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>1. Business Details</Text>
              <Text style={styles.sectionSub}>
                Store name, contact phone, and pickup zone
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Business / Store Name *</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Kaduna Gadget Hub"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Business Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="08012345678"
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Store / Pickup Address *</Text>
            <TextInput
              style={styles.input}
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholder="Full street address and closest landmark"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {cities.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Operating City</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {cities.map((c) => {
                  const active = selectedCityId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedCityId(c.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {filteredZones.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Delivery / Pickup Zone</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {filteredZones.map((z) => {
                  const active = selectedZoneId === z.id;
                  return (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedZoneId(z.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {z.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Section 2: Bank Account Details */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EFF6FF' }]}>
              <CreditCard size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>2. Payout Bank Account</Text>
              <Text style={styles.sectionSub}>
                Where your order settlements will be paid
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bank Name *</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="e.g. GTBank, Access Bank, OPay, Moniepoint"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Account Number (10 digits) *</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0123456789"
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput
              style={styles.input}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Full name matching your bank account"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* Section 3: KYC Documents */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
              <FileText size={18} color="#059669" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>3. Identity & Store Photos</Text>
              <Text style={styles.sectionSub}>
                Clear photos speed up verification approval
              </Text>
            </View>
          </View>

          {/* National ID Upload */}
          <Text style={styles.label}>
            Government Issued ID (NIN, Voter Card, Passport, or Driver License) *
          </Text>
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={() => pickDocumentImage('national_id')}
          >
            {nationalIdUri ? (
              <Image
                source={{ uri: nationalIdUri }}
                style={styles.uploadedPreview}
              />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Camera size={26} color={colors.primary} />
                <Text style={styles.uploadTitle}>Tap to Capture or Select ID</Text>
                <Text style={styles.uploadSub}>Make sure all 4 corners are visible</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Store Photo Upload */}
          <Text style={[styles.label, { marginTop: 12 }]}>
            Storefront or Inventory Photo *
          </Text>
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={() => pickDocumentImage('store_photo')}
          >
            {storePhotoUri ? (
              <Image
                source={{ uri: storePhotoUri }}
                style={styles.uploadedPreview}
              />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Store size={26} color={colors.primary} />
                <Text style={styles.uploadTitle}>
                  Tap to Capture Store / Products Photo
                </Text>
                <Text style={styles.uploadSub}>
                  Shows buyers and admins your physical stock
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={handleSubmitVerification}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <ShieldCheck size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                Submit Verification Application
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.foreground,
  },
  headerSub: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 10,
  },
  statusBigCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.foreground,
    textAlign: 'center',
  },
  statusSub: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  rejectedSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  uploadBox: {
    height: 155,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: 8,
  },
  uploadSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  uploadedPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
