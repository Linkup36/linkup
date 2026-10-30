import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Menu,
  ArrowLeft,
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { SafeView } from '../../../components/ui/SafeView';
import { AuthGuard } from '../../../components/auth/AuthGuard';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../../context/AuthContext';
import {
  usePromoterData,
  ProductToPromote,
} from '../hooks/usePromoterData';

import { PromoterSidebar } from '../components/PromoterSidebar';
import { PromoteProductModal } from '../components/PromoteProductModal';
import { PromoterWithdrawModal } from '../components/PromoterWithdrawModal';
import { PromoterOverviewTab } from '../components/PromoterOverviewTab';
import { PromoterMarketplaceTab } from '../components/PromoterMarketplaceTab';
import { PromoterPaymentsTab } from '../components/PromoterPaymentsTab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// LinkUp Official Brand Color
const BRAND_ORANGE = '#EB7D30';

type PromoterTabKey = 'overview' | 'marketplace' | 'payments';

const TABS: { key: PromoterTabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { key: 'payments', label: 'Payments', icon: Wallet },
];

export function PromoterDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, profile, signOut } = useAuth();

  const {
    promoterCode,
    wallet,
    stats,
    commissions,
    referrals,
    withdrawals,
    products,
    loading,
    refreshing,
    refresh,
    requestWithdrawal,
  } = usePromoterData();

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<PromoterTabKey>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductToPromote | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Animated sliding tab indicator
  const tabAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;

  const handleTabChange = (tab: PromoterTabKey) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const index = TABS.findIndex((t) => t.key === tab);

    // Subtle fade transition for content
    Animated.sequence([
      Animated.timing(contentFadeAnim, {
        toValue: 0.9,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();

    // Framer motion style spring for the tab pill
    Animated.spring(tabAnim, {
      toValue: index,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();

    setActiveTab(tab);
  };

  const handleSignOut = async () => {
    try {
      setIsSidebarOpen(false);
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  const canGoBack = navigation.canGoBack();

  // Tab indicator layout calculations
  const TAB_CONTAINER_PADDING = 6;
  const tabContainerWidth = SCREEN_WIDTH - 32;
  const singleTabWidth = (tabContainerWidth - TAB_CONTAINER_PADDING * 2) / TABS.length;

  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      TAB_CONTAINER_PADDING,
      TAB_CONTAINER_PADDING + singleTabWidth,
      TAB_CONTAINER_PADDING + singleTabWidth * 2,
    ],
  });

  return (
    <AuthGuard
      requiredRoles={['promoter', 'admin']}
      fallbackTitle="Promoter Hub"
      fallbackDescription="Sign in to your LinkUp Promoter account to manage referral links, track sales conversions, and withdraw commission earnings."
    >
      <SafeView style={styles.safeContainer}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.goBack();
              }}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsSidebarOpen(true);
            }}
            style={styles.menuButton}
            activeOpacity={0.7}
          >
            <Menu size={22} color={colors.text} />
            <View style={styles.menuBadgeDot} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Promoter Hub</Text>
              <View style={styles.activePill}>
                <Sparkles size={10} color={BRAND_ORANGE} />
                <Text style={styles.activePillText}>Earn 5%</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {profile?.full_name || user?.email?.split('@')[0] || 'Partner'}
            </Text>
          </View>
        </View>

        {/* Quick Wallet Balance Pill */}
        <TouchableOpacity
          style={styles.walletPill}
          activeOpacity={0.8}
          onPress={() => handleTabChange('payments')}
        >
          <View style={styles.walletIconCircle}>
            <Wallet size={13} color={BRAND_ORANGE} />
          </View>
          <View style={styles.walletTextCol}>
            <Text style={styles.walletPillLabel}>Balance</Text>
            <Text style={styles.walletPillValue}>
              ₦{wallet.balance.toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Framer-Motion Style Segmented Tab Switcher */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabContainer}>
          {/* Animated Sliding Background Pill */}
          <Animated.View
            style={[
              styles.tabActiveIndicator,
              {
                width: singleTabWidth,
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />

          {/* Tab Buttons */}
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const IconComponent = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabButton}
                activeOpacity={0.7}
                onPress={() => handleTabChange(tab.key)}
              >
                <IconComponent
                  size={16}
                  color={isActive ? BRAND_ORANGE : colors.textMuted}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={BRAND_ORANGE}
            colors={[BRAND_ORANGE]}
          />
        }
      >
        <Animated.View style={{ opacity: contentFadeAnim, width: '100%' }}>
          {loading && !refreshing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={BRAND_ORANGE} />
              <Text style={styles.loaderText}>Loading promoter hub...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'overview' && (
                <PromoterOverviewTab
                  promoterCode={promoterCode}
                  stats={stats}
                  commissions={commissions}
                  referrals={referrals}
                  onOpenWithdrawModal={() => setIsWithdrawModalOpen(true)}
                  onGoToMarketplace={() => handleTabChange('marketplace')}
                />
              )}

              {activeTab === 'marketplace' && (
                <PromoterMarketplaceTab
                  products={products}
                  loading={loading}
                  onPromoteProduct={(prod) => setSelectedProduct(prod)}
                />
              )}

              {activeTab === 'payments' && (
                <PromoterPaymentsTab
                  availableBalance={wallet.balance}
                  escrowBalance={wallet.escrow_balance}
                  withdrawals={withdrawals}
                  onOpenWithdrawModal={() => setIsWithdrawModalOpen(true)}
                />
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* 4. Slide-out Navigation Drawer / Sidebar (Modal) */}
      <PromoterSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          handleTabChange(tab);
          setIsSidebarOpen(false);
        }}
        user={user}
        profile={profile}
        promoterCode={promoterCode}
        onNavigate={(screen, params) => {
          setIsSidebarOpen(false);
          navigation.navigate(screen, params);
        }}
        onSignOut={handleSignOut}
      />

      {/* 5. Product Affiliate Link Modal */}
      <PromoteProductModal
        visible={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        promoterCode={promoterCode}
      />

      {/* 6. Payout Request Modal */}
      <PromoterWithdrawModal
        visible={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availableBalance={wallet.balance}
        onSubmit={requestWithdrawal}
      />
    </SafeView>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  menuBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BRAND_ORANGE,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_ORANGE,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 7,
  },
  walletIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTextCol: {
    alignItems: 'flex-start',
  },
  walletPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND_ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  walletPillValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#C25E1A',
  },
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 6,
    position: 'relative',
    height: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabActiveIndicator: {
    position: 'absolute',
    top: 6,
    left: 0,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: BRAND_ORANGE,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
