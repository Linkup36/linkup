import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { AppModal } from '../../../components/ui/AppModal';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  ShoppingBag,
  Wallet,
  MessageSquare,
  HelpCircle,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Package,
  Camera,
  User,
  Edit2,
  X,
  MapPin,
  Heart,
  Bell,
  Truck,
  Megaphone,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import {
  prepareImageForUpload,
  uploadImageToStorage,
} from '../../seller/utils/sellerUtils';

export function ProfileScreen() {
  const { user, profile, roles, activeRole, setActiveRole, signOut, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.display_name || profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [saving, setSaving] = useState(false);

  // Pick profile picture
  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri && user) {
      const localUri = result.assets[0].uri;

      try {
        const filename = `${user.id}/avatar_${Date.now()}.jpg`;
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
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);
        if (error) throw error;
        setAvatarUri(publicUrl);
        await refreshProfile();
      } catch (err: any) {
        console.warn('Avatar upload error:', err);
        setAvatarUri(profile?.avatar_url || null);
        Alert.alert('Image Not Accepted', err?.message || 'Could not upload this image.');
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditModalOpen(false);
      Alert.alert('Profile Saved', 'Your identity details have been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header Profile Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            <Image
              source={{
                uri:
                  avatarUri ||
                  profile?.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
              }}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.cameraIconBtn} onPress={handlePickAvatar} activeOpacity={0.8}>
              <Camera size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{profile?.display_name || profile?.full_name || 'Linkup Member'}</Text>
              {profile?.kyc_status === 'verified' ? (
                <ShieldCheck size={16} color="#16a34a" />
              ) : null}
            </View>
            <Text style={styles.userEmail}>{user?.email || profile?.phone || 'Registered User'}</Text>

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => {
                setFullName(profile?.display_name || profile?.full_name || '');
                setPhone(profile?.phone || '');
                setIsEditModalOpen(true);
              }}
            >
              <Edit2 size={12} color={colors.primary} />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Role Mode Switcher */}
        {roles.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Switch Profile Mode</Text>
            <View style={styles.roleTabs}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleTab, activeRole === r && styles.roleTabActive]}
                  onPress={() => setActiveRole(r)}
                >
                  <Text style={[styles.roleTabText, activeRole === r && styles.roleTabTextActive]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Active Role Banners */}
        {(activeRole === 'seller' || roles.includes('seller')) && (
          <TouchableOpacity
            style={styles.sellerBanner}
            onPress={() => {
              setActiveRole('seller');
              navigation.navigate('SellerDashboard');
            }}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.sellerBannerTitle}>Seller Dashboard</Text>
              <Text style={styles.sellerBannerSub}>Manage products, orders & incoming sales</Text>
            </View>
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {(activeRole === 'logistics' || roles.includes('logistics')) && (
          <TouchableOpacity
            style={[styles.sellerBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
            onPress={() => {
              setActiveRole('logistics');
              navigation.navigate('LogisticsDashboard');
            }}
            activeOpacity={0.85}
          >
            <View>
              <Text style={[styles.sellerBannerTitle, { color: '#166534' }]}>Courier & Driver Hub</Text>
              <Text style={[styles.sellerBannerSub, { color: '#15803d' }]}>Go online, accept nearby runs & view dropoffs</Text>
            </View>
            <ChevronRight size={18} color="#16a34a" />
          </TouchableOpacity>
        )}

        {(activeRole === 'promoter' || roles.includes('promoter')) && (
          <TouchableOpacity
            style={[styles.sellerBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
            onPress={() => {
              setActiveRole('promoter');
              navigation.navigate('PromoterDashboard');
            }}
            activeOpacity={0.85}
          >
            <View>
              <Text style={[styles.sellerBannerTitle, { color: '#92400e' }]}>Promoter / Affiliate Portal</Text>
              <Text style={[styles.sellerBannerSub, { color: '#b45309' }]}>Track referral links, commissions & earnings</Text>
            </View>
            <ChevronRight size={18} color="#d97706" />
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Wallet')}>
            <View style={styles.menuLeft}>
              <Wallet size={20} color={colors.primary} />
              <Text style={styles.menuText}>My Wallet & Balance</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Orders')}
          >
            <View style={styles.menuLeft}>
              <ShoppingBag size={20} color={colors.primary} />
              <Text style={styles.menuText}>Orders & Receipts</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Wishlist')}>
            <View style={styles.menuLeft}>
              <Heart size={20} color={colors.primary} />
              <Text style={styles.menuText}>Saved Items & Wishlist</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Notifications')}>
            <View style={styles.menuLeft}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.menuText}>Notifications & Alerts</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Messages')}>
            <View style={styles.menuLeft}>
              <MessageSquare size={20} color={colors.primary} />
              <Text style={styles.menuText}>Messages & Chat</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('SendHistory')}>
            <View style={styles.menuLeft}>
              <Package size={20} color={colors.primary} />
              <Text style={styles.menuText}>Package Delivery History</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('SellerVerification')}
          >
            <View style={styles.menuLeft}>
              <ShieldCheck size={20} color={colors.primary} />
              <Text style={styles.menuText}>Identity & KYC Verification</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Support')}>
            <View style={styles.menuLeft}>
              <HelpCircle size={20} color={colors.primary} />
              <Text style={styles.menuText}>Help & WhatsApp Support</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <AppModal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        subtitle="Update your public name and phone number"
      >
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          placeholder="e.g. Chukwuma Adebayo"
          placeholderTextColor="#94a3b8"
          style={styles.modalInput}
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Phone Number</Text>
        <TextInput
          placeholder="e.g. 08012345678"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          style={styles.modalInput}
          value={phone}
          onChangeText={setPhone}
        />

        <Button
          title="Save Changes"
          onPress={handleSaveProfile}
          loading={saving}
          style={{ marginTop: 24 }}
        />
      </AppModal>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#e2e8f0',
  },
  cameraIconBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  editProfileText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  roleTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  roleTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  roleTabActive: {
    backgroundColor: colors.primary,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roleTabTextActive: {
    color: '#ffffff',
  },
  sellerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  sellerBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#312e81',
  },
  sellerBannerSub: {
    fontSize: 12,
    color: '#4338ca',
    marginTop: 2,
  },
  menuSection: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
});
