import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Package,
  Plus,
  ShoppingBag,
  AlertCircle,
  Wallet,
  TrendingUp,
  CreditCard,
  UserCheck,
  X,
  LogOut,
  Store,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

export type SellerTab =
  | 'products'
  | 'list-product'
  | 'orders'
  | 'issues'
  | 'wallet'
  | 'analytics'
  | 'payments'
  | 'profile';

export const SELLER_TABS = [
  { id: 'products' as SellerTab, label: 'Inventory', icon: Package, desc: 'Manage stock & catalog' },
  { id: 'list-product' as SellerTab, label: 'List Product', icon: Plus, desc: 'Add new items' },
  { id: 'orders' as SellerTab, label: 'Orders', icon: ShoppingBag, desc: 'Incoming customer orders' },
  { id: 'issues' as SellerTab, label: 'Issues', icon: AlertCircle, desc: 'Help & dispute tickets' },
  { id: 'wallet' as SellerTab, label: 'Wallet', icon: Wallet, desc: 'Balance & payouts' },
  { id: 'analytics' as SellerTab, label: 'Insights', icon: TrendingUp, desc: 'Business metrics' },
  { id: 'payments' as SellerTab, label: 'Payments History', icon: CreditCard, desc: 'Settlement tracking' },
  { id: 'profile' as SellerTab, label: 'Store Profile', icon: UserCheck, desc: 'Merchant settings & KYC' },
];

interface SellerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SellerTab;
  onSelectTab: (tab: SellerTab) => void;
  pendingOrdersCount?: number;
  openIssuesCount?: number;
  profile?: any;
  wallet?: any;
  onExitToStore?: () => void;
  onLogout?: () => void;
}

export function SellerSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  pendingOrdersCount = 0,
  openIssuesCount = 0,
  profile,
  wallet,
  onExitToStore,
  onLogout,
}: SellerSidebarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(windowWidth * 0.84, 340);

  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -drawerWidth,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, drawerWidth]);

  if (!isOpen) return null;

  const handleSelect = (tab: SellerTab) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectTab(tab);
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Drawer Content */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              transform: [{ translateX: slideAnim }],
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Store size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.brandTitle}>LinkUp</Text>
                <Text style={styles.brandSubtitle}>Merchant Portal</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Merchant Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {(profile?.display_name || profile?.full_name || 'M')?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.display_name || profile?.full_name || 'Verified Merchant'}
              </Text>
              <Text style={styles.walletBalanceText}>
                Wallet: ₦{(wallet?.balance || 0).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Navigation Items */}
          <ScrollView
            style={styles.navScroll}
            contentContainerStyle={styles.navScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Main Navigation</Text>

            {SELLER_TABS.map(({ id, label, icon: Icon, desc }) => {
              const isActive = activeTab === id;
              const hasBadge =
                (id === 'orders' && pendingOrdersCount > 0) ||
                (id === 'issues' && openIssuesCount > 0);
              const badgeCount = id === 'orders' ? pendingOrdersCount : openIssuesCount;

              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleSelect(id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                    <Icon size={18} color={isActive ? '#ffffff' : '#475569'} strokeWidth={2.5} />
                  </View>

                  <View style={styles.navTextWrap}>
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                      {label}
                    </Text>
                    <Text style={styles.navDesc} numberOfLines={1}>
                      {desc}
                    </Text>
                  </View>

                  {hasBadge && (
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{badgeCount}</Text>
                    </View>
                  )}

                  {isActive && <ChevronRight size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {onExitToStore && (
              <TouchableOpacity style={styles.exitBtn} onPress={onExitToStore} activeOpacity={0.8}>
                <Store size={16} color="#0f172a" />
                <Text style={styles.exitBtnText}>Back to Marketplace</Text>
              </TouchableOpacity>
            )}

            {onLogout && (
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                activeOpacity={0.8}
              >
                <LogOut size={16} color="#ef4444" />
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdropTouch: {
    flex: 1,
  },
  drawer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  walletBalanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
  },
  navScroll: {
    flex: 1,
  },
  navScrollContent: {
    paddingVertical: 8,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
  },
  navTextWrap: {
    flex: 1,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  navDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  badgePill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  exitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ef4444',
  },
});

