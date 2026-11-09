import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Home,
  Calendar,
  CreditCard,
  Truck,
  CheckCircle2,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';

const VEHICLE_OPTIONS = [
  { label: 'Motorcycle / Bike', value: 'motorcycle' },
  { label: 'Bicycle', value: 'bicycle' },
  { label: 'Car / Sedan', value: 'car' },
  { label: 'Mini Van / Bus', value: 'van' },
];

export function LogisticsKYCTabV2() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>('none');

  // Form State
  const [fullName, setFullName] = useState(profile?.display_name || profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [homeAddress, setHomeAddress] = useState(profile?.address || '');
  const [dob, setDob] = useState('');
  const [ninNumber, setNinNumber] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');

  const fetchKycData = async () => {
    if (!user) return;
    try {
      const { data } = await (supabase as any)
        .from('logistics_kyc')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setKycStatus(data.status?.trim()?.toLowerCase() || 'pending');
        if (data.full_name) setFullName(data.full_name);
        if (data.phone_number) setPhone(data.phone_number);
        if (data.home_address) setHomeAddress(data.home_address);
        if (data.date_of_birth) setDob(data.date_of_birth);
        if (data.nin_number) setNinNumber(data.nin_number);
        if (data.driver_license_number) setDriverLicenseNumber(data.driver_license_number);
        if (data.vehicle_type) setVehicleType(data.vehicle_type);
        if (data.plate_number) setPlateNumber(data.plate_number);
      }
    } catch (err) {
      console.warn('[LogisticsKYCTabV2] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, [user]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('Please enter your full legal name');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter your contact phone number');
      return;
    }
    if (!ninNumber.trim() || ninNumber.trim().length < 11) {
      toast.error('Please enter a valid 11-digit NIN');
      return;
    }
    if (!homeAddress.trim()) {
      toast.error('Please enter your residential address');
      return;
    }

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const payload = {
        user_id: user?.id,
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        home_address: homeAddress.trim(),
        date_of_birth: dob.trim(),
        nin_number: ninNumber.trim(),
        driver_license_number: driverLicenseNumber.trim(),
        vehicle_type: vehicleType,
        plate_number: plateNumber.trim().toUpperCase(),
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('logistics_kyc')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      // Also ensure profile address is synced
      await (supabase as any)
        .from('profiles')
        .update({
          display_name: fullName.trim(),
          phone: phone.trim(),
          address: homeAddress.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      refreshProfile();
      setKycStatus('pending');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('KYC application submitted for review');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('KYC submit error:', err);
      toast.error(err.message || 'Failed to submit KYC application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading KYC record...</Text>
      </View>
    );
  }

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
      >
        {/* Verification Status Banner */}
        {kycStatus === 'verified' && (
          <View style={styles.verifiedBanner}>
            <View style={styles.bannerIconWrapGreen}>
              <CheckCircle2 size={24} color="#059669" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.verifiedTitle}>ID VERIFIED & ACTIVE</Text>
              <Text style={styles.verifiedSub}>
                Your identity and rider credentials are fully verified. All mission pools are unlocked.
              </Text>
            </View>
          </View>
        )}

        {kycStatus === 'pending' && (
          <View style={styles.pendingBanner}>
            <View style={styles.bannerIconWrapAmber}>
              <Clock size={24} color="#d97706" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.pendingTitle}>VERIFICATION IN REVIEW</Text>
              <Text style={styles.pendingSub}>
                Your documents have been submitted and are being reviewed by the operations team.
              </Text>
            </View>
          </View>
        )}

        {kycStatus === 'rejected' && (
          <View style={styles.rejectedBanner}>
            <View style={styles.bannerIconWrapRed}>
              <AlertTriangle size={24} color="#dc2626" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.rejectedTitle}>VERIFICATION REJECTED</Text>
              <Text style={styles.rejectedSub}>
                Please verify your legal details and NIN, then resubmit your verification below.
              </Text>
            </View>
          </View>
        )}

        {kycStatus === 'none' && (
          <View style={styles.noneBanner}>
            <View style={styles.bannerIconWrapOrange}>
              <ShieldCheck size={24} color={colors.primary} />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.noneTitle}>IDENTITY VERIFICATION REQUIRED</Text>
              <Text style={styles.noneSub}>
                Complete your rider KYC profile below to receive guaranteed mission payouts.
              </Text>
            </View>
          </View>
        )}

        {/* Verification Form - Keyboard View Free */}
        <View style={styles.formCard}>
          <Text style={styles.formSectionHeading}>RIDER CREDENTIALS</Text>

          {/* Full Legal Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL LEGAL NAME</Text>
            <View style={styles.inputBox}>
              <User size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="As shown on official ID"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
            <View style={styles.inputBox}>
              <Phone size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 08012345678"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Home Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>RESIDENTIAL ADDRESS</Text>
            <View style={styles.inputBox}>
              <Home size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="Your permanent home address"
                placeholderTextColor="#94a3b8"
                value={homeAddress}
                onChangeText={setHomeAddress}
              />
            </View>
          </View>

          {/* NIN */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NATIONAL IDENTIFICATION NUMBER (NIN)</Text>
            <View style={styles.inputBox}>
              <CreditCard size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="11-digit NIN"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={11}
                value={ninNumber}
                onChangeText={setNinNumber}
              />
            </View>
          </View>

          {/* Driver's License Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DRIVER'S LICENSE NUMBER (OPTIONAL)</Text>
            <View style={styles.inputBox}>
              <CreditCard size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. ABC1234567"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                value={driverLicenseNumber}
                onChangeText={setDriverLicenseNumber}
              />
            </View>
          </View>

          {/* Vehicle Type Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>VEHICLE TYPE</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_OPTIONS.map((v) => {
                const isSelected = vehicleType === v.value;
                return (
                  <TouchableOpacity
                    key={v.value}
                    style={[styles.vehiclePill, isSelected && styles.vehiclePillActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setVehicleType(v.value);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.vehiclePillText, isSelected && styles.vehiclePillTextActive]}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* License Plate Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>VEHICLE LICENSE PLATE NUMBER</Text>
            <View style={styles.inputBox}>
              <Truck size={16} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. ABJ-429-XY"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                value={plateNumber}
                onChangeText={setPlateNumber}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {kycStatus === 'verified' ? 'UPDATE CREDENTIALS' : 'SUBMIT FOR VERIFICATION'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },

  // Banners
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  bannerIconWrapGreen: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  verifiedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
    lineHeight: 15,
  },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  bannerIconWrapAmber: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  pendingSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 2,
    lineHeight: 15,
  },

  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  bannerIconWrapRed: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#991b1b',
    letterSpacing: 0.5,
  },
  rejectedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
    marginTop: 2,
    lineHeight: 15,
  },

  noneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  bannerIconWrapOrange: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(235, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noneTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9a3412',
    letterSpacing: 0.5,
  },
  noneSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c2410c',
    marginTop: 2,
    lineHeight: 15,
  },
  bannerTextWrap: {
    flex: 1,
  },

  // Form
  formCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  formSectionHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehiclePill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  vehiclePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  vehiclePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  vehiclePillTextActive: {
    color: '#ffffff',
  },
  submitBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
});
