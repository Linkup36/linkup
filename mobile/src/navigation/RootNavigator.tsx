import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { BottomTabNavigator } from './BottomTabNavigator';
import { useAuth } from '../context/AuthContext';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SplashScreen } from '../components/ui/SplashScreen';
import { GooeyToaster } from '../components/ui/GooeyToast';

// Screens
import { ProductDetailScreen } from '../features/marketplace/screens/ProductDetailScreen';
import { CheckoutScreen } from '../features/marketplace/screens/CheckoutScreen';
import { WishlistScreen } from '../features/marketplace/screens/WishlistScreen';
import { SendTrackingScreen } from '../features/send/screens/SendTrackingScreen';
import { SendHistoryScreen } from '../features/send/screens/SendHistoryScreen';
import { WalletScreen } from '../features/user/screens/WalletScreen';
import { MessagesScreen } from '../features/user/screens/MessagesScreen';
import { ChatScreen } from '../features/user/screens/ChatScreen';
import { NotificationsScreen } from '../features/user/screens/NotificationsScreen';
import { SupportScreen } from '../features/user/screens/SupportScreen';
import { ProfileScreen } from '../features/user/screens/ProfileScreen';
import { MenuScreen } from '../features/user/screens/MenuScreen';
import { ListProductScreen } from '../features/seller/screens/ListProductScreen';
import { SellerDashboardScreen } from '../features/seller/screens/SellerDashboardScreen';
import { SellerVerificationScreen } from '../features/seller/screens/SellerVerificationScreen';
import { OrdersScreen } from '../features/marketplace/screens/OrdersScreen';
import { LogisticsDashboardV2Screen } from '../features/logistics_v2';
import { PromoterDashboardScreen } from '../features/promoter/screens/PromoterDashboardScreen';
import { AdminDashboardScreen } from '../features/admin';
import { OnboardingScreen } from '../features/auth/screens/OnboardingScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../features/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../features/auth/screens/ResetPasswordScreen';
import { TermsAndPrivacyScreen } from '../features/auth/screens/TermsAndPrivacyScreen';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [
    'linkup://',
    'https://www.linkupng.com',
    'https://linkupng.com',
    'https://linkup.ng',
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: '',
          SearchTab: 'search',
          SendTab: 'send',
          CartTab: 'cart',
          ProfileTab: 'profile',
        },
      },
      ProductDetail: 'product/:id',
      SendTracking: 'send/track/:orderId',
      SendHistory: 'send/history',
      Wallet: 'wallet',
      Messages: 'messages',
      Chat: 'chat/:conversationId',
      Wishlist: 'wishlist',
      Notifications: 'notifications',
      Support: 'support',
      SellerDashboard: 'dashboard',
      ListProduct: 'sell',
      SellerVerification: 'verify',
      Orders: 'orders',
      LogisticsDashboard: 'logistics',
      PromoterDashboard: 'promoter-dashboard',
      AdminDashboard: 'admin',
      Onboarding: 'onboarding',
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
    },
  },
};

export function RootNavigator() {
  const { user, profile, loading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    // Immediately hide the static OS splash screen so our custom animated SplashScreen is visible
    ExpoSplashScreen.hideAsync().catch(() => {});

    // Ensure users enjoy the premium animated SplashScreen for at least 1.8s
    const timer = setTimeout(() => {
      setSplashFinished(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  if (loading || !splashFinished) {
    return (
      <SplashScreen
        statusMessage={loading ? 'Verifying secure session...' : 'Welcome to Linkup'}
      />
    );
  }

  const initialRouteName =
    user && profile && profile.onboarding_completed === false ? 'Onboarding' : 'MainTabs';

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen
          name="Menu"
          component={MenuScreen}
          options={{ presentation: 'modal', animation: 'slide_from_left' }}
        />
        <Stack.Screen name="SendHistory" component={SendHistoryScreen} />
        <Stack.Screen name="ListProduct" component={ListProductScreen} />
        <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
        <Stack.Screen name="SellerVerification" component={SellerVerificationScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="LogisticsDashboard" component={LogisticsDashboardV2Screen} />
        <Stack.Screen name="PromoterDashboard" component={PromoterDashboardScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen
          name="SendTracking"
          component={SendTrackingScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="TermsAndPrivacy"
          component={TermsAndPrivacyScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
      <GooeyToaster />
    </NavigationContainer>
  );
}
