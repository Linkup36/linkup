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
  Image,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { toast } from '../../../components/ui';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
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
    id: 'promoter',
    title: 'Affiliate Promoter',
    desc: 'Earn recurring commission & rewards by sharing products you love',
    icon: Megaphone,
    badge: 'Earn %',
  },
  {
    id: 'logistics',
    title: 'Express Courier',
    desc: 'Deliver parcels on bike/car and receive instant wallet payouts',
    icon: Truck,
    badge: 'Flexible',
  },
];

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { refreshProfile } = useAuth();

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

  // Final Account Creation & Instant Redirect (Web Parity - No Email Confirmation Barrier)
  const handleCompleteRegistration = async () => {
    Keyboard.dismiss();
    if (!isPasswordValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();
      const trimmedPhone = phone.trim();

      // 1. Invoke signup-user edge function for instant account creation without email confirmation
      let signupSuccess = false;
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('signup-user', {
          body: {
            email: trimmedEmail,
            password,
            displayName: trimmedName,
            fullName: trimmedName,
            phone: trimmedPhone,
            role: selectedRole,
          },
        });

        if (fnError) {
          console.warn('[RegisterScreen] signup-user edge function warning:', fnError);
        } else if (fnData?.error) {
          throw new Error(fnData.error);
        } else if (fnData?.success) {
          signupSuccess = true;
        }
      } catch (fnErr: any) {
        if (
          fnErr?.message?.toLowerCase().includes('already registered') ||
          fnErr?.message?.toLowerCase().includes('already exists')
        ) {
          throw fnErr;
        }
        console.warn('[RegisterScreen] edge function invocation error, falling back to direct auth:', fnErr);
      }

      // 2. If edge function didn't create user, fallback to direct signUp
      if (!signupSuccess) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: 'linkup://login',
            data: {
              display_name: trimmedName,
              full_name: trimmedName,
              phone: trimmedPhone,
              role: selectedRole,
            },
          },
        });
        if (signUpError) throw signUpError;
      }

      // 3. Immediately sign in to acquire active session
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        console.warn('[RegisterScreen] Immediate signIn warning:', signInError);
      }

      // 4. Ensure profile & roles & wallet are initialized
      const currentUser = sessionData?.user;
      if (currentUser) {
        try {
          await supabase.from('profiles').upsert({
            id: currentUser.id,
            display_name: trimmedName,
            phone: trimmedPhone,
            onboarding_completed: true,
          });

          await supabase.rpc('manage_user_roles', {
            p_user_id: currentUser.id,
            p_roles: selectedRole === 'buyer' ? ['buyer'] : [selectedRole, 'buyer'],
          });

          await supabase.from('wallets').upsert({
            user_id: currentUser.id,
            balance: 0,
          });
        } catch (dbErr) {
          console.warn('[RegisterScreen] Post-signup DB setup warning:', dbErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Account Created! 🎉', {
        description: `Welcome to Linkup, ${trimmedName}!`,
      });

      await refreshProfile();

      // 5. Instantly redirect based on role (mirroring web implementation)
      setTimeout(() => {
        if (selectedRole === 'seller') {
          navigation.navigate('SellerDashboard');
        } else if (selectedRole === 'logistics' || selectedRole === 'driver') {
          navigation.navigate('LogisticsDashboard');
        } else if (selectedRole === 'promoter') {
          navigation.navigate('PromoterDashboard');
        } else if (selectedRole === 'admin') {
          navigation.navigate('AdminDashboard');
        } else {
          navigation.navigate('MainTabs', { screen: 'HomeTab' });
        }
      }, 500);
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists')
      ) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Would you like to sign in instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Sign In',
              onPress: () =>
                navigation.navigate('Login', { email: email.trim().toLowerCase() }),
            },
          ]
        );
      } else {
        toast.error('Registration Failed', {
          description: msg || 'Could not complete registration. Please try again.',
        });
      }
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
      edges={['top', 'left', 'right']}
      style={styles.safeContainer}
    >
      {/* Top Warm Peach Hero Section */}
      <View style={[styles.heroSection, keyboardVisible && styles.heroSectionCompact]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backCircleBtn}
            onPress={handleBack}
            activeOpacity={0.75}
          >
            <ArrowLeft size={18} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Stepper Count Badge */}
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              Step <Text style={{ color: '#FA7E2B' }}>{step}</Text> of {TOTAL_STEPS}
            </Text>
          </View>

          {/* Right Log In Link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.signInLink}>Log In</Text>
          </TouchableOpacity>
        </View>

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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, keyboardVisible && styles.containerCompact]}>
          {/* Smooth Expanding Progress Bar inside bottom card */}
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
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
              <View style={styles.guestLinkWrap}>
                <TouchableOpacity
                  style={styles.guestTrackRow}
                  onPress={() => {
                    if (navigation.canGoBack()) navigation.goBack();
                    navigation.navigate('MainTabs', { screen: 'SendTab' });
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.guestTrackText}>Quick Track as Guest</Text>
                  <ArrowRight size={13} color="#FA7E2B" strokeWidth={2.6} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('TermsAndPrivacy', { initialTab: 'terms' });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.termsText}>
                    By continuing, you agree to LinkUp's{' '}
                    <Text style={styles.termsLinkHighlight}>Terms of Service</Text> &{' '}
                    <Text style={styles.termsLinkHighlight}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FBE4D2',
  },
  heroSection: {
    backgroundColor: '#FBE4D2',
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  heroSectionCompact: {
    paddingBottom: 4,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 10,
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
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 14,
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
    fontWeight: '900',
    color: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  courierIllustrationWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 120,
    marginTop: -2,
  },
  courierImage: {
    width: SCREEN_WIDTH * 0.48,
    height: 118,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    justifyContent: 'space-between',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FA7E2B',
    borderRadius: 2,
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
    lineHeight: 16,
  },
  termsLinkHighlight: {
    color: '#FA7E2B',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  guestLinkWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  guestTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 6,
  },
  guestTrackText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  // Email Verification Screen Styles
  verificationContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#FDFEFE',
  },
  verificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  verificationIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 20,
    maxWidth: '100%',
  },
  emailBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  verificationStepsCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  verificationStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  verificationStepText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  signInPrimaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  signInPrimaryText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  resendBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  changeEmailBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  changeEmailText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

