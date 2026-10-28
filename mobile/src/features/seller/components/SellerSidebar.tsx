import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Store,
  X,
  Package,
  Plus,
  ShoppingBag,
  AlertCircle,
  Wallet,
  TrendingUp,
  CreditCard,
  User,
  ShieldCheck,
  Clock,
  LogOut,
  ChevronRight,
  ArrowUpRight,
  PanelLeftClose,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';
import type { SellerTabKey } from '../screens/SellerDashboardScreen';

export interface SellerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SellerTabKey;
  onSelectTab: (tabKey: SellerTabKey) => void;
  counts: {
    totalProducts: number;
    activeProducts: number;
    pendingOrders: number;
    openIssues: number;
  };
  wallet: any;
  profile: any;
  verification: any;
  onNavigateVerification?: () => void;
  onExitToStore?: () => void;
  onLogout?: () => void;
  isLargeScreen?: boolean;
}

interface NavItemConfig {
  key: SellerTabKey;
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

export function SellerSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  counts,
  wallet,
  profile,
  verification,
  onNavigateVerification,
  onExitToStore,
  onLogout,
  isLargeScreen = false,
}: SellerSidebarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = isLargeScreen ? 286 : Math.min(windowWidth * 0.84, 336);

  const [modalVisible, setModalVisible] = useState(isOpen);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const safeTopPadding = isLargeScreen
    ? Math.max(insets.top, 16)
    : Math.max(insets.top, Platform.OS === 'ios' ? 48 : 28);
  const safeBottomPadding = Math.max(insets.bottom, 16);
  const safeLeftPadding = Math.max(insets.left, 0);

  // Smooth spring animation values
  const slideAnim = useRef(
    new Animated.Value(isLargeScreen ? (isOpen ? 0 : -drawerWidth) : -drawerWidth)
  ).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentScaleAnim = useRef(new Animated.Value(0.97)).current;
  const logoutFadeAnim = useRef(new Animated.Value(0)).current;
  const logoutScaleAnim = useRef(new Animated.Value(0.92)).current;
  const isClosingRef = useRef(false);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(contentScaleAnim, {
        toValue: 0.97,
        duration: 190,
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
    setLogoutModalVisible(true);
    logoutFadeAnim.setValue(0);
    logoutScaleAnim.setValue(0.92);
    Animated.parallel([
      Animated.timing(logoutFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(logoutScaleAnim, {
        toValue: 1,
        damping: 20,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDismissLogoutModal = () => {
    Haptics.selectionAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(logoutFadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(logoutScaleAnim, {
        toValue: 0.94,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLogoutModalVisible(false);
    });
  };

  const handleConfirmLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.timing(logoutFadeAnim, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(logoutScaleAnim, {
        toValue: 0.94,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setLogoutModalVisible(false);
      if (!isLargeScreen) handleClose();
      onLogout?.();
    });
  };

  useEffect(() => {
    if (isLargeScreen) {
      Animated.spring(slideAnim, {
        toValue: isOpen ? 0 : -drawerWidth,
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
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

  // Swipe-to-dismiss gesture for mobile drawer
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture: any) => {
        return !isLargeScreen && !logoutModalVisible && gesture.dx < -15 && Math.abs(gesture.dy) < 30;
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

  const navigationGroups: NavGroupConfig[] = [
    {
      groupTitle: 'CATALOG & INVENTORY',
      items: [
        {
          key: 'products',
          label: 'Inventory',
          subtitle: 'Manage active listings & stock',
          icon: Package,
          count: counts.activeProducts,
          badgeColor: '#64748B',
        },
        {
          key: 'list-product',
          label: 'List Product',
          subtitle: 'Publish a new marketplace item',
          icon: Plus,
        },
      ],
    },
    {
      groupTitle: 'FULFILLMENT & SUPPORT',
      items: [
        {
          key: 'orders',
          label: 'Orders',
          subtitle: 'Track & dispatch buyer orders',
          icon: ShoppingBag,
          count: counts.pendingOrders,
          badgeColor: colors.primary,
        },
        {
          key: 'issues',
          label: 'Order Issues',
          subtitle: '',
          icon: AlertCircle,
          count: counts.openIssues,
          badgeColor: '#EF4444',
        },
      ],
    },
    {
      groupTitle: 'FINANCE & INSIGHTS',
      items: [
        {
          key: 'wallet',
          label: 'Seller Wallet',
          subtitle: 'Escrow, payouts & bank details',
          icon: Wallet,
        },
        {
          key: 'payments',
          label: 'Payments History',
          subtitle: 'Order settlement breakdown',
          icon: CreditCard,
        },
        {
          key: 'analytics',
          label: 'Insights & Analytics',
          subtitle: 'Revenue trends & store KPIs',
          icon: TrendingUp,
        },
      ],
    },
    {
      groupTitle: 'MERCHANT ACCOUNT',
      items: [
        {
          key: 'profile',
          label: 'Store Profile',
          subtitle: 'Business details & KYC status',
          icon: User,
        },
      ],
    },
  ];

  const storeName =
    verification?.business_name ||
    profile?.display_name ||
    profile?.full_name ||
    'LinkUp Merchant';
  const storeInitial = storeName.charAt(0).toUpperCase();
  const isVerified = verification?.status === 'verified';
  const isPending = verification?.status === 'pending';

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
            <Store size={19} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>LinkUp</Text>
            </View>
            <Text style={styles.brandSubtitle}>Merchant Dashboard</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={isLargeScreen ? onClose : handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isLargeScreen ? (
            <PanelLeftClose size={17} color="#64748B" />
          ) : (
            <X size={18} color="#64748B" strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>

      {/* Merchant Store Summary Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{storeInitial}</Text>
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: isVerified
                    ? '#22C55E'
                    : isPending
                      ? '#F59E0B'
                      : '#94A3B8',
                },
              ]}
            />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {storeName}
            </Text>
            {isVerified ? (
              <View style={styles.statusPill}>
                <ShieldCheck size={12} color="#059669" />
                <Text style={styles.statusPillText}>Verified Merchant</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.statusPill}
                onPress={() => {
                  if (!isLargeScreen) handleClose();
                  onNavigateVerification?.();
                }}
              >
                <Clock size={11} color="#D97706" />
                <Text style={[styles.statusPillText, { color: '#D97706' }]}>
                  {isPending ? 'KYC Under Review' : 'Complete KYC →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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

      {/* Bottom Actions: Marketplace Switcher & Sign Out */}
      <View
        style={[
          styles.bottomSection,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {onExitToStore && (
          <TouchableOpacity
            style={styles.storefrontBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (!isLargeScreen) handleClose();
              onExitToStore();
            }}
            activeOpacity={0.8}
          >
            <Store size={15} color="#0F172A" strokeWidth={2.2} />
            <Text style={styles.storefrontBtnText}>Back to Marketplace</Text>
            <ArrowUpRight size={14} color="#64748B" />
          </TouchableOpacity>
        )}

        {onLogout && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogoutPress}
            activeOpacity={0.8}
          >
            <LogOut size={15} color="#DC2626" strokeWidth={2.2} />
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  // Centered Modern Sign Out Confirmation Modal
  const renderLogoutConfirmCard = () => {
    if (!logoutModalVisible) return null;
    return (
      <View style={styles.logoutModalOverlay}>
        <TouchableWithoutFeedback onPress={handleDismissLogoutModal}>
          <View style={styles.backdropTouchArea} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.logoutModalCard,
            {
              opacity: logoutFadeAnim,
              transform: [{ scale: logoutScaleAnim }],
            },
          ]}
        >
          {/* Top Close Button */}
          <TouchableOpacity
            style={styles.logoutModalCloseBtn}
            onPress={handleDismissLogoutModal}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={16} color="#64748B" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Animated Danger Icon Ring */}
          <View style={styles.logoutIconOuterRing}>
            <View style={styles.logoutIconInnerRing}>
              <LogOut size={24} color="#DC2626" strokeWidth={2.5} />
            </View>
          </View>

          {/* Store Identity Pill */}
          <View style={styles.logoutStorePill}>
            <Store size={12} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.logoutStorePillText} numberOfLines={1}>
              {storeName}
            </Text>
          </View>

          {/* Title & Description */}
          <Text style={styles.logoutModalTitle}>Sign Out of Account?</Text>
          <Text style={styles.logoutModalSubtitle}>
            Are you sure you want to sign out of your LinkUp merchant session? You can sign back in anytime to manage orders and payouts.
          </Text>

          {/* Action Buttons */}
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={styles.logoutCancelBtn}
              onPress={handleDismissLogoutModal}
              activeOpacity={0.75}
            >
              <Text style={styles.logoutCancelBtnText}>Stay Signed In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutConfirmBtn}
              onPress={handleConfirmLogout}
              activeOpacity={0.85}
            >
              <LogOut size={15} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.logoutConfirmBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  };

  // Docked Persistent Sidebar on Large Screens / Tablets
  if (isLargeScreen) {
    if (!isOpen) return null;
    return (
      <View style={[styles.dockedWrapper, { width: drawerWidth }]}>
        {renderSidebarContent()}
        <Modal
          visible={logoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleDismissLogoutModal}
          statusBarTranslucent
        >
          {renderLogoutConfirmCard()}
        </Modal>
      </View>
    );
  }

  // Off-canvas Sliding Drawer on Mobile
  if (!modalVisible && !isOpen) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={logoutModalVisible ? handleDismissLogoutModal : handleClose}
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

        {/* Backdrop Touchable to dismiss when tapping outside */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdropTouchArea} />
        </TouchableWithoutFeedback>

        {/* Sliding Drawer Container */}
        {renderSidebarContent()}

        {/* Modern Centered Sign Out Confirmation Modal Overlay */}
        {renderLogoutConfirmCard()}
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
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
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
    zIndex: 25,
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
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
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
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    fontWeight: '800',
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
    fontWeight: '700',
    color: '#059669',
  },
  scrollList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navGroup: {
    marginBottom: 14,
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
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  storefrontBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storefrontBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
  logoutModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
    elevation: 50,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 348,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 60,
    zIndex: 101,
    position: 'relative',
  },
  logoutModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoutIconInnerRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutStorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: '85%',
  },
  logoutStorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  logoutModalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  logoutModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  logoutCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  logoutConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
  logoutConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
