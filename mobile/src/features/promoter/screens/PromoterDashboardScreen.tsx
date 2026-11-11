import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { toast } from '../../../components/ui/GooeyToast';
import { colors } from '../../../theme/colors';
import {
  Megaphone,
  Share2,
  Users,
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Package,
  Search,
  CheckCircle2,
  Copy,
  Info,
  Tag,
  LogOut,
  Wallet,
  ArrowDownToLine,
  Clock,
  Building2,
  ChevronRight,
  ChevronDown,
  X,
  CreditCard,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

const { width } = Dimensions.get('window');

interface PromoterProduct {
  id: string;
  title: string;
  rawPrice: number;
  finalPrice: number;
  commission: number;
  images: string[] | null;
  description: string | null;
  inventory: number;
  category: string | null;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  created_at: string;
}

interface WalletState {
  id: string;
  balance: number;
  escrow_balance: number;
}

export function PromoterDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'wallet'>('overview');
  const [promoterCode, setPromoterCode] = useState('');
  const [markupRate, setMarkupRate] = useState(0.10); // Platform fee percentage (default 10%)
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalCommissions: 0,
  });

  // Wallet & Payout State
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [products, setProducts] = useState<PromoterProduct[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [productPage, setProductPage] = useState<number>(0);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState<boolean>(false);
  const PAGE_SIZE = 50;

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawal Modal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [fee, setFee] = useState(100);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Sign Out Modal State
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Fetch withdrawal fee from system settings
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'withdrawal_fee')
          .maybeSingle();

        if (data?.value) {
          const val =
            typeof data.value === 'object' && 'amount' in (data.value as any)
              ? Number((data.value as any).amount)
              : Number(data.value);
          if (!isNaN(val) && val >= 0) {
            setFee(val);
          }
        }
      } catch {
        // use fallback fee
      }
    })();
  }, []);

  const referralLink = `https://linkupng.com?ref=${promoterCode || user?.id?.slice(0, 8) || 'join'}`;

  // Ref to track if user is explicitly logging out
  const isLoggingOutRef = React.useRef(false);

  // Safe back navigation: Never redirect to Auth pages unless logged out
  const handleGoBack = useCallback(() => {
    if (isLoggingOutRef.current) return;

    if (user) {
      const routes = navigation.getState()?.routes;
      const prevRoute = routes && routes.length > 1 ? routes[routes.length - 2]?.name : null;
      const isAuthRoute =
        !prevRoute ||
        prevRoute === 'Login' ||
        prevRoute === 'Register' ||
        prevRoute === 'AuthModal' ||
        prevRoute === 'Onboarding' ||
        prevRoute === 'ResetPassword';

      if (isAuthRoute || !navigation.canGoBack()) {
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
      } else {
        navigation.goBack();
      }
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
      }
    }
  }, [user, navigation]);

  // Intercept back navigation (hardware back, gestures, header back) to prevent returning to Auth screens
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isLoggingOutRef.current || !user) {
        return;
      }

      const routes = navigation.getState()?.routes;
      const prevRoute = routes && routes.length > 1 ? routes[routes.length - 2]?.name : null;
      const isAuthRoute =
        !prevRoute ||
        prevRoute === 'Login' ||
        prevRoute === 'Register' ||
        prevRoute === 'AuthModal' ||
        prevRoute === 'Onboarding' ||
        prevRoute === 'ResetPassword';

      if (isAuthRoute || !navigation.canGoBack()) {
        e.preventDefault();
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
      }
    });

    return unsubscribe;
  }, [navigation, user]);

  // Handle Logout (Cross-Platform Modal Confirmation)
  const handleLogout = () => {
    setSignOutModalVisible(true);
  };

  const handleConfirmLogout = async () => {
    isLoggingOutRef.current = true;
    try {
      setSigningOut(true);
      setSignOutModalVisible(false);
      await signOut();
      toast.success('Signed out successfully');
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      isLoggingOutRef.current = false;
      toast.error('Logout failed', { description: err.message });
    } finally {
      setSigningOut(false);
    }
  };

  const fetchPromoterData = async () => {
    if (!user) return;
    try {
      // 1. Fetch promoter code from promoter_codes
      const { data: codeData } = await supabase
        .from('promoter_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      let code = codeData?.code;
      if (!code) {
        code = 'PX' + (user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'LINKUP');
        try {
          await supabase.from('promoter_codes').insert({ user_id: user.id, code });
        } catch {
          // ignore duplicate
        }
      }
      setPromoterCode(code);

      // 2. Fetch referrals count from referrals table
      let refCount = 0;
      try {
        const { count, error: refError } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('promoter_id', user.id);
        if (!refError && typeof count === 'number') {
          refCount = count;
        }
      } catch (err) {
        console.warn('[PromoterDashboard] Referrals query error:', err);
      }

      // 3. Fetch commissions from commissions table (with order_settlements fallback)
      let totalEarned = 0;
      try {
        const { data: commissions, error: commError } = await supabase
          .from('commissions')
          .select('amount, status')
          .eq('promoter_id', user.id);

        if (!commError && commissions && commissions.length > 0) {
          totalEarned = commissions.reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0);
        } else {
          // Fallback to order_settlements if commissions table has no rows
          const { data: settlements } = await (supabase
            .from('order_settlements' as any)
            .select(`
              promoter_amount,
              orders!inner(promoter_id)
            `)
            .eq('orders.promoter_id', user.id)
            .gt('promoter_amount', 0) as any);

          if (settlements) {
            totalEarned = settlements.reduce((acc: number, s: any) => acc + (Number(s.promoter_amount) || 0), 0);
          }
        }
      } catch (err) {
        console.warn('[PromoterDashboard] Commissions query error:', err);
      }

      // 4. Fetch or create Wallet for user
      let { data: wData, error: wError } = await supabase
        .from('wallets')
        .select('id, balance, escrow_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!wData && !wError) {
        const { data: created } = await supabase
          .from('wallets')
          .insert({ user_id: user.id, balance: 0, escrow_balance: 0 })
          .select('id, balance, escrow_balance')
          .single();
        wData = created;
      }
      setWallet(wData);

      // 5. Fetch Payout Requests History
      const { data: payoutData } = await supabase
        .from('payout_requests')
        .select('id, amount, status, bank_name, account_number, account_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setPayouts((payoutData as PayoutRequest[]) || []);

      // 6. Fetch fee config to get platform percentage
      const { data: feeData } = await supabase
        .from('fee_config')
        .select('*')
        .eq('is_active', true);

      const prodFee = (feeData || []).find((f: any) => f.fee_type === 'platform_product' || f.fee_type === 'platform');
      const rate = prodFee?.rate !== undefined ? Number(prodFee.rate) : 0.10;
      setMarkupRate(rate);

      // 7. Fetch total count of active in-stock products
      let totalCount = 0;
      const { count: activeCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('inventory', 0);

      if (typeof activeCount === 'number' && activeCount > 0) {
        totalCount = activeCount;
      } else {
        const { count: fallbackCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .gt('inventory', 0);
        totalCount = fallbackCount ?? 0;
      }
      setTotalProductsCount(totalCount);

      // 8. Fetch first page of marketplace products (with platform markup)
      const { data: prods } = await supabase
        .from('products')
        .select('id, title, price, images, description, inventory, category')
        .eq('is_active', true)
        .gt('inventory', 0)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      const multiplier = 1 + rate;
      const prodsList = prods || [];
      const mapped: PromoterProduct[] = prodsList.map((p: any) => {
        const raw = Number(p.price || 0);
        const finalPriceWithFee = Math.round(raw * multiplier);
        const commissionAmt = Math.round(finalPriceWithFee * 0.05); // 5% commission on final price
        return {
          id: p.id,
          title: p.title,
          rawPrice: raw,
          finalPrice: finalPriceWithFee,
          commission: commissionAmt,
          images: p.images,
          description: p.description,
          inventory: p.inventory || 0,
          category: p.category,
        };
      });

      setProducts(mapped);
      setProductPage(0);
      setHasMoreProducts(prodsList.length === PAGE_SIZE && (totalCount > 0 ? prodsList.length < totalCount : true));
      setStats({
        totalReferrals: refCount || 0,
        totalCommissions: totalEarned,
      });

      // Pre-fill account name if empty
      if (!accountName && (profile?.display_name || profile?.full_name)) {
        setAccountName(profile.display_name || profile.full_name || '');
      }
    } catch (e) {
      console.warn('[PromoterDashboard] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMoreProducts = async () => {
    if (loadingMoreProducts || !hasMoreProducts) return;
    setLoadingMoreProducts(true);
    try {
      const nextPage = productPage + 1;
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: nextProds, error } = await supabase
        .from('products')
        .select('id, title, price, images, description, inventory, category')
        .eq('is_active', true)
        .gt('inventory', 0)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const list = nextProds || [];
      const multiplier = 1 + markupRate;
      const mappedNext: PromoterProduct[] = list.map((p: any) => {
        const raw = Number(p.price || 0);
        const finalPriceWithFee = Math.round(raw * multiplier);
        const commissionAmt = Math.round(finalPriceWithFee * 0.05);
        return {
          id: p.id,
          title: p.title,
          rawPrice: raw,
          finalPrice: finalPriceWithFee,
          commission: commissionAmt,
          images: p.images,
          description: p.description,
          inventory: p.inventory || 0,
          category: p.category,
        };
      });

      setProducts((prev) => {
        const nextTotal = prev.length + mappedNext.length;
        if (list.length < PAGE_SIZE || (totalProductsCount > 0 && nextTotal >= totalProductsCount)) {
          setHasMoreProducts(false);
        }
        return [...prev, ...mappedNext];
      });
      setProductPage(nextPage);
    } catch (err) {
      console.warn('[PromoterDashboard] Load more products error:', err);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  useEffect(() => {
    fetchPromoterData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPromoterData();
  };

  // Submit Withdrawal Request
  const handleRequestWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 1000) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal amount is ₦1,000.');
      return;
    }
    const totalDeduction = amt + fee;
    if (!wallet || totalDeduction > wallet.balance) {
      Alert.alert(
        'Insufficient Balance',
        `Withdrawal of ₦${amt.toLocaleString()} plus ₦${fee.toLocaleString()} fee (total ₦${totalDeduction.toLocaleString()}) exceeds your available balance of ${formatPrice(wallet?.balance || 0)}.`
      );
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || accountNumber.trim().length !== 10) {
      Alert.alert('Invalid Account Details', 'Please enter a valid bank name and 10-digit Nigerian account number.');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      // 1. Insert payout request (DB trigger validates balance, deducts wallet balance, and creates transaction)
      const { error } = await supabase.from('payout_requests').insert({
        user_id: user?.id,
        wallet_id: wallet.id,
        amount: amt,
        fee_amount: fee,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim() || profile?.full_name || 'Promoter',
        status: 'pending',
      });

      if (error) throw error;

      // 2. Save bank details to user profile
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            payout_bank_name: bankName.trim(),
            payout_account_number: accountNumber.trim(),
            payout_account_name: accountName.trim(),
          })
          .eq('id', user.id);
      }

      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      toast.success('Withdrawal Requested!', {
        description: 'Your payout request is being processed (typically 1-2 hours).',
      });
      fetchPromoterData();
    } catch (e: any) {
      Alert.alert('Withdrawal Error', e.message || 'Could not submit withdrawal request.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const handleShareGeneralLink = async () => {
    try {
      await Share.share({
        message: `Join Linkup Marketplace and get instant discounts on phones, electronics, groceries, and fast deliveries! Use my link: ${referralLink}`,
      });
    } catch (e) {
      console.warn('Share link error', e);
    }
  };

  const handleShareProduct = async (product: PromoterProduct) => {
    try {
      const code = promoterCode || user?.id?.slice(0, 8) || 'join';
      const shareUrl = `https://linkupng.com/product/${product.id}?ref=${code}`;
      await Share.share({
        message: `Check out ${product.title} on LinkUp (₦${product.finalPrice.toLocaleString('en-NG')}): ${shareUrl}`,
        title: product.title,
      });
      toast.success('Referral link shared!');
    } catch (e) {
      console.warn('Share product error', e);
    }
  };

  const formatPrice = (val: number) => '₦' + (val || 0).toLocaleString('en-NG');

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack} activeOpacity={0.8}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Affiliate & Promoter</Text>
        <TouchableOpacity
          style={styles.logoutHeaderBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityLabel="Sign out of account"
        >
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* 3-Tab Segmented Controller */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.8}
        >
          <TrendingUp size={15} color={activeTab === 'overview' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabButtonText, activeTab === 'overview' && styles.tabButtonTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]}
          onPress={() => setActiveTab('products')}
          activeOpacity={0.8}
        >
          <Package size={15} color={activeTab === 'products' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabButtonText, activeTab === 'products' && styles.tabButtonTextActive]}>
            Products ({totalProductsCount > 0 ? totalProductsCount : products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'wallet' && styles.tabButtonActive]}
          onPress={() => setActiveTab('wallet')}
          activeOpacity={0.8}
        >
          <Wallet size={15} color={activeTab === 'wallet' ? colors.primary : '#64748b'} />
          <Text style={[styles.tabButtonText, activeTab === 'wallet' && styles.tabButtonTextActive]}>
            Wallet & Payouts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {activeTab === 'overview' ? (
          <>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTag}>
                <Megaphone size={14} color={colors.primary} />
                <Text style={styles.heroTagText}>Promoter Partner Program</Text>
              </View>

              <Text style={styles.heroTitle}>Earn 5% on Every Product Sold</Text>
              <Text style={styles.heroSubtitle}>
                Share individual product links or your referral code. Every completed order credits earnings straight to your wallet!
              </Text>

              {/* Referral Code Box */}
              <View style={styles.codeBox}>
                <View>
                  <Text style={styles.codeLabel}>Your Promoter Code</Text>
                  <Text style={styles.codeText}>{promoterCode || 'LINKUP'}</Text>
                </View>

                <TouchableOpacity style={styles.shareIconBtn} onPress={handleShareGeneralLink} activeOpacity={0.8}>
                  <Share2 size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Performance & Earnings Grid */}
            <Text style={styles.sectionHeader}>Earnings & Activity</Text>
            <View style={styles.statsGrid}>
              {/* Available Wallet Balance */}
              <TouchableOpacity
                style={[styles.statCard, { borderColor: colors.primaryBorder, backgroundColor: colors.primaryLight }]}
                onPress={() => setActiveTab('wallet')}
                activeOpacity={0.85}
              >
                <View style={styles.statHeaderRow}>
                  <Wallet size={18} color={colors.primary} />
                  <Text style={styles.pillAction}>Withdraw</Text>
                </View>
                <Text style={styles.statLabel}>Available Balance</Text>
                <Text style={[styles.statValue, { color: '#7C2D12' }]}>
                  {formatPrice(wallet?.balance || 0)}
                </Text>
              </TouchableOpacity>

              {/* Total Commission Earned */}
              <View style={styles.statCard}>
                <TrendingUp size={18} color="#16a34a" />
                <Text style={styles.statLabel}>Total Commission</Text>
                <Text style={[styles.statValue, { color: '#16a34a' }]}>
                  {formatPrice(stats.totalCommissions)}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              {/* Escrow Pending */}
              <View style={styles.statCard}>
                <Clock size={18} color="#d97706" />
                <Text style={styles.statLabel}>Pending Escrow</Text>
                <Text style={[styles.statValue, { color: '#b45309' }]}>
                  {formatPrice(wallet?.escrow_balance || 0)}
                </Text>
              </View>

              {/* Referred Members */}
              <View style={styles.statCard}>
                <Users size={18} color={colors.primary} />
                <Text style={styles.statLabel}>Referred Members</Text>
                <Text style={styles.statValue}>{stats.totalReferrals}</Text>
              </View>
            </View>

            {/* Platform Percentage Notice Banner */}
            <View style={styles.noticeCard}>
              <View style={styles.noticeIconWrap}>
                <Info size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Customer-Facing Pricing</Text>
                <Text style={styles.noticeSub}>
                  All product prices include the platform markup (+{Math.round(markupRate * 100)}%), so your buyers see and pay the exact checkout amount with no extra surprise fees.
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <Button
                title="Browse Products to Promote"
                onPress={() => setActiveTab('products')}
                style={{ backgroundColor: colors.primary }}
              />
              <Button
                title="Withdraw Earnings"
                variant="outline"
                onPress={() => {
                  setActiveTab('wallet');
                  setIsWithdrawOpen(true);
                }}
                style={{ marginTop: 10, borderColor: colors.primary }}
              />
              <Button
                title="Share Referral Code"
                variant="outline"
                onPress={handleShareGeneralLink}
                style={{ marginTop: 10 }}
              />
            </View>

            {/* Bottom Sign Out Button */}
            <TouchableOpacity style={styles.bottomLogoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <LogOut size={16} color="#ef4444" />
              <Text style={styles.bottomLogoutText}>Sign Out of Promoter Account</Text>
            </TouchableOpacity>
          </>
        ) : activeTab === 'products' ? (
          /* Products To Promote Tab */
          <View>
            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <Search size={18} color="#94a3b8" />
              <TextInput
                placeholder="Search products to promote..."
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Pricing Info Banner */}
            <View style={styles.noticeCard}>
              <Tag size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: '#065f46' }]}>
                  Prices Include Platform Fee (+{Math.round(markupRate * 100)}%)
                </Text>
                <Text style={[styles.noticeSub, { color: '#047857' }]}>
                  Earn 5% commission on each completed sale. Prices reflect full buyer checkout amount.
                </Text>
              </View>
            </View>

            {/* Products List */}
            {loading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            ) : filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={44} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySub}>Try adjusting your search query or check back later.</Text>
              </View>
            ) : (
              <>
                <View style={styles.productsGrid}>
                  {filteredProducts.map((p) => {
                  const imageUrl =
                    p.images && p.images.length > 0 && p.images[0]
                      ? p.images[0]
                      : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.productCard}
                      activeOpacity={0.9}
                      onPress={() =>
                        navigation.navigate('ProductDetail', {
                          id: p.id,
                          title: p.title,
                          initialProduct: p,
                        })
                      }
                    >
                      {/* Product Image */}
                      <View style={styles.imageWrap}>
                        <Image source={{ uri: imageUrl }} style={styles.productImage} />
                        <View style={styles.commissionBadge}>
                          <Text style={styles.commissionBadgeText}>
                            Earn {formatPrice(p.commission)} (5%)
                          </Text>
                        </View>
                      </View>

                      {/* Product Info */}
                      <View style={styles.productInfo}>
                        <Text style={styles.productTitle} numberOfLines={2}>
                          {p.title}
                        </Text>

                        {/* Price (Product price + platform percentage on it) */}
                        <View style={styles.priceRow}>
                          <Text style={styles.productPrice}>{formatPrice(p.finalPrice)}</Text>
                          <Text style={styles.platformFeeNote}>
                            incl. {Math.round(markupRate * 100)}% fee
                          </Text>
                        </View>

                        {/* Share & Earn Button */}
                        <TouchableOpacity
                          style={styles.shareProductBtn}
                          onPress={() => handleShareProduct(p)}
                          activeOpacity={0.8}
                        >
                          <Share2 size={13} color="#ffffff" />
                          <Text style={styles.shareProductBtnText}>Share & Earn</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pagination / Load More Footer */}
              <View style={styles.paginationFooter}>
                <Text style={styles.paginationCountText}>
                  {searchQuery.trim()
                    ? `Found ${filteredProducts.length} matching products`
                    : `Showing ${products.length} of ${totalProductsCount || products.length} active products`}
                </Text>

                {!searchQuery.trim() && hasMoreProducts && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMoreProducts}
                    disabled={loadingMoreProducts}
                    activeOpacity={0.8}
                  >
                    {loadingMoreProducts ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Text style={styles.loadMoreBtnText}>Load More Products</Text>
                        <ChevronDown size={16} color={colors.primary} />
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!searchQuery.trim() && !hasMoreProducts && products.length > 0 && (
                  <View style={styles.allLoadedBadge}>
                    <CheckCircle2 size={14} color="#16a34a" />
                    <Text style={styles.allLoadedText}>All active products loaded</Text>
                  </View>
                )}
              </View>
              </>
            )}
          </View>
        ) : (
          /* Earnings & Wallet Tab */
          <View>
            {/* Big Wallet Card */}
            <View style={styles.walletHeroCard}>
              <View style={styles.walletHeroTop}>
                <View>
                  <Text style={styles.walletHeroLabel}>AVAILABLE FOR WITHDRAWAL</Text>
                  <Text style={styles.walletHeroBalance}>{formatPrice(wallet?.balance || 0)}</Text>
                </View>
                <View style={styles.walletIconCircle}>
                  <Wallet size={24} color="#ffffff" />
                </View>
              </View>

              <View style={styles.walletEscrowRow}>
                <Clock size={14} color="#cbd5e1" />
                <Text style={styles.walletEscrowText}>
                  Pending in Escrow: {formatPrice(wallet?.escrow_balance || 0)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.walletActionsRow}>
                <TouchableOpacity
                  style={styles.withdrawMainBtn}
                  onPress={() => setIsWithdrawOpen(true)}
                  activeOpacity={0.85}
                >
                  <ArrowDownToLine size={16} color="#ffffff" />
                  <Text style={styles.withdrawMainBtnText}>Withdraw Funds</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.openWalletBtn}
                  onPress={() => navigation.navigate('Wallet')}
                  activeOpacity={0.85}
                >
                  <CreditCard size={16} color={colors.primary} />
                  <Text style={styles.openWalletBtnText}>Full Wallet</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payout Rule Box */}
            <View style={styles.payoutRuleCard}>
              <CheckCircle2 size={18} color="#16a34a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutRuleTitle}>Fast Bank Settlement</Text>
                <Text style={styles.payoutRuleSub}>
                  Minimum payout is ₦1,000. Funds are transferred to your Nigerian bank account within 1-2 hours of approval.
                </Text>
              </View>
            </View>

            {/* Payout Requests History */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Recent Payout Requests</Text>
            {payouts.length === 0 ? (
              <View style={styles.emptyPayoutsCard}>
                <Building2 size={36} color="#94a3b8" />
                <Text style={styles.emptyPayoutsTitle}>No Withdrawals Yet</Text>
                <Text style={styles.emptyPayoutsSub}>
                  When you request a payout, status and bank transfer tracking will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.payoutList}>
                {payouts.map((req) => {
                  const isPending = req.status === 'pending';
                  const isPaid = req.status === 'approved' || req.status === 'completed';

                  return (
                    <View key={req.id} style={styles.payoutCard}>
                      <View style={styles.payoutCardLeft}>
                        <View
                          style={[
                            styles.payoutIconBox,
                            { backgroundColor: isPaid ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2' },
                          ]}
                        >
                          <Building2 size={18} color={isPaid ? '#16a34a' : isPending ? '#d97706' : '#ef4444'} />
                        </View>
                        <View>
                          <Text style={styles.payoutBankName}>{req.bank_name}</Text>
                          <Text style={styles.payoutAccountNum}>
                            {req.account_number} • {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.payoutAmount}>{formatPrice(req.amount)}</Text>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: isPaid ? '#ecfdf5' : isPending ? '#fffbeb' : '#fef2f2' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: isPaid ? '#059669' : isPending ? '#b45309' : '#dc2626' },
                            ]}
                          >
                            {isPaid ? 'Paid' : isPending ? 'Pending' : 'Declined'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Withdrawal Request Modal */}
      <Modal visible={isWithdrawOpen} transparent animationType="slide" onRequestClose={() => setIsWithdrawOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Withdraw Earnings</Text>
                <Text style={styles.modalSubtitle}>Available: {formatPrice(wallet?.balance || 0)}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsWithdrawOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Amount Input */}
              <Text style={styles.inputLabel}>Withdrawal Amount (₦)</Text>
              <TextInput
                placeholder="e.g. 5000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                style={styles.modalInput}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />

              {/* Percentage Presets */}
              <View style={styles.presetRow}>
                {[0.25, 0.5, 1.0].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={styles.presetBtn}
                    onPress={() => {
                      const max = wallet?.balance || 0;
                      setWithdrawAmount(Math.floor(max * pct).toString());
                    }}
                  >
                    <Text style={styles.presetText}>{pct === 1.0 ? 'Max (100%)' : `${pct * 100}%`}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bank Name */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Bank Name</Text>
              <TextInput
                placeholder="e.g. GTBank, Access, OPay, Kuda, Zenith"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                value={bankName}
                onChangeText={setBankName}
              />

              {/* Account Number */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>10-Digit Account Number</Text>
              <TextInput
                placeholder="0123456789"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                maxLength={10}
                style={styles.modalInput}
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              {/* Account Name */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Account Holder Name</Text>
              <TextInput
                placeholder="Name on bank account"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                value={accountName}
                onChangeText={setAccountName}
              />

              <Button
                title={submittingWithdraw ? 'Submitting Request...' : 'Confirm Withdrawal'}
                onPress={handleRequestWithdrawal}
                loading={submittingWithdraw}
                disabled={submittingWithdraw}
                style={{ marginTop: 22, backgroundColor: colors.primary }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <View style={styles.signOutModalContainer}>
            <View style={styles.signOutIconWrapper}>
              <LogOut size={26} color="#ef4444" />
            </View>

            <Text style={styles.signOutModalTitle}>Sign Out</Text>
            <Text style={styles.signOutModalSubtitle}>
              Are you sure you want to sign out of your LinkUp promoter account?
            </Text>

            <View style={styles.signOutActionsRow}>
              <TouchableOpacity
                style={styles.signOutCancelBtn}
                onPress={() => setSignOutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signOutConfirmBtn, signingOut && { opacity: 0.6 }]}
                onPress={handleConfirmLogout}
                disabled={signingOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutConfirmText}>
                  {signingOut ? 'Signing Out...' : 'Sign Out'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1c1917',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(235, 125, 48, 0.25)',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 14,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 6,
    lineHeight: 18,
  },
  codeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(235, 125, 48, 0.3)',
  },
  codeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  codeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 2,
  },
  shareIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillAction: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 8,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginVertical: 14,
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  noticeSub: {
    fontSize: 12,
    color: '#C2410C',
    marginTop: 2,
    lineHeight: 17,
  },
  actionsContainer: {
    marginTop: 4,
  },
  bottomLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  bottomLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  productCard: {
    width: (width - 44) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 4,
  },
  imageWrap: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  commissionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  commissionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 17,
    minHeight: 34,
  },
  priceRow: {
    marginTop: 6,
    marginBottom: 10,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  platformFeeNote: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  shareProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shareProductBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  /* Wallet & Payout Styles */
  walletHeroCard: {
    backgroundColor: '#1c1917',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(235, 125, 48, 0.25)',
  },
  walletHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  walletHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  walletHeroBalance: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  walletIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletEscrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  walletEscrowText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  walletActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  withdrawMainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  withdrawMainBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  openWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  openWalletBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  payoutRuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
  },
  payoutRuleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  payoutRuleSub: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
    lineHeight: 16,
  },
  emptyPayoutsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyPayoutsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 10,
  },
  emptyPayoutsSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  payoutList: {
    gap: 10,
  },
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payoutCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  payoutIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutBankName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  payoutAccountNum: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  payoutAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  paginationFooter: {
    marginTop: 20,
    marginBottom: 24,
    alignItems: 'center',
    gap: 12,
  },
  paginationCountText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
    minWidth: 200,
  },
  loadMoreBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  allLoadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  allLoadedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  /* Sign Out Modal */
  signOutModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  signOutIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#fef2f2',
  },
  signOutModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  signOutModalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  signOutActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signOutCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  signOutConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
