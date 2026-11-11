import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { toast } from '../../../components/ui';
import { supabase } from '../../../services/supabase';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  User,
  Mail,
  Phone,
  Lock,
  ShoppingBag,
  Store,
  Truck,
  Megaphone,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 5;

const ROLES = [
  {
    id: 'buyer',
    title: 'Buyer & Shopper',
    desc: 'Browse local products, order food & send on-demand packages',
    icon: ShoppingBag,
    badge: 'Popular',
  },
  {
    id: 'seller',
    title: 'Merchant / Seller',
    desc: 'List products, accept escrow payments & scale your local sales',
    icon: Store,
    badge: 'Earn ₦',
  },
  {
    id: 'logistics',
    title: 'Express Courier',
    desc: 'Deliver parcels on bike/car and receive instant wallet payouts',
    icon: Truck,
    badge: 'Flexible',
  },
  {
    id: 'promoter',
    title: 'Affiliate Promoter',
    desc: 'Earn recurring commissions by sharing deals & referring stores',
    icon: Megaphone,
    badge: 'Earn Cuts',
  },
];

export function RegisterScreen() {
  const navigation = useNavigation<any>();

  // Form State
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  // Keyboard visibility & height listener to dynamically lift button above keyboard on Android & iOS
  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const h = e?.endCoordinates?.height || 280;
      setKeyboardVisible(true);
      Animated.timing(keyboardHeightAnim, {
        toValue: h + 22,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    };

    const handleKeyboardHide = (e: any) => {
      setKeyboardVisible(false);
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
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
  }, [keyboardHeightAnim]);

  // Framer-Motion style Spring & Timing values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // Input references for autoFocus
  const nameInputRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  // Auto-focus input on step change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 1) nameInputRef.current?.focus?.();
      else if (step === 2) emailInputRef.current?.focus?.();
      else if (step === 3) phoneInputRef.current?.focus?.();
      else if (step === 5) passwordInputRef.current?.focus?.();
    }, 280);
    return () => clearTimeout(timer);
  }, [step]);

  // Framer-Motion Smooth Transition: Forward
  const animateForward = (nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 1. Exit current step with slide-left and subtle scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -35,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(35);

      // 2. Animate next step in with spring physics
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: nextStep / TOTAL_STEPS,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  // Framer-Motion Smooth Transition: Backward
  const animateBackward = (prevStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 35,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(prevStep);
      slideAnim.setValue(-35);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: prevStep / TOTAL_STEPS,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  // Step Validation Checkers
  const isNameValid = fullName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPhoneValid = phone.trim().replace(/\D/g, '').length >= 10;
  const isPasswordValid = password.length >= 6;

  const handleNext = () => {
    if (step === 1) {
      if (!isNameValid) {
        toast.warning('Name Required', { description: 'Please enter your real full name to continue.' });
        return;
      }
      animateForward(2);
    } else if (step === 2) {
      if (!isEmailValid) {
        toast.warning('Valid Email Required', { description: 'Please enter a valid email address.' });
        return;
      }
      animateForward(3);
    } else if (step === 3) {
      if (!isPhoneValid) {
        toast.warning('Phone Number Required', { description: 'Please enter a valid 10 or 11 digit Nigerian phone number.' });
        return;
      }
      animateForward(4);
    } else if (step === 4) {
      animateForward(5);
    } else if (step === 5) {
      handleCompleteRegistration();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateBackward(step - 1);
    } else {
      navigation.goBack();
    }
  };

  // Final Account Creation
  const handleCompleteRegistration = async () => {
    Keyboard.dismiss();
    if (!isPasswordValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: selectedRole,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: fullName.trim(),
          phone: phone.trim(),
          role: selectedRole,
          onboarding_completed: true,
        });

        await supabase.from('user_roles').upsert({
          user_id: data.user.id,
          role: selectedRole,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Welcome to Linkup! 🎉', {
        description: 'Account created successfully',
      });

      setTimeout(() => {
        if (selectedRole === 'seller') {
          navigation.navigate('SellerDashboard');
        } else if (selectedRole === 'logistics' || selectedRole === 'driver') {
          navigation.navigate('LogisticsDashboard');
        } else if (selectedRole === 'promoter') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }, { name: 'PromoterDashboard' }],
          });
        } else if (selectedRole === 'admin') {
          navigation.navigate('AdminDashboard');
        } else {
          navigation.navigate('MainTabs', { screen: 'HomeTab' });
        }
      }, 900);
    } catch (err: any) {
      toast.error('Registration Failed', {
        description: err.message || 'Could not complete registration. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Password Strength Score
  const getPasswordStrength = () => {
    if (password.length === 0) return { label: '', percent: 0, color: '#e2e8f0' };
    if (password.length < 6) return { label: 'Weak', percent: 0.33, color: '#ef4444' };
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    if (password.length >= 8 && hasLetters && hasNumbers) {
      return { label: 'Strong', percent: 1, color: '#10b981' };
    }
    return { label: 'Good', percent: 0.66, color: '#f59e0b' };
  };

  const strength = getPasswordStrength();

  // Progress Bar Width Interpolation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeView
      edges={keyboardVisible ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      {/* Top Navigation Bar with Fluid Progress */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Stepper Count Badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            Step <Text style={{ color: colors.primary }}>{step}</Text> of {TOTAL_STEPS}
          </Text>
        </View>

        {/* Right Logo Badge */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.signInLink}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {/* Smooth Expanding Progress Bar */}
      <View style={styles.progressBarTrack}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 14 : 0}
      >
        <View style={[styles.container, keyboardVisible && styles.containerCompact]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {/* Scrollable Step Content Area */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[
                styles.scrollContent,
                keyboardVisible && styles.scrollContentCompact,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Animated Step Container with Fluid Framer-Motion Physics */}
              <Animated.View
                style={[
                  styles.stepAnimatedWrap,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
                  },
                ]}
              >
                {/* STEP 1: Full Name */}
                {step === 1 && (
                  <View style={styles.stepContent}>
                    <View
                      style={[
                        styles.stepIconBubble,
                        keyboardVisible && styles.stepIconBubbleCompact,
                      ]}
                    >
                      <User size={keyboardVisible ? 20 : 26} color={colors.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.stepQuestion, keyboardVisible && styles.stepQuestionCompact]}>
                      What's your name?
                    </Text>
                    <Text style={[styles.stepSubtitle, keyboardVisible && styles.stepSubtitleCompact]}>
                      Enter your real name so sellers, buyers, and dispatch riders know who they're linking up with.
                    </Text>

                    <View style={[styles.bigInputWrap, keyboardVisible && styles.bigInputWrapCompact]}>
                      <TextInput
                        ref={nameInputRef}
                        placeholder="e.g. Damian Linkup"
                        placeholderTextColor="#94a3b8"
                        style={styles.bigInput}
                        value={fullName}
                        onChangeText={setFullName}
                        onFocus={() => setKeyboardVisible(true)}
                        returnKeyType="next"
                        onSubmitEditing={handleNext}
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={styles.hintRow}>
                      <ShieldCheck size={14} color="#64748b" />
                      <Text style={styles.hintText}>Your identity is protected under LinkUp Escrow</Text>
                    </View>
                  </View>
                )}

                {/* STEP 2: Email Address */}
                {step === 2 && (
                  <View style={styles.stepContent}>
                    <View
                      style={[
                        styles.stepIconBubble,
                        keyboardVisible && styles.stepIconBubbleCompact,
                      ]}
                    >
                      <Mail size={keyboardVisible ? 20 : 26} color={colors.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.stepQuestion, keyboardVisible && styles.stepQuestionCompact]}>
                      What's your email?
                    </Text>
                    <Text style={[styles.stepSubtitle, keyboardVisible && styles.stepSubtitleCompact]}>
                      We'll send your instant payment confirmations, digital receipts, and security alerts here.
                    </Text>

                    <View style={[styles.bigInputWrap, keyboardVisible && styles.bigInputWrapCompact]}>
                      <TextInput
                        ref={emailInputRef}
                        placeholder="name@example.com"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.bigInput}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setKeyboardVisible(true)}
                        returnKeyType="next"
                        onSubmitEditing={handleNext}
                      />
                    </View>

                    {email.length > 0 && (
                      <View style={styles.validationRow}>
                        {isEmailValid ? (
                          <>
                            <CheckCircle2 size={15} color={colors.success} strokeWidth={2.4} />
                            <Text style={[styles.validationText, { color: colors.success }]}>
                              Valid email format
                            </Text>
                          </>
                        ) : (
                          <Text style={[styles.validationText, { color: '#ef4444' }]}>
                            Please enter a valid email address
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* STEP 3: Phone Number */}
                {step === 3 && (
                  <View style={styles.stepContent}>
                    <View
                      style={[
                        styles.stepIconBubble,
                        keyboardVisible && styles.stepIconBubbleCompact,
                      ]}
                    >
                      <Phone size={keyboardVisible ? 20 : 26} color={colors.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.stepQuestion, keyboardVisible && styles.stepQuestionCompact]}>
                      Your phone number?
                    </Text>
                    <Text style={[styles.stepSubtitle, keyboardVisible && styles.stepSubtitleCompact]}>
                      Dispatch couriers call or WhatsApp this number when delivering your orders and packages.
                    </Text>

                    <View style={[styles.phoneInputWrap, keyboardVisible && styles.phoneInputWrapCompact]}>
                      <View style={styles.countryBadge}>
                        <Text style={styles.flagText}>🇳🇬</Text>
                        <Text style={styles.countryCode}>+234</Text>
                      </View>
                      <TextInput
                        ref={phoneInputRef}
                        placeholder="801 234 5678"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        style={styles.phoneInput}
                        value={phone}
                        onChangeText={setPhone}
                        onFocus={() => setKeyboardVisible(true)}
                        returnKeyType="next"
                        onSubmitEditing={handleNext}
                        maxLength={11}
                      />
                    </View>

                    <View style={styles.hintRow}>
                      <Text style={styles.hintText}>Instant SMS & WhatsApp delivery dispatch alerts</Text>
                    </View>
                  </View>
                )}

                {/* STEP 4: Choose Primary Role */}
                {step === 4 && (
                  <View style={styles.stepContent}>
                    <View style={styles.stepIconBubble}>
                      <Sparkles size={26} color={colors.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.stepQuestion}>How will you use Linkup?</Text>
                    <Text style={styles.stepSubtitle}>
                      Select your primary mode. You can switch or add more modes anytime from your profile.
                    </Text>

                    <View style={styles.rolesList}>
                      {ROLES.map((r) => {
                        const active = selectedRole === r.id;
                        const Icon = r.icon;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.roleCard, active && styles.roleCardActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedRole(r.id);
                            }}
                            activeOpacity={0.8}
                          >
                            <View
                              style={[
                                styles.roleIconWrap,
                                active && styles.roleIconWrapActive,
                              ]}
                            >
                              <Icon
                                size={22}
                                color={active ? colors.primary : '#475569'}
                                strokeWidth={2.3}
                              />
                            </View>

                            <View style={styles.roleTextWrap}>
                              <View style={styles.roleTitleRow}>
                                <Text
                                  style={[
                                    styles.roleTitle,
                                    active && styles.roleTitleActive,
                                  ]}
                                >
                                  {r.title}
                                </Text>
                                <View
                                  style={[
                                    styles.roleTag,
                                    active && styles.roleTagActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.roleTagText,
                                      active && styles.roleTagTextActive,
                                    ]}
                                  >
                                    {r.badge}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.roleDesc}>{r.desc}</Text>
                            </View>

                            <View
                              style={[
                                styles.checkCircle,
                                active && styles.checkCircleActive,
                              ]}
                            >
                              {active && (
                                <Check size={14} color="#ffffff" strokeWidth={3} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* STEP 5: Create Password */}
                {step === 5 && (
                  <View style={styles.stepContent}>
                    <View
                      style={[
                        styles.stepIconBubble,
                        keyboardVisible && styles.stepIconBubbleCompact,
                      ]}
                    >
                      <Lock size={keyboardVisible ? 20 : 26} color={colors.primary} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.stepQuestion, keyboardVisible && styles.stepQuestionCompact]}>
                      Set a secure password
                    </Text>
                    <Text style={[styles.stepSubtitle, keyboardVisible && styles.stepSubtitleCompact]}>
                      Choose at least 6 characters to safeguard your Linkup wallet and orders.
                    </Text>

                    <View style={[styles.bigInputWrap, keyboardVisible && styles.bigInputWrapCompact]}>
                      <TextInput
                        ref={passwordInputRef}
                        placeholder="Minimum 6 characters"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.bigInput, { paddingRight: 40 }]}
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setKeyboardVisible(true)}
                        returnKeyType="done"
                        onSubmitEditing={handleCompleteRegistration}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color="#64748b" />
                        ) : (
                          <Eye size={20} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Password Strength Meter */}
                    {password.length > 0 && (
                      <View style={styles.strengthWrap}>
                        <View style={styles.strengthHeader}>
                          <Text style={styles.strengthTitle}>Password Strength:</Text>
                          <Text style={[styles.strengthLabel, { color: strength.color }]}>
                            {strength.label}
                          </Text>
                        </View>
                        <View style={styles.strengthTrack}>
                          <View
                            style={[
                              styles.strengthFill,
                              {
                                width: `${strength.percent * 100}%`,
                                backgroundColor: strength.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}

                    {!keyboardVisible && (
                      <View style={styles.summaryBox}>
                        <Text style={styles.summaryTitle}>Your Setup Summary</Text>
                        <Text style={styles.summaryItem}>• Name: {fullName || '—'}</Text>
                        <Text style={styles.summaryItem}>• Email: {email || '—'}</Text>
                        <Text style={styles.summaryItem}>• Role: {selectedRole.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Animated.View>
            </ScrollView>
          </TouchableWithoutFeedback>

          {/* Bottom Floating Action Button - Docked outside ScrollView and lifted above Android & iOS keyboard */}
          <Animated.View
            style={[
              styles.footer,
              keyboardVisible && styles.footerCompact,
              Platform.OS === 'android' && {
                marginBottom: keyboardHeightAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.continueBtn,
                keyboardVisible && styles.continueBtnCompact,
                loading && styles.continueBtnDisabled,
              ]}
              onPress={handleNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.continueBtnText}>
                    {step === TOTAL_STEPS ? 'Create Account' : 'Continue'}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            {!keyboardVisible && (
              <Text style={styles.termsText}>
                By continuing, you agree to Linkup's Terms & Escrow Policy
              </Text>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
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
  stepBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.2,
  },
  signInLink: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    paddingHorizontal: 4,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary, // #EB7D30
    borderRadius: 2,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  containerCompact: {
    paddingTop: 6,
    paddingBottom: 0,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scrollContentCompact: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  stepAnimatedWrap: {
    flexGrow: 1,
  },
  stepContent: {
    flexGrow: 1,
  },
  stepIconBubble: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  stepIconBubbleCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 10,
  },
  stepQuestion: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 6,
  },
  stepQuestionCompact: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  stepSubtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  bigInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    paddingHorizontal: 18,
    height: 60,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bigInputWrapCompact: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  bigInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    height: 60,
    overflow: 'hidden',
  },
  phoneInputWrapCompact: {
    height: 52,
    borderRadius: 14,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  flagText: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  phoneInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 16,
  },
  eyeBtn: {
    padding: 8,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  hintText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rolesList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.8,
    borderColor: '#e2e8f0',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  roleIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: '#ffffff',
  },
  roleTextWrap: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleTitleActive: {
    color: colors.primary,
  },
  roleTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTagActive: {
    backgroundColor: '#fed7aa',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  roleTagTextActive: {
    color: colors.primaryDark,
  },
  roleDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  strengthWrap: {
    marginTop: 14,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  strengthTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryItem: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  footer: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 4,
    backgroundColor: '#FDFEFE',
  },
  footerCompact: {
    paddingTop: 6,
    paddingBottom: 4,
    gap: 0,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary, // #EB7D30
    height: 56,
    borderRadius: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnCompact: {
    height: 50,
    borderRadius: 16,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  termsText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '600',
  },
});
