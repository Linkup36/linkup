import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { toast } from '../../../components/ui';
import { supabase } from '../../../services/supabase';
import { Lock, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import { AdminMfaModal } from '../components/AdminMfaModal';

export function LoginScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    } catch {}
    toast.info('Session Cancelled', { description: 'Admin authentication was aborted.' });
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
        // Fetch user roles and profile to determine role-based destination
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', data.user.id),
          supabase.from('profiles').select('onboarding_completed').eq('id', data.user.id).maybeSingle(),
        ]);

        const allRoles: string[] = rolesRes.data?.map((r: any) => r.role) || [];

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
            // Clean up any stale unverified factors
            for (const uf of unverifiedFactors) {
              await supabase.auth.mfa.unenroll({ factorId: uf.id });
            }

            // Enroll new TOTP factor
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
            // Start MFA challenge with verified factor
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
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }, { name: 'PromoterDashboard' }],
            });
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
      toast.error('Login Failed', { description: err.message || 'Invalid email or password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Top Header with Back Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Sign In</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Official Brand Logo & Header */}
            <View style={styles.brandContainer}>
              <BrandLogo size="lg" style={styles.brandLogo} />
              <Text style={styles.brandTitle}>Welcome to Linkup</Text>
              <Text style={styles.brandSubtitle}>
                Nigeria's smart marketplace & peer-to-peer delivery network
              </Text>
            </View>

            {/* Input Form */}
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Mail size={18} color="#64748b" />
                <TextInput
                  placeholder="name@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Password</Text>
              <View style={styles.inputWrap}>
                <Lock size={18} color="#64748b" />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#64748b" />
                  ) : (
                    <Eye size={18} color="#64748b" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ResetPassword', { email })}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                style={{ marginTop: 24 }}
              />

              {/* Switch to Register */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have an account?</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
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
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 290,
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontSize: 13,
    color: '#64748b',
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});
