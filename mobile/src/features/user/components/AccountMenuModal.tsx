import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  User,
  Package,
  Send,
  Wallet,
  MapPin,
  Bell,
  Volume2,
  VolumeX,
  LogOut,
  UserCog,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  Check,
  X,
  Store,
  Megaphone,
  Truck,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import { LocalStorage } from '../../../storage/localStorage';
import { supabase } from '../../../services/supabase';
import {
  registerForPushNotificationsAsync,
  triggerLocalTestNotificationAsync,
} from '../../../services/notifications';
import { QuickEditProfileModal } from './QuickEditProfileModal';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AccountMenuModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

export function AccountMenuModal({
  visible,
  onClose,
  accentColor = '#E86129',
}: AccountMenuModalProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, roles, activeRole, setActiveRole, signOut, refreshProfile } = useAuth();
  const userRoles = React.useMemo(() => {
    const list = [...(roles || [])];
    if (profile?.role && !list.includes(profile.role)) list.push(profile.role);
    if (activeRole && !list.includes(activeRole)) list.push(activeRole);
    return list;
  }, [roles, profile?.role, activeRole]);

  const isSeller = userRoles.includes('seller');
  const isPromoter = userRoles.includes('promoter');
  const isLogistics = userRoles.includes('logistics');
  const isAdmin = userRoles.includes('admin');

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isPushActive, setIsPushActive] = useState(true);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);

  // Framer-motion style spring entrance values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const translateYAnim = useRef(new Animated.Value(-12)).current;
  const isClosingRef = useRef(false);

  // Load sound preferences
  useEffect(() => {
    async function loadSoundPref() {
      const stored = await LocalStorage.getItem<boolean>('linkup_sound_enabled');
      if (stored !== null && stored !== undefined) {
        setSoundEnabled(stored);
      }
    }
    loadSoundPref();
  }, []);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      translateYAnim.setValue(-12);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: -8,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  // 1. My Registry Page
  const handleGoRegistry = () => {
    onClose();
    navigation.navigate('Profile');
  };

  // 2. Quick Edit Profile
  const handleOpenQuickEdit = () => {
    onClose();
    setTimeout(() => {
      setIsQuickEditOpen(true);
    }, 150);
  };

  // 3. My Orders
  const handleGoOrders = () => {
    onClose();
    navigation.navigate('Orders');
  };

  // 4. My Sent Packages
  const handleGoSentPackages = () => {
    onClose();
    navigation.navigate('SendHistory');
  };

  // 5. My Wallet & Refunds
  const handleGoWallet = () => {
    onClose();
    navigation.navigate('Wallet');
  };

  // 6. Allow Location Access / GPS
  const handleToggleLocation = async () => {
    if (!user) return;
    setIsUpdatingLocation(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsUpdatingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let detectedAddress = '';
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          detectedAddress = [geo.streetNumber, geo.street, geo.district, geo.city]
            .filter(Boolean)
            .join(', ');
        }
      } catch (e) {
        console.warn('Geocode error:', e);
      }

      const updates: any = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        updated_at: new Date().toISOString(),
      };
      if (detectedAddress && !profile?.address) {
        updates.address = detectedAddress;
      }

      await supabase.from('profiles').update(updates).eq('id', user.id);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (err) {
      console.warn('[AccountMenuModal] Location update error:', err);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // 7. Push Alerts Toggle & Live Test Trigger
  const handleTogglePush = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    try {
      if (user) {
        await registerForPushNotificationsAsync(user.id);
      }
      setIsPushActive(true);
      // Immediately fire heads-up notification banner on phone!
      await triggerLocalTestNotificationAsync({
        userId: user?.id,
        title: '🔔 LinkUp Live Alerts Enabled',
        body: 'Real-time push alerts are active on your Android phone! Heads-up banner test passed.',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    } catch (e: any) {
      console.warn('Push registration notice:', e);
    }
  };

  const handleGoNotifications = () => {
    onClose();
    navigation.navigate('Notifications');
  };

  // 8. Sound Toggle
  const handleToggleSound = async () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    await LocalStorage.setItem('linkup_sound_enabled', nextVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
  };

  // 9. Logout Account
  const handleLogout = async () => {
    onClose();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
    await signOut();
    navigation.navigate('MainTabs', { screen: 'HomeTab' });
  };

  const hasGpsCoordinates = Boolean(profile?.latitude && profile?.longitude);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          {/* Animated visual dimmed backdrop */}
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, { opacity: fadeAnim }]}
          />

          {/* Full-screen Backdrop Touchable to dismiss when clicking outside */}
          <TouchableOpacity
            style={styles.backdropTouchArea}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close account menu"
          />

          {/* Account Dropdown Flyout Card */}
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: translateYAnim },
                ],
              },
            ]}
          >
            {/* Header: Title and Close Button */}
            <View style={styles.cardHeader}>
              <Text style={styles.title}>Account</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close account menu"
                accessibilityRole="button"
              >
                <X size={16} color="#64748b" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Menu Items */}
            <View style={styles.menuList}>
              {/* 0a. Promoter Hub (if active promoter) */}
              {isPromoter && (
                <TouchableOpacity
                  style={[
                    styles.ordersHighlightPill,
                    {
                      backgroundColor: '#FFF7ED',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: '#FED7AA',
                      marginBottom: 6,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    setActiveRole('promoter');
                    navigation.navigate('PromoterDashboard');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Megaphone size={19} color="#EB7D30" strokeWidth={2.4} />
                    <View>
                      <Text style={[styles.ordersText, { color: '#EB7D30', fontWeight: '800' }]}>
                        Promoter Hub
                      </Text>
                      <Text style={{ fontSize: 10, color: '#9A3412', fontWeight: '500' }}>
                        Affiliate links, clicks & 5% payouts
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#EB7D30" strokeWidth={2.4} />
                </TouchableOpacity>
              )}

              {/* 0b. Seller Dashboard (if active seller) */}
              {isSeller && (
                <TouchableOpacity
                  style={[
                    styles.ordersHighlightPill,
                    {
                      backgroundColor: '#0f172a',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: 'rgba(233, 111, 40, 0.4)',
                      marginBottom: 6,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    setActiveRole('seller');
                    navigation.navigate('SellerDashboard');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Store size={19} color={accentColor} strokeWidth={2.4} />
                    <View>
                      <Text style={[styles.ordersText, { color: '#ffffff', fontWeight: '800' }]}>
                        Seller Dashboard
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '500' }}>
                        Manage inventory, orders & payouts
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={accentColor} strokeWidth={2.4} />
                </TouchableOpacity>
              )}

              {/* 0c. Logistics Fleet (if active rider) */}
              {isLogistics && (
                <TouchableOpacity
                  style={[
                    styles.ordersHighlightPill,
                    {
                      backgroundColor: '#F0FDF4',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                      marginBottom: 6,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    setActiveRole('logistics');
                    navigation.navigate('LogisticsDashboard');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Truck size={19} color="#16A34A" strokeWidth={2.4} />
                    <View>
                      <Text style={[styles.ordersText, { color: '#16A34A', fontWeight: '800' }]}>
                        Logistics Fleet
                      </Text>
                      <Text style={{ fontSize: 10, color: '#15803D', fontWeight: '500' }}>
                        Delivery missions & dispatch feed
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#16A34A" strokeWidth={2.4} />
                </TouchableOpacity>
              )}

              {/* 1. My Registry Page */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleGoRegistry}
                activeOpacity={0.7}
              >
                <User size={18} color="#475569" strokeWidth={2.2} />
                <Text style={styles.menuText}>My Registry Page</Text>
              </TouchableOpacity>

              {/* 2. Quick Edit Profile */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleOpenQuickEdit}
                activeOpacity={0.7}
              >
                <UserCog size={18} color="#475569" strokeWidth={2.2} />
                <Text style={styles.menuText}>Quick Edit Profile</Text>
              </TouchableOpacity>

              {/* 3. My Orders (Highlighted Pill) */}
              <TouchableOpacity
                style={styles.ordersHighlightPill}
                onPress={handleGoOrders}
                activeOpacity={0.8}
              >
                <Package size={20} color={accentColor} strokeWidth={2.4} />
                <Text style={[styles.ordersText, { color: accentColor }]}>
                  My Orders
                </Text>
              </TouchableOpacity>

              {/* 4. My Sent Packages */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleGoSentPackages}
                activeOpacity={0.7}
              >
                <Send size={18} color={accentColor} strokeWidth={2.4} />
                <Text style={styles.menuText}>My Sent Packages</Text>
              </TouchableOpacity>

              {/* 5. My Wallet & Refunds */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleGoWallet}
                activeOpacity={0.7}
              >
                <Wallet size={18} color="#059669" strokeWidth={2.2} />
                <Text style={styles.menuText}>My Wallet & Refunds</Text>
              </TouchableOpacity>

              {/* Notifications & Live Test */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleGoNotifications}
                activeOpacity={0.7}
              >
                <Bell size={18} color={accentColor} strokeWidth={2.4} />
                <Text style={styles.menuText}>Notifications & Live Test</Text>
              </TouchableOpacity>

              {/* Admin Portal (if admin) */}
              {(roles?.includes('admin') || profile?.role === 'admin') && (
                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: '#FFF7ED', borderRadius: 10 }]}
                  onPress={() => {
                    onClose();
                    navigation.navigate('AdminDashboard');
                  }}
                  activeOpacity={0.7}
                >
                  <ShieldCheck size={18} color="#EA580C" strokeWidth={2.4} />
                  <Text style={[styles.menuText, { color: '#EA580C', fontWeight: '800' }]}>
                    Admin Portal
                  </Text>
                </TouchableOpacity>
              )}

              {/* 6. Allow Location Access */}
              <TouchableOpacity
                style={styles.locationRow}
                onPress={handleToggleLocation}
                disabled={isUpdatingLocation}
                activeOpacity={0.7}
              >
                <View style={styles.locationLeft}>
                  {isUpdatingLocation ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : (
                    <MapPin size={18} color={accentColor} strokeWidth={2.4} />
                  )}
                  <View style={styles.locationTextWrap}>
                    <Text style={styles.actionTitle} numberOfLines={1}>
                      {hasGpsCoordinates ? 'Update GPS Location' : 'Allow Location Access'}
                    </Text>
                    <Text style={styles.actionSubtitle} numberOfLines={1}>
                      {hasGpsCoordinates
                        ? `${profile?.latitude?.toFixed(3)}, ${profile?.longitude?.toFixed(3)}`
                        : 'Set precise delivery coord...'}
                    </Text>
                  </View>
                </View>

                {hasGpsCoordinates ? (
                  <View style={styles.activeDot} />
                ) : (
                  <View style={[styles.enablePill, { borderColor: accentColor }]}>
                    <Text style={[styles.enableText, { color: accentColor }]}>
                      Enable
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 7. Push Alerts Active */}
              <TouchableOpacity
                style={styles.locationRow}
                onPress={handleTogglePush}
                activeOpacity={0.7}
              >
                <View style={styles.locationLeft}>
                  <Bell size={18} color={accentColor} strokeWidth={2.4} />
                  <View style={styles.locationTextWrap}>
                    <Text style={styles.actionTitle} numberOfLines={1}>
                      Push Alerts Active
                    </Text>
                    <Text style={styles.actionSubtitle} numberOfLines={1}>
                      Live dispatch & order alerts
                    </Text>
                  </View>
                </View>

                {isPushActive ? (
                  <View style={styles.activeDot} />
                ) : (
                  <View style={[styles.enablePill, { borderColor: accentColor }]}>
                    <Text style={[styles.enableText, { color: accentColor }]}>
                      Enable
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 8. Sound Toggle */}
              <TouchableOpacity
                style={styles.soundRow}
                onPress={handleToggleSound}
                activeOpacity={0.7}
              >
                {soundEnabled ? (
                  <Volume2 size={19} color={accentColor} strokeWidth={2.4} />
                ) : (
                  <VolumeX size={19} color="#94a3b8" strokeWidth={2.4} />
                )}
                <Text
                  style={[
                    styles.soundText,
                    { color: soundEnabled ? accentColor : '#94a3b8' },
                  ]}
                >
                  Sound: {soundEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>

              {/* 9. Logout Account */}
              <TouchableOpacity
                style={styles.logoutRow}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <LogOut size={19} color="#ef4444" strokeWidth={2.4} />
                <Text style={styles.logoutText}>Logout Account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Quick Edit Profile Modal */}
      <QuickEditProfileModal
        visible={isQuickEditOpen}
        onClose={() => setIsQuickEditOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  backdropTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  card: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 74 : 58,
    right: 14,
    width: Math.min(SCREEN_WIDTH - 28, 310),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 20,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.9)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuList: {
    gap: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  ordersHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 3,
  },
  ordersText: {
    fontSize: 15,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  locationTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontWeight: '500',
  },
  enablePill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  enableText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  soundText: {
    fontSize: 15,
    fontWeight: '800',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ef4444',
  },
});
