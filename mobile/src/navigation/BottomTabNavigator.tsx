import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { Home, Search, Send, ShoppingCart, Grid } from 'lucide-react-native';
import { useCart } from '../context/CartContext';
import * as Haptics from 'expo-haptics';

import { HomeScreen } from '../features/marketplace/screens/HomeScreen';
import { SearchScreen } from '../features/marketplace/screens/SearchScreen';
import { SendPackageScreen } from '../features/send/screens/SendPackageScreen';
import { CartScreen } from '../features/marketplace/screens/CartScreen';
import { MenuScreen } from '../features/user/screens/MenuScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const BRAND_ORANGE = '#FA7E2B';

const TAB_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  HomeTab: { label: 'Home', icon: Home },
  SearchTab: { label: 'Search', icon: Search },
  SendTab: { label: 'Send', icon: Send },
  CartTab: { label: 'Cart', icon: ShoppingCart },
  ProfileTab: { label: 'Menu', icon: Grid },
};

function CurvyFloatingBottomTabBar({
  state,
  descriptors,
  navigation,
  cartCount,
}: BottomTabBarProps & { cartCount: number }) {
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const containerWidth = tabBarWidth || (Dimensions.get('window').width - 28);
  const singleTabWidth = (containerWidth - 12) / state.routes.length;

  const tabIndicatorX = useRef(new Animated.Value(0)).current;

  // Icon bounce scales for each of the 5 tabs
  const iconScales = useRef(
    state.routes.map(() => new Animated.Value(1))
  ).current;

  useEffect(() => {
    Animated.spring(tabIndicatorX, {
      toValue: state.index * singleTabWidth,
      useNativeDriver: true,
      tension: 68,
      friction: 9,
    }).start();
  }, [state.index, singleTabWidth, tabIndicatorX]);

  const handleTabPress = (route: any, index: number, isFocused: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Icon micro-bounce
    Animated.sequence([
      Animated.timing(iconScales[index], {
        toValue: 1.25,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(iconScales[index], {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  // Hide the floating bottom navigator on the cart page so the checkout button is never blocked
  const currentRoute = state.routes[state.index];
  const descriptor = descriptors?.[currentRoute?.key];
  const tabBarStyle = descriptor?.options?.tabBarStyle as any;

  if (
    currentRoute?.name === 'CartTab' ||
    currentRoute?.name === 'SendTab' ||
    tabBarStyle?.display === 'none'
  ) {
    return null;
  }

  return (
    <View style={styles.bottomTabBarWrapper}>
      <View
        style={styles.bottomTabBar}
        onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Smooth Sliding Active Glass Pill with Spring Physics */}
        <Animated.View
          style={[
            styles.slidingActivePill,
            {
              width: singleTabWidth,
              transform: [{ translateX: tabIndicatorX }],
            },
          ]}
        >
          {/* Top Indicator Line */}
          <View style={styles.activeIndicatorLine} />
        </Animated.View>

        {state.routes.map((route, index) => {
          const isActive = state.index === index;
          const config = TAB_CONFIG[route.name] || { label: route.name, icon: Home };
          const IconComp = config.icon;
          const scaleAnim = iconScales[index] || new Animated.Value(1);

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabButton}
              onPress={() => handleTabPress(route, index, isActive)}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.tabIconWrapper,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <IconComp
                  size={20}
                  color={isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)'}
                  strokeWidth={isActive ? 2.6 : 2}
                  style={route.name === 'SendTab' ? { marginLeft: 1 } : undefined}
                />
                {route.name === 'CartTab' && cartCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function BottomTabNavigator() {
  const { totalCount } = useCart();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <CurvyFloatingBottomTabBar {...props} cartCount={totalCount} />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="SearchTab" component={SearchScreen} />
      <Tab.Screen
        name="SendTab"
        component={SendPackageScreen}
        options={{
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen name="ProfileTab" component={MenuScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Curvy Floating Glass Navigator (#FA7E2B) matching Logistics Dashboard V2
  bottomTabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
    zIndex: 99,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FA7E2B',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 7,
    paddingHorizontal: 6,
    position: 'relative',
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 8,
  },
  slidingActivePill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: 'rgba(0, 0, 0, 0.14)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  activeIndicatorLine: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 3,
    minHeight: 50,
    zIndex: 2,
  },
  tabIconWrapper: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FA7E2B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FA7E2B',
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tabLabelInactive: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontWeight: '600',
  },
});
