import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Store,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SafeView } from '../../../components/ui/SafeView';
import { AuthGuard } from '../../../components/auth/AuthGuard';
import { toast as GooeyToast } from '../../../components/ui/GooeyToast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { SellerListProductTab } from '../components/SellerListProductTab';

export function ListProductScreen() {
  const navigation = useNavigation<any>();
  const { user, roles, refreshProfile } = useAuth();
  const [verification, setVerification] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isSeller = (roles || []).includes('seller');

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const loadVerification = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('seller_verifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setVerification(data || null);
      } catch (err) {
        console.warn('[ListProductScreen] Verification lookup failed:', err);
      } finally {
        setLoading(false);
      }
    };
    loadVerification();
  }, [user?.id]);

  const handleBecomeSeller = async () => {
    if (!user?.id) return;
    setActivating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'seller' } as any);
      await refreshProfile();
      GooeyToast.success('Seller Mode Enabled', 'You can now list products on LinkUp.');
    } catch (err: any) {
      GooeyToast.error('Error', err?.message || 'Unable to enable seller mode.');
    } finally {
      setActivating(false);
    }
  };

  if (!user) {
    return (
      <AuthGuard
        fallbackTitle="Sign In Required"
        fallbackDescription="Please sign in to list products on the LinkUp Marketplace."
      >
        <View />
      </AuthGuard>
    );
  }

  return (
    <SafeView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>List a Product</Text>
          <Text style={styles.headerSub}>
            Publish an item to the LinkUp Marketplace
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !isSeller ? (
        <View style={styles.centered}>
          <View style={styles.iconCircle}>
            <Sparkles size={32} color={colors.primary} />
          </View>
          <Text style={styles.titleText}>Become a LinkUp Seller</Text>
          <Text style={styles.subText}>
            Activate your merchant account to list products, receive orders, and withdraw earnings.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, activating && { opacity: 0.7 }]}
            disabled={activating}
            onPress={handleBecomeSeller}
          >
            {activating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Activate Seller Account</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              isKeyboardVisible && { paddingBottom: 360 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
          >
            {verification?.status !== 'verified' && (
              <TouchableOpacity
                style={styles.kycNotice}
                onPress={() => navigation.navigate('SellerVerification')}
              >
                <ShieldCheck size={18} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.kycNoticeTitle}>
                    {verification?.status === 'pending'
                      ? 'KYC Verification Pending'
                      : 'Verify Your Store Identity'}
                  </Text>
                  <Text style={styles.kycNoticeSub}>
                    {verification?.status === 'pending'
                      ? 'Your KYC is under review. You can still prepare listings.'
                      : 'Tap here to complete KYC and earn the Verified Merchant badge.'}
                  </Text>
                </View>
                <AlertCircle size={16} color="#D97706" />
              </TouchableOpacity>
            )}

            <SellerListProductTab
              scrollRef={scrollRef}
              applyPlatformMarkup={true}
              onSuccess={() => {
                navigation.navigate('SellerDashboard');
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#FFF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.foreground,
    textAlign: 'center',
    marginTop: 8,
  },
  subText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
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
    paddingBottom: 80,
    gap: 14,
  },
  kycNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  kycNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  kycNoticeSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
});
