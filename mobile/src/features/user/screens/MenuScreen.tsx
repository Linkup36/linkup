import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeView } from '../../../components/ui/SafeView';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';
import {
  Home,
  Package,
  Send,
  ShoppingBag,
  ShoppingCart,
  Heart,
  HelpCircle,
  X,
  Grid,
  Download,
  LogOut,
  LogIn,
  LayoutDashboard,
  Truck,
  Wallet,
  User,
  Headphones,
  ShieldCheck,
  Megaphone,
} from 'lucide-react-native';

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
}

export function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, roles, activeRole, setActiveRole, signOut } = useAuth();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedNav, setSelectedNav] = useState<string>('Marketplace');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Products');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const allUserRoles = React.useMemo(() => {
    const list = [...(roles || []), ...(userRoles || [])];
    if (profile?.role && !list.includes(profile.role)) list.push(profile.role);
    if (activeRole && !list.includes(activeRole)) list.push(activeRole);
    return list;
  }, [roles, userRoles, profile?.role, activeRole]);

  const isSeller = allUserRoles.includes('seller');
  const isPromoter = allUserRoles.includes('promoter');
  const isLogistics = allUserRoles.includes('logistics');
  const isAdmin = allUserRoles.includes('admin');

  // 1. Fetch Categories from live Supabase table
  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, name, slug')
          .order('name');
        if (data) {
          setCategories(data);
        }
      } catch (err) {
        console.warn('[MenuScreen] Fetch categories error:', err);
      }
    }
    loadCategories();
  }, []);

  // 2. Fetch User Roles if logged in
  useEffect(() => {
    async function loadRoles() {
      if (!user) {
        setUserRoles([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        if (data) {
          setUserRoles(data.map((r: any) => r.role));
        }
      } catch (err) {
        console.warn('[MenuScreen] Fetch roles error:', err);
      }
    }
    loadRoles();
  }, [user]);

  const handleClose = () => {
    Haptics.selectionAsync();
    navigation.navigate('MainTabs', { screen: 'HomeTab' });
  };

  const handleNavClick = (label: string, action: () => void) => {
    Haptics.selectionAsync();
    setSelectedNav(label);
    action();
  };

  const handleCategorySelect = (categoryName: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(categoryName);
    navigation.navigate('MainTabs', {
      screen: 'HomeTab',
      params: { category: categoryName },
    });
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Discover Nigeria’s fastest hyperlocal marketplace and instant peer-to-peer parcel delivery on LinkUp Global! https://linkup.ng',
        title: 'Linkup Global',
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Linkup?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.navigate('MainTabs', { screen: 'HomeTab' });
        },
      },
    ]);
  };


  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Drawer Header */}
      <View style={styles.header}>
        {/* Brand Logo & Name */}
        <View style={styles.brandGroup}>
          <BrandLogo size="sm" />
          <View style={styles.brandTitleWrap}>
            <Text style={styles.brandTitle}>Linkup</Text>
            <Text style={styles.brandGlobal}>GLOBAL</Text>
          </View>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <X size={20} color="#64748b" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Primary Navigation List */}
        <View style={styles.navList}>
          {/* Marketplace */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Marketplace' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Marketplace', () =>
                navigation.navigate('MainTabs', { screen: 'HomeTab' })
              )
            }
            activeOpacity={0.7}
          >
            <Home
              size={18}
              color={selectedNav === 'Marketplace' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Marketplace' && styles.navLabelActive,
              ]}
            >
              Marketplace
            </Text>
            {selectedNav === 'Marketplace' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Promoter Hub (if active promoter) */}
          {isPromoter && (
            <TouchableOpacity
              style={[
                styles.navItem,
                {
                  backgroundColor: '#FFF7ED',
                  borderColor: '#FED7AA',
                  borderWidth: 1,
                  marginVertical: 4,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setActiveRole('promoter');
                navigation.navigate('PromoterDashboard');
              }}
              activeOpacity={0.85}
            >
              <Megaphone size={18} color="#EB7D30" strokeWidth={2.4} />
              <Text style={[styles.navLabel, { color: '#EB7D30', fontWeight: '800' }]}>
                Promoter Hub
              </Text>
              <View
                style={{
                  backgroundColor: '#EB7D30',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff', letterSpacing: 0.6 }}>
                  EARN 5%
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Seller Dashboard (if active seller) */}
          {isSeller && (
            <TouchableOpacity
              style={[
                styles.navItem,
                {
                  backgroundColor: '#0f172a',
                  borderColor: 'rgba(233, 111, 40, 0.4)',
                  borderWidth: 1,
                  marginVertical: 4,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setActiveRole('seller');
                navigation.navigate('SellerDashboard');
              }}
              activeOpacity={0.85}
            >
              <LayoutDashboard size={18} color={colors.primary} strokeWidth={2.4} />
              <Text style={[styles.navLabel, { color: '#ffffff', fontWeight: '800' }]}>
                Seller Dashboard
              </Text>
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff', letterSpacing: 0.6 }}>
                  SELLER HUB
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Logistics Fleet (if rider) */}
          {isLogistics && (
            <TouchableOpacity
              style={[
                styles.navItem,
                {
                  backgroundColor: '#F0FDF4',
                  borderColor: '#BBF7D0',
                  borderWidth: 1,
                  marginVertical: 4,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setActiveRole('logistics');
                navigation.navigate('LogisticsDashboard');
              }}
              activeOpacity={0.85}
            >
              <Truck size={18} color="#16A34A" strokeWidth={2.4} />
              <Text style={[styles.navLabel, { color: '#16A34A', fontWeight: '800' }]}>
                Logistics Fleet
              </Text>
              <View
                style={{
                  backgroundColor: '#16A34A',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff', letterSpacing: 0.6 }}>
                  RIDER
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Admin Portal (if admin) */}
          {isAdmin && (
            <TouchableOpacity
              style={[
                styles.navItem,
                {
                  backgroundColor: '#FFF7ED',
                  borderColor: '#FED7AA',
                  borderWidth: 1,
                  marginVertical: 4,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                navigation.navigate('AdminDashboard');
              }}
              activeOpacity={0.85}
            >
              <ShieldCheck size={18} color="#EA580C" strokeWidth={2.4} />
              <Text style={[styles.navLabel, { color: '#EA580C', fontWeight: '800' }]}>
                Admin Portal
              </Text>
              <View
                style={{
                  backgroundColor: '#EA580C',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff', letterSpacing: 0.6 }}>
                  ADMIN
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Send Package */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Send Package' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Send Package', () =>
                navigation.navigate('MainTabs', { screen: 'SendTab' })
              )
            }
            activeOpacity={0.7}
          >
            <Package
              size={18}
              color={selectedNav === 'Send Package' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Send Package' && styles.navLabelActive,
              ]}
            >
              Send Package
            </Text>
            {selectedNav === 'Send Package' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Sent Packages */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Sent Packages' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Sent Packages', () =>
                navigation.navigate('SendHistory')
              )
            }
            activeOpacity={0.7}
          >
            <Send
              size={18}
              color={selectedNav === 'Sent Packages' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Sent Packages' && styles.navLabelActive,
              ]}
            >
              Sent Packages
            </Text>
            {selectedNav === 'Sent Packages' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* My Orders */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'My Orders' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('My Orders', () =>
                navigation.navigate('Orders')
              )
            }
            activeOpacity={0.7}
          >
            <ShoppingBag
              size={18}
              color={selectedNav === 'My Orders' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'My Orders' && styles.navLabelActive,
              ]}
            >
              My Orders
            </Text>
            {selectedNav === 'My Orders' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Cart' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Cart', () =>
                navigation.navigate('MainTabs', { screen: 'CartTab' })
              )
            }
            activeOpacity={0.7}
          >
            <ShoppingCart
              size={18}
              color={selectedNav === 'Cart' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Cart' && styles.navLabelActive,
              ]}
            >
              Cart
            </Text>
            {selectedNav === 'Cart' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Wishlist */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Wishlist' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Wishlist', () =>
                navigation.navigate('Wishlist')
              )
            }
            activeOpacity={0.7}
          >
            <Heart
              size={18}
              color={selectedNav === 'Wishlist' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Wishlist' && styles.navLabelActive,
              ]}
            >
              Wishlist
            </Text>
            {selectedNav === 'Wishlist' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Support */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedNav === 'Support' && styles.navItemActive,
            ]}
            onPress={() =>
              handleNavClick('Support', () =>
                navigation.navigate('Support')
              )
            }
            activeOpacity={0.7}
          >
            <HelpCircle
              size={18}
              color={selectedNav === 'Support' ? colors.primary : '#475569'}
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedNav === 'Support' && styles.navLabelActive,
              ]}
            >
              Support
            </Text>
            {selectedNav === 'Support' && <View style={styles.activeDot} />}
          </TouchableOpacity>

          {/* Logistics Dashboard (if logistics/courier) */}
          {(userRoles.includes('logistics') || profile?.role === 'logistics') && (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('LogisticsDashboard')}
              activeOpacity={0.7}
            >
              <Truck size={18} color="#475569" strokeWidth={2.3} />
              <Text style={styles.navLabel}>Logistics Fleet</Text>
            </TouchableOpacity>
          )}

          {/* Promoter Dashboard (if affiliate/promoter) */}
          {(userRoles.includes('promoter') || profile?.role === 'promoter') && (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('PromoterDashboard')}
              activeOpacity={0.7}
            >
              <Megaphone size={18} color="#475569" strokeWidth={2.3} />
              <Text style={styles.navLabel}>Affiliate Hub</Text>
            </TouchableOpacity>
          )}

          {/* Admin Dashboard (if admin) */}
          {(userRoles.includes('admin') || profile?.role === 'admin') && (
            <TouchableOpacity
              style={[
                styles.navItem,
                { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1 }
              ]}
              onPress={() => navigation.navigate('AdminDashboard')}
              activeOpacity={0.7}
            >
              <ShieldCheck size={18} color={colors.primary} strokeWidth={2.4} />
              <Text style={[styles.navLabel, { color: colors.primary, fontWeight: '800' }]}>
                Admin Portal
              </Text>
            </TouchableOpacity>
          )}

          {/* Wallet */}
          {user && (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('Wallet')}
              activeOpacity={0.7}
            >
              <Wallet size={18} color="#475569" strokeWidth={2.3} />
              <Text style={styles.navLabel}>Linkup Wallet</Text>
            </TouchableOpacity>
          )}

          {/* Profile & Settings */}
          {user && (
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <User size={18} color="#475569" strokeWidth={2.3} />
              <Text style={styles.navLabel}>Account Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORIES Section */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionHeader}>CATEGORIES</Text>

          {/* All Products Item */}
          <TouchableOpacity
            style={[
              styles.navItem,
              selectedCategory === 'All Products' && styles.navItemActive,
            ]}
            onPress={() => handleCategorySelect('All Products')}
            activeOpacity={0.7}
          >
            <Grid
              size={18}
              color={
                selectedCategory === 'All Products' ? colors.primary : '#475569'
              }
              strokeWidth={2.3}
            />
            <Text
              style={[
                styles.navLabel,
                selectedCategory === 'All Products' && styles.navLabelActive,
              ]}
            >
              All Products
            </Text>
            {selectedCategory === 'All Products' && (
              <View style={styles.activeDot} />
            )}
          </TouchableOpacity>

          {/* Dynamic Categories from Supabase */}
          {categories.map((cat) => {
            const isCatActive = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.navItem, isCatActive && styles.navItemActive]}
                onPress={() => handleCategorySelect(cat.name)}
                activeOpacity={0.7}
              >
                <Grid
                  size={18}
                  color={isCatActive ? colors.primary : '#475569'}
                  strokeWidth={2.1}
                />
                <Text
                  style={[
                    styles.navLabel,
                    isCatActive && styles.navLabelActive,
                  ]}
                >
                  {cat.name}
                </Text>
                {isCatActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer Actions */}
        <View style={styles.footerSection}>
          {/* Install / Share App Button */}

          {/* Log Out or Sign In Row */}
          {user ? (
            <TouchableOpacity
              style={styles.authRow}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <LogOut size={17} color="#64748b" strokeWidth={2.2} />
              <Text style={styles.authText}>Log Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.authRow}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <LogIn size={17} color={colors.primary} strokeWidth={2.4} />
              <Text style={[styles.authText, { color: colors.primary }]}>
                Sign In / Register
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating Orange Customer Support Button matching Linkup mobile UI */}
      <TouchableOpacity
        style={styles.floatingSupportBtn}
        onPress={() => {
          Haptics.selectionAsync();
          navigation.navigate('Support');
        }}
        activeOpacity={0.85}
      >
        <Headphones size={22} color="#ffffff" strokeWidth={2.3} />
      </TouchableOpacity>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.primary, // Orange #EB7D30
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  brandTitleWrap: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
    lineHeight: 18,
  },
  brandGlobal: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  navList: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 12,
  },
  navItemActive: {
    backgroundColor: '#FFF7ED', // Warm light orange tint
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    letterSpacing: -0.2,
  },
  navLabelActive: {
    color: colors.primary, // #EB7D30
    fontWeight: '800',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary, // #EB7D30
  },
  categoriesSection: {
    marginTop: 18,
    gap: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 1.6,
    paddingHorizontal: 14,
    marginBottom: 6,
    marginTop: 4,
  },
  footerSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 14,
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 14,
  },
  installBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  authText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  floatingSupportBtn: {
    position: 'absolute',
    left: 20,
    bottom: 82,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary, // #EB7D30 LinkUp Orange
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    zIndex: 99,
  },
});
