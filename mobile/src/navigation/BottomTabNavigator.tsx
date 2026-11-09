import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { Home, Search, Send, ShoppingCart, Grid } from 'lucide-react-native';
import { useCart } from '../context/CartContext';
import { Platform, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { HomeScreen } from '../features/marketplace/screens/HomeScreen';
import { SearchScreen } from '../features/marketplace/screens/SearchScreen';
import { SendPackageScreen } from '../features/send/screens/SendPackageScreen';
import { CartScreen } from '../features/marketplace/screens/CartScreen';
import { MenuScreen } from '../features/user/screens/MenuScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const BRAND_ORANGE = '#E96F28';

export function BottomTabNavigator() {
  const { totalCount } = useCart();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.72)',
        tabBarStyle: {
          backgroundColor: BRAND_ORANGE,
          borderTopColor: BRAND_ORANGE,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 8,
          elevation: 16,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          marginTop: -2,
          letterSpacing: 0.5,
        },
      }}
    >
      {/* 1. HOME */}
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2.4} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          },
        }}
      />

      {/* 2. SEARCH */}
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: 'SEARCH',
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} strokeWidth={2.4} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          },
        }}
      />

      {/* 3. SEND (Center Hero Action Button) */}
      <Tab.Screen
        name="SendTab"
        component={SendPackageScreen}
        options={{
          tabBarLabel: 'SEND',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '900',
            marginTop: -2,
            letterSpacing: 0.6,
            color: '#ffffff',
          },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.centerSendBtn, focused && styles.centerSendBtnActive]}>
              <Send
                size={22}
                color={BRAND_ORANGE}
                strokeWidth={2.6}
                style={{ marginLeft: 2 }}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          },
        }}
      />

      {/* 4. CART */}
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          tabBarLabel: 'CART',
          tabBarBadge: totalCount > 0 ? (totalCount > 9 ? '9+' : totalCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ffffff',
            fontSize: 9,
            fontWeight: '900',
            color: BRAND_ORANGE,
            minWidth: 16,
            height: 16,
            lineHeight: 14,
            top: Platform.OS === 'ios' ? -2 : 0,
          },
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart size={size} color={color} strokeWidth={2.4} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          },
        }}
      />

      {/* 5. MENU */}
      <Tab.Screen
        name="ProfileTab"
        component={MenuScreen}
        options={{
          tabBarLabel: 'MENU',
          tabBarIcon: ({ color, size }) => (
            <Grid size={size} color={color} strokeWidth={2.4} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centerSendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? -22 : -20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 3,
    borderColor: BRAND_ORANGE,
  },
  centerSendBtnActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowOpacity: 0.35,
  },
});
