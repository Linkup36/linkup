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
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleKeyboardShow = () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 70, animated: true });
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

  const isValidLength = password.length >= 6;
  const isMatching = password.length > 0 && password === confirmPassword;

  const handleUpdatePassword = async () => {
    Keyboard.dismiss();

    if (!isValidLength) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.warning('Short Password', { description: 'Password must be at least 6 characters long.' });
      return;
    }

    if (!isMatching) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.warning('Mismatch', { description: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Password Updated! 🎉', {
        description: 'Your LinkUp password has been changed successfully. You can now log in.',
      });

      // Clear fields and safely navigate to Login screen
      setPassword('');
      setConfirmPassword('');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error('Update Failed', {
        description: err.message || 'Unable to update password. Your reset link may have expired.',
      });
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
                  <TouchableOpacity
                    style={styles.backCircleBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.75}
                  >
                    <ArrowLeft size={18} color="#0F172A" strokeWidth={2.4} />
                  </TouchableOpacity>
                  <View style={styles.logoRow}>
                    <BrandLogo size="sm" style={styles.logoBadge} />
                    <View>
                      <Text style={styles.logoTitle}>
                        Link<Text style={{ color: '#FA7E2B' }}>Up</Text>
                      </Text>
                      <Text style={styles.logoSub}>Security Verification</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3D Courier / Security Illustration Container */}
              <View style={[styles.courierIllustrationWrap, keyboardVisible && styles.courierWrapCompact]}>
                <Image
                  source={require('../../../../assets/auth_courier_hero.jpg')}
                  style={[styles.courierImage, keyboardVisible && styles.courierImageCompact]}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Bottom Clean White Sheet */}
            <View style={styles.bottomSheetCard}>
              <View style={styles.titleBadgeRow}>
                <Text style={styles.sheetTitle}>Create New Password</Text>
                <ShieldCheck size={20} color="#10B981" />
              </View>
              <Text style={styles.sheetSubtitle}>
                Please choose a strong password with at least 6 characters to secure your LinkUp account.
              </Text>

              {/* 1. New Password Input Pill */}
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputPill}>
                <Lock size={18} color="#9CA3AF" strokeWidth={2.2} />
                <TextInput
                  placeholder="Enter new password (min. 6 characters)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.pillInput}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#6B7280" />
                  ) : (
                    <Eye size={18} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>

              {/* 2. Confirm Password Input Pill */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Confirm New Password</Text>
              <View style={styles.inputPill}>
                <Lock size={18} color="#9CA3AF" strokeWidth={2.2} />
                <TextInput
                  placeholder="Re-enter your new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.pillInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color="#6B7280" />
                  ) : (
                    <Eye size={18} color="#6B7280" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Password Requirements Checklist */}
              <View style={styles.checkWrap}>
                <View style={styles.checkItem}>
                  <CheckCircle2
                    size={15}
                    color={isValidLength ? '#10B981' : '#CBD5E1'}
                    strokeWidth={2.4}
                  />
                  <Text style={[styles.checkText, isValidLength && styles.checkTextValid]}>
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  <CheckCircle2
                    size={15}
                    color={isMatching ? '#10B981' : '#CBD5E1'}
                    strokeWidth={2.4}
                  />
                  <Text style={[styles.checkText, isMatching && styles.checkTextValid]}>
                    Passwords match
                  </Text>
                </View>
              </View>

              {/* Primary Action Button */}
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  (!isValidLength || !isMatching || loading) && styles.btnDisabled,
                ]}
                onPress={handleUpdatePassword}
                disabled={!isValidLength || !isMatching || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Set New Password</Text>
                )}
              </TouchableOpacity>

              {/* Cancel & Return to Login */}
              <View style={styles.footerRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginLink}>Cancel and Return to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    paddingBottom: 260,
  },

  // 1. Top Warm Hero Section
  heroSection: {
    backgroundColor: '#FBE4D2',
    position: 'relative',
    minHeight: 200,
    justifyContent: 'space-between',
  },
  heroSectionCompact: {
    minHeight: 100,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Hero illustration
  courierIllustrationWrap: {
    width: SCREEN_WIDTH,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierWrapCompact: {
    height: 50,
    opacity: 0.4,
  },
  courierImage: {
    width: SCREEN_WIDTH * 0.75,
    height: 140,
  },
  courierImageCompact: {
    height: 50,
  },

  // 2. Bottom Clean White Sheet
  bottomSheetCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    letterSpacing: 0.1,
  },

  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 50,
  },
  pillInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },

  checkWrap: {
    marginTop: 14,
    marginBottom: 22,
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  checkTextValid: {
    color: '#0F172A',
  },

  // Primary action button
  primaryActionBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FA7E2B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  btnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  footerRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
});
