import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { toast } from '../../../components/ui';
import { supabase } from '../../../services/supabase';
import { Lock, Mail, ArrowLeft, ArrowRight, Eye, EyeOff, Check, Apple } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { AdminMfaModal } from '../components/AdminMfaModal';
import { useAuth } from '../../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Auto-manage keyboard visibility and scroll offset
  useEffect(() => {
    const handleKeyboardShow = () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 60, animated: true });
      }, 100);
    };
    const handleKeyboardHide = () => {
      setKeyboardVisible(false);
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    const didShowSub = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    const willHideSub = Keyboard.addListener('keyboardWillHide', handleKeyboardHide);
    const didHideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, []);

  // Sync route params if changed
  useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
    }
  }, [route.params?.email]);

  // Two-Factor Authentication state for Admin login
  const [mfaConfig, setMfaConfig] = useState<{
    visible: boolean;
    mode: 'enroll' | 'verify';
    factorId: string;
    challengeId?: string;
    qrCodeUri?: string;
    secret?: string;
  }>({
    visible: false,
    mode: 'verify',
    factorId: '',
  });

  const handleMfaSuccess = () => {
    setMfaConfig((prev) => ({ ...prev, visible: false }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Welcome back, Admin!');
    setTimeout(() => {
      navigation.navigate('AdminDashboard');
    }, 300);
  };

  const handleMfaCancel = async () => {
    setMfaConfig((prev) => ({ ...prev, visible: false }));
    try {
      await supabase.auth.signOut();
    } catch { }
    toast.info('Session Cancelled', { description: 'Admin authentication was aborted.' });
  };

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) {
        toast.info('Google Sign-In', { description: error.message || 'Connecting to Google...' });
      }
    } catch {
      toast.info('Google Sign-In', { description: 'Connecting to Google secure portal...' });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
      });
      if (error) {
        toast.info('Apple Sign-In', { description: error.message || 'Connecting to Apple...' });
      }
    } catch {
      toast.info('Apple Sign-In', { description: 'Connecting to Apple ID portal...' });
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password) {
      toast.warning('Required Fields', { description: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data?.user) {
        // Fetch user roles and profile
        let [rolesRes, profileRes] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', data.user.id),
          supabase.from('profiles').select('display_name, onboarding_completed').eq('id', data.user.id).maybeSingle(),
        ]);

        // Self-heal: Ensure profile and wallet exist in database
        if (!profileRes.data) {
          const metaName =
            data.user.user_metadata?.display_name ||
            data.user.user_metadata?.full_name ||
            (data.user.email ? data.user.email.split('@')[0] : 'Linkup Member');
          const metaPhone = data.user.user_metadata?.phone || null;

          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: metaName,
            phone: metaPhone,
            onboarding_completed: true,
          });

          await supabase.from('wallets').upsert({
            user_id: data.user.id,
            balance: 0,
          });
        }

        const userRoles: string[] = rolesRes.data?.map((r: any) => r.role) || [];

        // Check if user has role in user_metadata that needs to be assigned
        if (userRoles.length === 0 && data.user.user_metadata?.role) {
          const assignedRole = data.user.user_metadata.role;
          if (['seller', 'logistics', 'promoter'].includes(assignedRole)) {
            try {
              await supabase.rpc('manage_user_roles', {
                p_user_id: data.user.id,
                p_roles: [assignedRole, 'buyer'],
              });
              userRoles.push(assignedRole);
            } catch (rErr) {
              console.warn('[LoginScreen] Error assigning metadata role:', rErr);
            }
          }
        }

        const allRoles = [...userRoles];

        // Check if onboarding is incomplete
        if (profileRes.data && profileRes.data.onboarding_completed === false) {
          toast.success('Welcome to Linkup!');
          setTimeout(() => {
            navigation.navigate('Onboarding');
          }, 400);
          return;
        }

        // Two-Factor Authentication enforcement for Admin
        if (allRoles.includes('admin')) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          const { data: mfaFactors, error: mfaError } = await supabase.auth.mfa.listFactors();
          if (mfaError) throw mfaError;

          const totpFactors = mfaFactors.totp || [];
          const verifiedFactors = totpFactors.filter((f: any) => f.status === 'verified');
          const unverifiedFactors = totpFactors.filter((f: any) => f.status === 'unverified');

          if (verifiedFactors.length === 0) {
            for (const uf of unverifiedFactors) {
              await supabase.auth.mfa.unenroll({ factorId: uf.id });
            }

            const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
              factorType: 'totp',
              issuer: 'Linkup Marketplace',
              friendlyName: `Admin Authenticator - ${Date.now()}`,
            });

            if (enrollError) throw enrollError;

            setMfaConfig({
              visible: true,
              mode: 'enroll',
              factorId: enrollData.id,
              qrCodeUri: enrollData.totp.uri,
              secret: enrollData.totp.secret,
            });
            toast.info('2FA Setup Required', {
              description: 'Link your Authenticator app to protect Admin privileges.',
            });
            return;
          } else {
            const activeFactor = verifiedFactors[0];
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
              factorId: activeFactor.id,
            });
            if (challengeError) throw challengeError;

            setMfaConfig({
              visible: true,
              mode: 'verify',
              factorId: activeFactor.id,
              challengeId: challengeData.id,
            });
            return;
          }
        }

        if (allRoles.includes('seller')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success('Welcome back, Merchant!');
          setTimeout(() => {
            navigation.navigate('SellerDashboard');
          }, 400);
          return;
        }

        if (allRoles.includes('logistics') || allRoles.includes('driver')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success('Welcome back, Courier Partner!');
          setTimeout(() => {
            navigation.navigate('LogisticsDashboard');
          }, 400);
          return;
        }

        if (allRoles.includes('promoter')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success('Welcome back, Affiliate Promoter!');
          setTimeout(() => {
            navigation.navigate('PromoterDashboard');
          }, 400);
          return;
        }

        // Standard buyer / customer
        toast.success('Welcome back!');
        setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainTabs', { screen: 'HomeTab' });
          }
        }, 400);
      }
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('email not confirmed')) {
        try {
          const { data: fnData } = await supabase.functions.invoke('signup-user', {
            body: { email: email.trim().toLowerCase(), password },
          });
          if (fnData?.success) {
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: email.trim().toLowerCase(),
              password,
            });
            if (!retryError) {
              toast.success('Welcome back!');
              await refreshProfile();
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MainTabs', { screen: 'HomeTab' });
              }
              return;
            }
          }
        } catch (retryErr) {
          console.warn('[LoginScreen] auto-confirm retry error:', retryErr);
        }
        toast.error('Login Failed', { description: 'Please check your email and password.' });
      } else {
        toast.error('Login Failed', { description: err.message || 'Invalid email or password.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBE4D2" translucent />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + (Platform.OS === 'ios' ? 6 : 10) },
              keyboardVisible && styles.scrollKeyboardOpen,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Top Warm Peach Hero Section */}
            <View style={[styles.heroSection, keyboardVisible && styles.heroSectionCompact]}>
              {/* Header Bar */}
              <View style={styles.headerBar}>
                <View style={styles.brandGroup}>
                  {navigation.canGoBack() && (
                    <TouchableOpacity
                      style={styles.backCircleBtn}
                      onPress={() => navigation.goBack()}
                      activeOpacity={0.75}
                    >
                      <ArrowLeft size={18} color="#0F172A" strokeWidth={2.4} />
                    </TouchableOpacity>
                  )}
                  <View style={styles.logoRow}>
                    <BrandLogo size="sm" style={styles.logoBadge} />
                    <View>
                      <Text style={styles.logoTitle}>
                        Link<Text style={{ color: '#FA7E2B' }}>Up Marketplace</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3D Courier Illustration Container - smoothly hidden when typing so button is never blocked */}
              {!keyboardVisible && (
                <View style={styles.courierIllustrationWrap}>
                  <Image
                    source={require('../../../../assets/auth_courier_hero.jpg')}
                    style={styles.courierImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>

            {/* Bottom Clean White Sheet */}
            <View style={[styles.bottomSheetCard, keyboardVisible && styles.bottomSheetCardCompact]}>
              <Text style={[styles.sheetTitle, keyboardVisible && styles.sheetTitleCompact]}>
                Welcome Back!
              </Text>

              {/* Email or Phone Input Pill */}
              <View style={styles.inputPill}>
                <Mail size={18} color="#9CA3AF" strokeWidth={2.2} />
                <TextInput
                  placeholder="Email or Phone"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.pillInput}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => {
                    setKeyboardVisible(true);
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 50, animated: true }), 100);
                  }}
                />
              </View>

              {/* Password Input Pill with Toggle */}
              <View style={[styles.inputPill, { marginTop: 14 }]}>
                <Lock size={18} color="#9CA3AF" strokeWidth={2.2} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.pillInput}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => {
                    setKeyboardVisible(true);
                    setTimeout(() => scrollRef.current?.scrollTo({ y: 90, animated: true }), 100);
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={19} color="#9CA3AF" strokeWidth={2} />
                  ) : (
                    <Eye size={19} color="#9CA3AF" strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Keep me signed in + Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.keepSignedRow}
                  onPress={() => setKeepSignedIn(!keepSignedIn)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkCircle, keepSignedIn && styles.checkCircleActive]}>
                    {keepSignedIn && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.keepSignedText}>Keep me signed in</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword', { email })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Primary Log In Button */}
              <TouchableOpacity
                style={[styles.primaryLoginBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryLoginBtnText}>Log In</Text>
                )}
              </TouchableOpacity>

              {/* Divider: Or Continue With */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />

                <View style={styles.dividerLine} />
              </View>



              {/* Don't have an account? Sign Up */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have any account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.signUpLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {/* Terms & Privacy Policy Link */}
              <TouchableOpacity
                style={styles.legalNoticeRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('TermsAndPrivacy');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.legalNoticeText}>
                  Protected by LinkUp Escrow •{' '}
                  <Text style={styles.legalNoticeHighlight}>Terms & Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Admin Two-Factor Authentication Modal */}
      <AdminMfaModal
        visible={mfaConfig.visible}
        mode={mfaConfig.mode}
        factorId={mfaConfig.factorId}
        challengeId={mfaConfig.challengeId}
        qrCodeUri={mfaConfig.qrCodeUri}
        secret={mfaConfig.secret}
        onSuccess={handleMfaSuccess}
        onCancel={handleMfaCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FBE4D2',
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: '#FBE4D2',
  },
  scrollKeyboardOpen: {
    paddingBottom: Platform.OS === 'ios' ? 280 : 180,
  },

  // 1. Top Warm Hero Section
  heroSection: {
    backgroundColor: '#FBE4D2',
    position: 'relative',
    minHeight: 220,
    justifyContent: 'space-between',
  },
  heroSectionCompact: {
    minHeight: 0,
    paddingBottom: 6,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    marginTop: -2,
    letterSpacing: 0.2,
  },
  courierIllustrationWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 190,
    marginTop: 4,
    paddingBottom: 8,
  },
  courierImage: {
    width: SCREEN_WIDTH * 0.72,
    height: 185,
  },

  // 2. Bottom Curved White Sheet
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 10,
    flex: 1,
  },
  bottomSheetCardCompact: {
    paddingTop: 18,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  sheetTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  sheetTitleCompact: {
    fontSize: 22,
    marginBottom: 14,
  },

  // Input Pills
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pillInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    paddingHorizontal: 12,
    height: '100%',
  },

  // Options: Keep signed in & Forgot password
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  keepSignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#FA7E2B',
    borderColor: '#FA7E2B',
  },
  keepSignedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FA7E2B',
  },

  // Primary Action Button
  primaryLoginBtn: {
    backgroundColor: '#FA7E2B',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryLoginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  dividerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#9CA3AF',
    paddingHorizontal: 12,
  },

  // Social Auth Buttons
  socialButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  googleIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconG: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Footer Links
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  signUpLink: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FA7E2B',
  },
  guestTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
  },
  guestTrackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  legalNoticeRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legalNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  legalNoticeHighlight: {
    color: '#FA7E2B',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
