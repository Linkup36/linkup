import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Store,
  ShieldCheck,
  AlertCircle,
  Clock,
  Phone,
  MapPin,
  Mail,
  Building2,
  CreditCard,
  Camera,
  Edit2,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { toast as GooeyToast } from '../../../components/ui/GooeyToast';
import { prepareImageForUpload, uploadImageToStorage } from '../utils/sellerUtils';

interface SellerProfileTabProps {
  userId: string;
  userEmail?: string;
  profile: any;
  verification: any;
  onRefresh: () => void;
  onNavigateVerification: () => void;
}

export function SellerProfileTab({
  userId,
  userEmail,
  profile,
  verification,
  onRefresh,
  onNavigateVerification,
}: SellerProfileTabProps) {
  const [editing, setEditing] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const bankDetails = useMemo(() => {
    const vd = verification?.bank_details || {};
    return {
      bank_name:
        profile?.payout_bank_name ||
        verification?.bank_name ||
        vd?.bank_name ||
        '',
      account_number:
        profile?.payout_account_number ||
        verification?.account_number ||
        vd?.account_number ||
        '',
      account_name:
        profile?.payout_account_name ||
        verification?.account_name ||
        vd?.account_name ||
        '',
    };
  }, [profile, verification]);

  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    zone: '',
    address: '',
    bio: '',
    email: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });

  useEffect(() => {
    setForm({
      display_name:
        profile?.display_name || verification?.business_name || '',
      phone: profile?.phone || verification?.phone_number || '',
      zone: profile?.zone || '',
      address: profile?.address || verification?.business_address || '',
      bio: profile?.bio || '',
      email: profile?.email || userEmail || '',
      bank_name: bankDetails.bank_name,
      account_number: bankDetails.account_number,
      account_name: bankDetails.account_name,
    });
  }, [profile, verification, bankDetails, userEmail]);

  // 6-item completion checklist matching web ProfileTab
  const completionStats = useMemo(() => {
    const checks = [
      { label: 'Store Display Name', done: Boolean(form.display_name?.trim()) },
      { label: 'Contact Phone Number', done: Boolean(form.phone?.trim()) },
      {
        label: 'Operational Zone / Address',
        done: Boolean(form.zone?.trim() || form.address?.trim()),
      },
      { label: 'Store Bio & Description', done: Boolean(form.bio?.trim()) },
      {
        label: 'Payout Bank & Account No.',
        done: Boolean(form.bank_name?.trim() && form.account_number?.trim()),
      },
      {
        label: 'Account Holder Name',
        done: Boolean(form.account_name?.trim()),
      },
    ];
    const doneCount = checks.filter((c) => c.done).length;
    const percent = Math.round((doneCount / checks.length) * 100);
    return { checks, doneCount, total: checks.length, percent };
  }, [form]);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        GooeyToast.warning('Permission Needed', 'Please allow photo library access.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (res.canceled || !res.assets?.[0]?.uri) return;

      setUploadingAvatar(true);
      const preparedAvatar = await prepareImageForUpload(
        res.assets[0].uri,
        (res.assets[0] as any).fileSize
      );
      const uploadedUrl = await uploadImageToStorage(
        preparedAvatar.uri,
        'avatars',
        `${userId}/avatar_${Date.now()}.jpg`,
        true
      );

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: uploadedUrl } as any)
        .eq('user_id', userId);

      if (error) {
        await supabase
          .from('profiles')
          .update({ avatar_url: uploadedUrl } as any)
          .eq('id', userId);
      }

      GooeyToast.success('Logo Updated', 'Your store avatar has been updated.');
      onRefresh();
    } catch (err: any) {
      GooeyToast.error('Upload Failed', err?.message || 'Could not upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!form.display_name.trim()) {
      GooeyToast.warning('Name Required', 'Please enter your store display name.');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const profilePayload: Record<string, any> = {
        display_name: form.display_name.trim(),
        phone: form.phone.trim() || null,
        zone: form.zone.trim() || null,
        address: form.address.trim() || null,
        bio: form.bio.trim() || null,
        email: form.email.trim() || null,
        payout_bank_name: form.bank_name.trim() || null,
        payout_account_number: form.account_number.trim() || null,
        payout_account_name: form.account_name.trim() || null,
      };

      const { error: pErr } = await supabase
        .from('profiles')
        .update(profilePayload as any)
        .eq('user_id', userId);

      if (pErr) {
        await supabase
          .from('profiles')
          .update(profilePayload as any)
          .eq('id', userId);
      }

      if (verification?.id) {
        await supabase
          .from('seller_verifications')
          .update({
            business_name: form.display_name.trim(),
            phone_number: form.phone.trim() || verification.phone_number,
            business_address: form.address.trim() || verification.business_address,
            bank_name: form.bank_name.trim() || null,
            account_number: form.account_number.trim() || null,
            account_name: form.account_name.trim() || null,
            bank_details: {
              bank_name: form.bank_name.trim(),
              account_number: form.account_number.trim(),
              account_name: form.account_name.trim(),
            },
          } as any)
          .eq('id', verification.id);
      }

      GooeyToast.success('Profile Saved', 'Your store identity and payout settings are updated.');
      setEditing(false);
      setCompleteModalVisible(false);
      onRefresh();
    } catch (err: any) {
      GooeyToast.error('Save Error', err?.message || 'Failed to update store profile.');
    } finally {
      setSaving(false);
    }
  };

  const kycStatus = verification?.status || 'unverified';

  return (
    <View style={styles.container}>
      {/* Store Completion Banner */}
      {completionStats.percent < 100 && (
        <View style={styles.completionBanner}>
          <View style={styles.completionTopRow}>
            <View style={styles.completionLeft}>
              <View style={styles.sparkleBox}>
                <Sparkles size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.completionTitle}>
                  Complete Your Store Profile ({completionStats.percent}%)
                </Text>
                <Text style={styles.completionSubtitle}>
                  {completionStats.doneCount} of {completionStats.total} store essentials completed
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${completionStats.percent}%` },
              ]}
            />
          </View>

          <TouchableOpacity
            style={styles.completeNowBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setWizardStep(1);
              setCompleteModalVisible(true);
            }}
          >
            <Text style={styles.completeNowText}>Complete Now</Text>
            <ArrowRight size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Store Identity Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Store size={26} color={colors.primary} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Camera size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.storeNameText}>
                {form.display_name || 'Your LinkUp Store'}
              </Text>
              <Text style={styles.storeZoneSub}>
                {form.zone || form.address || 'No operational zone set'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editToggleBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setEditing((prev) => !prev);
            }}
          >
            <Edit2 size={14} color={colors.primary} />
            <Text style={styles.editToggleText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Display Name</Text>
              <TextInput
                style={styles.input}
                value={form.display_name}
                onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
                placeholder="e.g. Ace Gadget Hub"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="08012345678"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Operational Zone</Text>
              <TextInput
                style={styles.input}
                value={form.zone}
                onChangeText={(v) => setForm((f) => ({ ...f, zone: v }))}
                placeholder="e.g. Barnawa / Narayi"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Address</Text>
              <TextInput
                style={styles.input}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Street address or landmark"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Bio</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                multiline
                value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                placeholder="Tell buyers what makes your store special..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Support Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="support@yourstore.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bank Name</Text>
              <TextInput
                style={styles.input}
                value={form.bank_name}
                onChangeText={(v) => setForm((f) => ({ ...f, bank_name: v }))}
                placeholder="e.g. GTBank, OPay, Access Bank"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Account Number (10 digits)</Text>
              <TextInput
                style={styles.input}
                value={form.account_number}
                onChangeText={(v) => setForm((f) => ({ ...f, account_number: v }))}
                placeholder="0123456789"
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.input}
                value={form.account_name}
                onChangeText={(v) => setForm((f) => ({ ...f, account_name: v }))}
                placeholder="Account Holder Full Name"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              disabled={saving}
              onPress={handleSaveProfile}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Store Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Phone size={15} color="#64748B" />
              <View>
                <Text style={styles.infoLabel}>CONTACT PHONE</Text>
                <Text style={styles.infoValue}>{form.phone || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <MapPin size={15} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>OPERATIONAL ZONE & ADDRESS</Text>
                <Text style={styles.infoValue}>
                  {form.address || form.zone || 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Mail size={15} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>SUPPORT EMAIL</Text>
                <Text style={styles.infoValue}>{form.email || 'Not set'}</Text>
              </View>
            </View>

            {form.bio ? (
              <View style={styles.bioBox}>
                <Text style={styles.infoLabel}>STORE BIO</Text>
                <Text style={styles.bioText}>{form.bio}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Business Verification Card */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <View style={styles.titleIconWrap}>
            <ShieldCheck size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Business KYC Verification</Text>
            <Text style={styles.cardSubtitle}>
              Merchant trust badge & identity status
            </Text>
          </View>

          <View
            style={[
              styles.kycBadge,
              kycStatus === 'verified'
                ? { backgroundColor: '#ECFDF5' }
                : kycStatus === 'pending'
                  ? { backgroundColor: '#FFFBEB' }
                  : { backgroundColor: '#FEF2F2' },
            ]}
          >
            <Text
              style={[
                styles.kycBadgeText,
                kycStatus === 'verified'
                  ? { color: '#059669' }
                  : kycStatus === 'pending'
                    ? { color: '#D97706' }
                    : { color: '#DC2626' },
              ]}
            >
              {String(kycStatus).toUpperCase()}
            </Text>
          </View>
        </View>

        {kycStatus === 'rejected' && verification?.rejection_reason && (
          <View style={styles.rejectionAlert}>
            <AlertCircle size={16} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectionTitle}>Verification Rejected</Text>
              <Text style={styles.rejectionReason}>
                {verification.rejection_reason}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Building2 size={15} color="#64748B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>BUSINESS ENTITY NAME</Text>
              <Text style={styles.infoValue}>
                {verification?.business_name || form.display_name || 'Unregistered'}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MapPin size={15} color="#64748B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>REGISTERED HEADQUARTERS</Text>
              <Text style={styles.infoValue}>
                {verification?.business_address || form.address || 'Not submitted'}
              </Text>
            </View>
          </View>

          {verification?.created_at && (
            <View style={styles.infoItem}>
              <Clock size={15} color="#64748B" />
              <View>
                <Text style={styles.infoLabel}>VERIFICATION TIMESTAMP</Text>
                <Text style={styles.infoValue}>
                  {new Date(verification.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {kycStatus !== 'verified' && (
          <TouchableOpacity
            style={styles.kycActionBtn}
            onPress={onNavigateVerification}
          >
            <ShieldCheck size={16} color="#FFFFFF" />
            <Text style={styles.kycActionText}>
              {kycStatus === 'pending'
                ? 'View KYC Application Status'
                : kycStatus === 'rejected'
                  ? 'Re-submit KYC Documents'
                  : 'Complete Merchant Verification'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Payout Bank Details Card */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.titleIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <CreditCard size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Payout Bank Account</Text>
            <Text style={styles.cardSubtitle}>
              Default destination for wallet withdrawals
            </Text>
          </View>
        </View>

        <View style={styles.bankSummaryBox}>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Bank Name</Text>
            <Text style={styles.bankVal}>{form.bank_name || 'Not configured'}</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Account Number</Text>
            <Text style={styles.bankVal}>
              {form.account_number || 'Not configured'}
            </Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Account Holder</Text>
            <Text style={styles.bankVal}>
              {form.account_name || 'Not configured'}
            </Text>
          </View>
        </View>
      </View>

      {/* 2-Step Complete Profile Modal (matching CompleteProfileModal.tsx) */}
      <Modal
        visible={completeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalStepBadge}>STEP {wizardStep} OF 2</Text>
                <Text style={styles.modalTitle}>
                  {wizardStep === 1 ? 'Store Identity' : 'Payout Bank Details'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setCompleteModalVisible(false)}
              >
                <X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {wizardStep === 1 ? (
                <View style={styles.editForm}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Store Display Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.display_name}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, display_name: v }))
                      }
                      placeholder="e.g. Kaduna Fresh Mart"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Contact Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.phone}
                      onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                      placeholder="08012345678"
                      keyboardType="phone-pad"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Operational Zone *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.zone}
                      onChangeText={(v) => setForm((f) => ({ ...f, zone: v }))}
                      placeholder="e.g. Barnawa, Sabo, Ungwan Rimi"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Store Bio *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { height: 80, textAlignVertical: 'top', paddingTop: 10 },
                      ]}
                      multiline
                      value={form.bio}
                      onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                      placeholder="Describe your products and delivery promise..."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setWizardStep(2);
                    }}
                  >
                    <Text style={styles.saveBtnText}>Next: Payment Details</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.editForm}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Bank Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.bank_name}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, bank_name: v }))
                      }
                      placeholder="e.g. Access Bank, GTBank, OPay"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Number *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.account_number}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, account_number: v }))
                      }
                      placeholder="10-digit NUBAN account number"
                      keyboardType="number-pad"
                      maxLength={10}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Holder Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.account_name}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, account_name: v }))
                      }
                      placeholder="Exact name on bank account"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.wizardBtnsRow}>
                    <TouchableOpacity
                      style={styles.backStepBtn}
                      onPress={() => setWizardStep(1)}
                    >
                      <ArrowLeft size={16} color={colors.foreground} />
                      <Text style={styles.backStepText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
                      disabled={saving}
                      onPress={handleSaveProfile}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color="#FFFFFF" />
                          <Text style={styles.saveBtnText}>Complete Setup</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  completionBanner: {
    backgroundColor: '#FFF3EC',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  completionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  completionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkleBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  completionSubtitle: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 2,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(233, 111, 40, 0.18)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  completeNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 12,
  },
  completeNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 20,
    position: 'relative',
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storeNameText: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.foreground,
  },
  storeZoneSub: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFF3EC',
  },
  editToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  infoGrid: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 1,
  },
  bioBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginTop: 4,
  },
  editForm: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
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
  saveBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  titleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  kycBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kycBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  rejectionAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  rejectionReason: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  kycActionBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.foreground,
    paddingVertical: 13,
    borderRadius: 14,
  },
  kycActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bankSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  bankVal: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalStepBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.foreground,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  backStepText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.foreground,
  },
});
