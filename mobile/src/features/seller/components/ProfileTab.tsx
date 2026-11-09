import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  ShieldCheck,
  Edit2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { AppModal } from '../../../components/ui/AppModal';

interface ProfileTabProps {
  profile: any;
  onUpdate: (data: any) => Promise<void>;
  isUpdating?: boolean;
  onNavigateKYC: () => void;
}

export function ProfileTab({
  profile,
  onUpdate,
  isUpdating = false,
  onNavigateKYC,
}: ProfileTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const verification = profile?.verification || {};
  const isVerified = verification.status === 'verified' || profile?.kyc_status === 'verified';

  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    bio: profile?.bio || '',
    business_name: verification.business_name || '',
    business_address: verification.business_address || '',
    payout_bank_name: profile?.payout_bank_name || '',
    payout_account_number: profile?.payout_account_number || '',
    payout_account_name: profile?.payout_account_name || '',
  });

  const completionFields = [
    Boolean(profile?.display_name),
    Boolean(profile?.phone),
    Boolean(profile?.email),
    Boolean(profile?.bio),
    Boolean(profile?.payout_bank_name && profile?.payout_account_number),
    Boolean(verification.business_name || verification.business_address),
  ];
  const completedCount = completionFields.filter(Boolean).length;
  const completionPercentage = Math.round((completedCount / completionFields.length) * 100);

  const handleSave = async () => {
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (e) {
      console.warn('Profile update error:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.subtitle}>Store Identity</Text>
          <Text style={styles.title}>Merchant Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            setFormData({
              display_name: profile?.display_name || '',
              phone: profile?.phone || '',
              email: profile?.email || '',
              bio: profile?.bio || '',
              business_name: verification.business_name || '',
              business_address: verification.business_address || '',
              payout_bank_name: profile?.payout_bank_name || '',
              payout_account_number: profile?.payout_account_number || '',
              payout_account_name: profile?.payout_account_name || '',
            });
            setIsEditing(true);
          }}
          activeOpacity={0.8}
        >
          <Edit2 size={14} color="#ffffff" strokeWidth={2.5} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Completion Bar */}
      <View style={styles.card}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabel}>Profile Strength</Text>
          <Text style={styles.progressPercent}>{completionPercentage}% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
        </View>
        <Text style={styles.progressSubtext}>
          Complete all store details and bank info to ensure quick automated settlements.
        </Text>
      </View>

      {/* KYC Trust Badge Card */}
      <TouchableOpacity
        style={[styles.kycCard, isVerified ? styles.kycVerified : styles.kycPending]}
        onPress={onNavigateKYC}
        activeOpacity={0.8}
      >
        <View style={styles.kycLeft}>
          {isVerified ? (
            <CheckCircle2 size={24} color="#16a34a" />
          ) : (
            <ShieldCheck size={24} color="#d97706" />
          )}
          <View>
            <Text style={[styles.kycTitle, isVerified ? { color: '#15803d' } : { color: '#92400e' }]}>
              {isVerified ? 'Verified Merchant' : 'KYC Verification Pending'}
            </Text>
            <Text style={styles.kycDesc}>
              {isVerified
                ? 'Your merchant badge is active with full trust rating.'
                : 'Tap to complete identity verification to unlock priority dispatch.'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Store Information */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Store & Contact Info</Text>

        <View style={styles.infoRow}>
          <Building2 size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Business Name</Text>
            <Text style={styles.infoValue}>
              {verification.business_name || profile?.display_name || 'Not set'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Phone size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Mail size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Business Email</Text>
            <Text style={styles.infoValue}>{profile?.email || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MapPin size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Store Address</Text>
            <Text style={styles.infoValue}>
              {verification.business_address || profile?.address || 'Not set'}
            </Text>
          </View>
        </View>
      </View>

      {/* Payout Banking Information */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Payout Banking Details</Text>

        <View style={styles.infoRow}>
          <Landmark size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Bank Name</Text>
            <Text style={styles.infoValue}>{profile?.payout_bank_name || 'Not configured'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.numIcon}>#</Text>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Account Number</Text>
            <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>
              {profile?.payout_account_number || 'Not configured'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <UserCheck size={16} color="#64748b" />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>Account Name</Text>
            <Text style={styles.infoValue}>{profile?.payout_account_name || 'Not configured'}</Text>
          </View>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <AppModal
        visible={isEditing}
        onClose={() => setIsEditing(false)}
        title="Edit Store Profile"
        subtitle="Update merchant identity and settlement bank details"
      >
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.display_name}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, display_name: t }))}
              placeholder="Store / Display Name"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Business Phone</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.phone}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, phone: t }))}
              placeholder="e.g. 08012345678"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Business Email</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.email}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, email: t }))}
              placeholder="merchant@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Business Address</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.business_address}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, business_address: t }))}
              placeholder="Store / Pickup address"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Name</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.payout_bank_name}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, payout_bank_name: t }))}
              placeholder="e.g. Access Bank / OPay / GTBank"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.payout_account_number}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, payout_account_number: t }))}
              placeholder="10-digit NUBAN"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.modalInput}
              value={formData.payout_account_name}
              onChangeText={(t) => setFormData((prev) => ({ ...prev, payout_account_name: t }))}
              placeholder="Account holder name"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsEditing(false)}
              disabled={isUpdating}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: 15,
  },
  kycCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  kycVerified: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  kycPending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  kycLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  kycDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    maxWidth: 260,
  },
  cardHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  numIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#64748b',
    width: 16,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  modalContent: {
    paddingVertical: 10,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});

