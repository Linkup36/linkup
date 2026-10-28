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
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ResetPasswordSuccessModal } from '../components/ResetPasswordSuccessModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialEmail = route.params?.email || '';
  const scrollRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  useEffect(() => {
    const handleKeyboardShow = () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 50, animated: true });
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

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!email.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.warning('Required Field', { description: 'Please enter your registered email address.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'linkup://reset-password',
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessModalVisible(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error('Reset Failed', { description: err.message || 'Could not send reset email.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'linkup://reset-password',
    });
    if (error) {
      toast.error('Resend Failed', { description: error.message || 'Could not resend email.' });
      throw error;
    }
    toast.success('Reset Link Sent', { description: 'A fresh reset email was delivered to your inbox.' });
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
                      <Text style={styles.logoSub}>Express Parcel</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3D Courier Illustration Container */}
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
              <Text style={styles.sheetTitle}>Reset Password</Text>
              <Text style={styles.sheetSubtitle}>
                Enter your registered email address and we'll send you an instant reset verification link.
              </Text>

              {/* Email Input Pill */}
              <View style={styles.inputPill}>
                <Mail size={18} color="#9CA3AF" strokeWidth={2.2} />
                <TextInput
                  placeholder="name@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.pillInput}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Primary Reset Button */}
              <TouchableOpacity
                style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              {/* Return to Sign In */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Remember your password? </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loginLink}>Log In</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Track as Guest Link */}
              <TouchableOpacity
                style={styles.guestTrackRow}
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  navigation.navigate('MainTabs', { screen: 'SendTab' });
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.guestTrackText}>Quick Track as Guest</Text>
                <ArrowRight size={14} color="#FA7E2B" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Modern Reset Password Success Modal */}
      <ResetPasswordSuccessModal
        visible={successModalVisible}
        email={email.trim()}
        onClose={() => setSuccessModalVisible(false)}
        onReturnToSignIn={() => {
          setSuccessModalVisible(false);
          navigation.goBack();
        }}
        onResend={handleResendEmail}
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
    paddingBottom: 260,
  },

  // 1. Top Warm Hero Section
  heroSection: {
    backgroundColor: '#FBE4D2',
    position: 'relative',
    minHeight: 220,
    justifyContent: 'space-between',
  },
  heroSectionCompact: {
    minHeight: 110,
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
    fontSize: 18,
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
    height: 180,
    marginTop: 4,
    paddingBottom: 6,
  },
  courierWrapCompact: {
    height: 60,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  courierImage: {
    width: SCREEN_WIDTH * 0.72,
    height: 175,
  },
  courierImageCompact: {
    height: 60,
    opacity: 0.4,
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
  sheetTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 22,
  },

  // Input Pill
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
  },
  pillInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    paddingHorizontal: 12,
    height: '100%',
  },

  // Primary Action Button
  primaryActionBtn: {
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
  primaryActionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Footer Links
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  guestTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 16,
  },
  guestTrackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FA7E2B',
  },
});
