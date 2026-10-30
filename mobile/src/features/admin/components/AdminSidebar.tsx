import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  X,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Truck,
  Wallet,
  Grid,
  Mail,
  Bell,
  LogOut,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

export interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tabKey: string) => void;
  counts: {
    activeOrders: number;
    totalOrders: number;
    users: number;
    openIssues: number;
    pendingPackages: number;
    pendingKyc: number;
  };
  profile: any;
  onExitToStore?: () => void;
  onLogout?: () => void;
  isLargeScreen?: boolean;
}

interface NavItemConfig {
  key: string;
  label: string;
  subtitle: string;
  icon: any;
  count?: number;
  badgeColor?: string;
}

interface NavGroupConfig {
  groupTitle: string;
  items: NavItemConfig[];
}

export function AdminSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  counts,
  profile,
  onExitToStore,
  onLogout,
  isLargeScreen = false,
}: AdminSidebarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = isLargeScreen ? 280 : Math.min(windowWidth * 0.84, 340);

  const [modalVisible, setModalVisible] = useState(isOpen);

  // Dynamic safe area insets calculations
  const safeTopPadding = isLargeScreen
    ? Math.max(insets.top, 16)
    : Math.max(insets.top, Platform.OS === 'ios' ? 48 : 28);
  const safeBottomPadding = Math.max(insets.bottom, 16);
  const safeLeftPadding = Math.max(insets.left, 0);

  // Spring animation values (Framer Motion physics simulation)
  const slideAnim = useRef(new Animated.Value(isLargeScreen ? 0 : -drawerWidth)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentScaleAnim = useRef(new Animated.Value(0.97)).current;
  const isClosingRef = useRef(false);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(contentScaleAnim, {
        toValue: 0.97,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      isClosingRef.current = false;
      onClose();
    });
  };

  const handleLogoutPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the Admin Portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            if (!isLargeScreen) handleClose();
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (isLargeScreen) {
      slideAnim.setValue(0);
      backdropAnim.setValue(0);
      contentScaleAnim.setValue(1);
      return;
    }

    if (isOpen) {
      isClosingRef.current = false;
      setModalVisible(true);
      slideAnim.setValue(-drawerWidth);
      backdropAnim.setValue(0);
      contentScaleAnim.setValue(0.97);

      Animated.parallel([
        // Framer Motion spring physics: damping: 24, stiffness: 280, mass: 0.8
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(contentScaleAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!isClosingRef.current && modalVisible) {
      handleClose();
    }
  }, [isOpen, isLargeScreen, drawerWidth]);

  // Swipe-to-dismiss gesture tracking
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture: any) => {
        return !isLargeScreen && gesture.dx < -15 && Math.abs(gesture.dy) < 30;
      },
      onPanResponderMove: (_, gesture: any) => {
        if (gesture.dx < 0) {
          slideAnim.setValue(Math.max(-drawerWidth, gesture.dx));
        }
      },
      onPanResponderRelease: (_, gesture: any) => {
        if (gesture.dx < -70 || gesture.vx < -0.45) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 22,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Grouped Navigation Structure
  const navigationGroups: NavGroupConfig[] = [
    {
      groupTitle: '',
      items: [
        {
          key: 'overview',
          label: 'Overview',
          subtitle: '',
          icon: LayoutDashboard,
        },
        {
          key: 'analytics',
          label: 'Analytics & Insights',
          subtitle: 'Platform KPIs & trends',
          icon: TrendingUp,
        },
      ],
    },
    {
      groupTitle: 'ORDERS MANAGEMENT',
      items: [
        {
          key: 'orders',
          label: 'Marketplace Orders',
          subtitle: 'Escrow & delivery lifecycle',
          icon: ShoppingBag,
          count: counts.activeOrders,
        },
        {
          key: 'send-packages',
          label: 'Send Parcels',
          subtitle: 'Local courier missions',
          icon: Package,
          count: counts.pendingPackages,
          badgeColor: '#EA580C',
        },
        {
          key: 'logistics',
          label: 'Shipping & Zones',
          subtitle: 'Active markets & tariffs',
          icon: Truck,
        },
      ],
    },
    {
      groupTitle: 'USERS & COMPLAINT MANAGEMENT',
      items: [
        {
          key: 'users',
          label: 'Users',
          subtitle: 'Accounts & permissions',
          icon: Users,
          count: counts.users,
          badgeColor: '#64748B',
        },
        {
          key: 'kyc',
          label: 'KYC',
          subtitle: 'Sellers & Logistics Verification',
          icon: CheckCircle2,
          count: counts.pendingKyc,
          badgeColor: '#2563EB',
        },
        {
          key: 'complaints',
          label: 'Dispute Cases',
          subtitle: 'Open support issues',
          icon: AlertTriangle,
          count: counts.openIssues,
          badgeColor: '#EF4444',
        },
      ],
    },
    {
      groupTitle: 'PLATFORM SETTINGS',
      items: [
        {
          key: 'payouts',
          label: 'Payout Releases',
          subtitle: 'Bank withdrawal requests',
          icon: CreditCard,
        },
        {
          key: 'fees',
          label: 'Fee Configuration',
          subtitle: 'Tariffs & commissions',
          icon: Wallet,
        },
        {
          key: 'categories',
          label: 'Categories',
          subtitle: 'Product catalog taxonomy',
          icon: Grid,
        },
        {
          key: 'newsletter',
          label: 'Push Broadcast',
          subtitle: 'Multi-role mobile push',
          icon: Bell,
        },
      ],
    },
  ];

  const adminName = profile?.display_name || profile?.full_name || 'System Administrator';
  const adminInitial = adminName.charAt(0).toUpperCase();

  const renderSidebarContent = () => (
    <Animated.View
      style={[
        styles.drawerContainer,
        isLargeScreen && styles.drawerContainerDocked,
        {
          width: drawerWidth,
          paddingTop: safeTopPadding,
          paddingBottom: safeBottomPadding,
          paddingLeft: safeLeftPadding,
        },
        !isLargeScreen && {
          transform: [{ translateX: slideAnim }, { scale: contentScaleAnim }],
        },
      ]}
      {...(!isLargeScreen ? panResponder.panHandlers : {})}
    >
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandLeft}>
          <View style={styles.brandIconBox}>
            <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>LinkUp</Text>
              <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>Admin</Text>
              </View>
            </View>

          </View>
        </View>

        {!isLargeScreen && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={18} color="#64748B" strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>



      {/* Navigation Groups List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
        bounces={false}
      >
        {navigationGroups.map((group, groupIdx) => (
          <View key={groupIdx} style={styles.navGroup}>
            <Text style={styles.groupHeader}>{group.groupTitle}</Text>
            {group.items.map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;
              const hasBadge = (item.count || 0) > 0;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelectTab(item.key);
                    if (!isLargeScreen) {
                      handleClose();
                    }
                  }}
                  activeOpacity={0.75}
                >
                  {/* Left Active Indicator Bar */}
                  {active && <View style={styles.activeIndicatorBar} />}

                  <View
                    style={[
                      styles.navIconBox,
                      active && styles.navIconBoxActive,
                    ]}
                  >
                    <Icon
                      size={17}
                      color={active ? colors.primary : '#64748B'}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </View>

                  <View style={styles.navTextWrap}>
                    <Text
                      style={[styles.navLabel, active && styles.navLabelActive]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.navSub, active && styles.navSubActive]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>

                  {hasBadge ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: item.badgeColor || colors.primary },
                      ]}
                    >
                      <Text style={styles.badgeText}>{item.count}</Text>
                    </View>
                  ) : active ? (
                    <ChevronRight size={14} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Switcher & Sign Out */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {onLogout ? (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogoutPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign out of Admin Portal"
          >
            <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
            <Text style={styles.logoutButtonText}>Sign Out of Admin</Text>
          </TouchableOpacity>
        ) : onExitToStore ? (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!isLargeScreen) handleClose();
              onExitToStore();
            }}
            activeOpacity={0.8}
          >
            <LogOut size={16} color="#DC2626" strokeWidth={2.2} />
            <Text style={styles.logoutButtonText}>Sign Out of Admin</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );

  // On large screens / tablets: Docked Persistent Sidebar
  if (isLargeScreen) {
    if (!isOpen) return null;
    return (
      <View style={[styles.dockedWrapper, { width: drawerWidth }]}>
        {renderSidebarContent()}
      </View>
    );
  }

  // On mobile: Off-canvas sliding drawer mounted inside a transparent Modal
  if (!modalVisible && !isOpen) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Animated Dimmed Backdrop Scrim */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdropOverlay,
            {
              opacity: backdropAnim,
            },
          ]}
        />

        {/* Full-screen Backdrop Touchable to dismiss when clicking outside */}
        <TouchableOpacity
          style={styles.backdropTouchArea}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close admin menu"
        />

        {/* Sliding Drawer Container */}
        {renderSidebarContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    position: 'relative',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  backdropTouchArea: {
    ...StyleSheet.absoluteFillObject,
  },
  dockedWrapper: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 25,
    flexDirection: 'column',
  },
  drawerContainerDocked: {
    position: 'relative',
    height: '100%',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  adminTag: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  adminTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  scrollList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navGroup: {
    marginBottom: 16,
  },
  groupHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#FFF7ED',
  },
  activeIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  navIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  navIconBoxActive: {
    backgroundColor: '#FFEDD5',
  },
  navTextWrap: {
    flex: 1,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  navLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  navSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  navSubActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  systemStatusWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  systemStatusText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
