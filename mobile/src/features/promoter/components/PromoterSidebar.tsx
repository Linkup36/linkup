import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Image,
  Modal,
} from 'react-native';
import {
  LayoutDashboard,
  Package,
  Wallet,
  Share2,
  Copy,
  ChevronRight,
  User,
  ShoppingBag,
  Store,
  Truck,
  X,
  HelpCircle,
  Sparkles,
  LogOut,
  ShieldCheck,
  Megaphone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { toast } from '../../../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

// LinkUp Official Brand Color
const BRAND_ORANGE = '#EB7D30';

interface PromoterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'overview' | 'marketplace' | 'payments';
  onSelectTab: (tab: 'overview' | 'marketplace' | 'payments') => void;
  user: any;
  profile: any;
  promoterCode: string;
  onNavigate: (screen: string, params?: any) => void;
  onSignOut: () => void;
}

export function PromoterSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  user,
  profile,
  promoterCode,
  onNavigate,
  onSignOut,
}: PromoterSidebarProps) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      slideAnim.setValue(-SIDEBAR_WIDTH);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const handleClose = (callback?: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (callback) {
        callback();
      }
    });
  };

  const handleCopyCode = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Affiliate Code Copied! 📋', {
      description: promoterCode || 'Code copied to clipboard',
    });
  };

  const displayName =
    profile?.display_name || profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Promoter Partner');

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalOverlay}>
        {/* Dark Backdrop with tap to dismiss */}
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Slide-out Sidebar Panel */}
        <Animated.View
          style={[
            styles.sidebarContainer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header Profile Section */}
          <View style={styles.sidebarHeader}>
            <View style={styles.profileRow}>
              <Image
                source={{
                  uri:
                    profile?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                }}
                style={styles.avatar}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <ShieldCheck size={14} color={BRAND_ORANGE} />
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.promoterBadge}>
                    <Megaphone size={10} color={BRAND_ORANGE} />
                    <Text style={styles.promoterBadgeText}>AFFILIATE PARTNER</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => handleClose()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Promoter Code Bar */}
            <TouchableOpacity style={styles.codePill} onPress={handleCopyCode} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Sparkles size={13} color={BRAND_ORANGE} />
                <Text style={styles.codePillLabel}>MY CODE:</Text>
                <Text style={styles.codePillValue} numberOfLines={1}>
                  {promoterCode || 'LOADING...'}
                </Text>
              </View>
              <Copy size={13} color={BRAND_ORANGE} />
            </TouchableOpacity>
          </View>

          {/* Navigation Menu */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>PROMOTER HUB</Text>

            {/* Overview Tab */}
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'overview' && styles.menuItemActive]}
              onPress={() => {
                handleClose(() => onSelectTab('overview'));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, activeTab === 'overview' && styles.menuIconBoxActive]}>
                <LayoutDashboard size={18} color={activeTab === 'overview' ? '#FFFFFF' : BRAND_ORANGE} />
              </View>
              <Text style={[styles.menuLabel, activeTab === 'overview' && styles.menuLabelActive]}>
                Performance Overview
              </Text>
              {activeTab === 'overview' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Marketplace Tab */}
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'marketplace' && styles.menuItemActive]}
              onPress={() => {
                handleClose(() => onSelectTab('marketplace'));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, activeTab === 'marketplace' && styles.menuIconBoxActive]}>
                <Package size={18} color={activeTab === 'marketplace' ? '#FFFFFF' : BRAND_ORANGE} />
              </View>
              <Text style={[styles.menuLabel, activeTab === 'marketplace' && styles.menuLabelActive]}>
                Browse & Promote Products
              </Text>
              {activeTab === 'marketplace' && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Payments Tab */}
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'payments' && styles.menuItemActive]}
              onPress={() => {
                handleClose(() => onSelectTab('payments'));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, activeTab === 'payments' && styles.menuIconBoxActive]}>
                <Wallet size={18} color={activeTab === 'payments' ? '#FFFFFF' : BRAND_ORANGE} />
              </View>
              <Text style={[styles.menuLabel, activeTab === 'payments' && styles.menuLabelActive]}>
                Payouts & Settlements
              </Text>
              {activeTab === 'payments' && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </View>

          {/* Switch Mode Section */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>SWITCH APP MODE</Text>

            <TouchableOpacity
              style={styles.switchModeItem}
              onPress={() => {
                handleClose(() => onNavigate('MainTabs', { screen: 'HomeTab' }));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.switchIconBox, { backgroundColor: '#EFF6FF' }]}>
                <ShoppingBag size={16} color="#2563EB" />
              </View>
              <Text style={styles.switchLabel}>Buyer Marketplace</Text>
              <ChevronRight size={15} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeItem}
              onPress={() => {
                handleClose(() => onNavigate('SellerDashboard'));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.switchIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Store size={16} color={BRAND_ORANGE} />
              </View>
              <Text style={styles.switchLabel}>Seller Dashboard</Text>
              <ChevronRight size={15} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeItem}
              onPress={() => {
                handleClose(() => onNavigate('LogisticsDashboard'));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.switchIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Truck size={16} color="#16A34A" />
              </View>
              <Text style={styles.switchLabel}>Logistics Fleet</Text>
              <ChevronRight size={15} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Footer / Utilities */}
          <View style={styles.sidebarFooter}>
            <TouchableOpacity
              style={styles.footerRow}
              onPress={() => {
                handleClose(() => onNavigate('Profile'));
              }}
              activeOpacity={0.7}
            >
              <User size={16} color="#64748B" />
              <Text style={styles.footerText}>Account Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerRow}
              onPress={() => {
                handleClose(() => onNavigate('Support'));
              }}
              activeOpacity={0.7}
            >
              <HelpCircle size={16} color="#64748B" />
              <Text style={styles.footerText}>Promoter Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.footerRow, { marginTop: 6 }]}
              onPress={() => {
                handleClose(() => onSignOut());
              }}
              activeOpacity={0.7}
            >
              <LogOut size={16} color="#EF4444" />
              <Text style={[styles.footerText, { color: '#EF4444', fontWeight: '700' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
    justifyContent: 'space-between',
  },
  sidebarHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  userName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  promoterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoterBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: BRAND_ORANGE,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 14,
  },
  codePillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: BRAND_ORANGE,
    letterSpacing: 0.4,
  },
  codePillValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#C25E1A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  menuSection: {
    marginTop: 18,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 10,
  },
  menuItemActive: {
    backgroundColor: '#FFF7ED',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxActive: {
    backgroundColor: BRAND_ORANGE,
  },
  menuLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    flex: 1,
  },
  menuLabelActive: {
    color: BRAND_ORANGE,
    fontWeight: '900',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_ORANGE,
  },
  switchModeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  switchIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  sidebarFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
});
