import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar as RNStatusBar,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { colors } from '../../theme/colors';

export type SafeEdge = 'top' | 'right' | 'bottom' | 'left';

export interface SafeViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  contentBackgroundColor?: string;
  statusBarStyle?: 'light-content' | 'dark-content';
  statusBarColor?: string;
  edges?: SafeEdge[];
  translucentStatusBar?: boolean;
}

/**
 * LinkUp Reusable SafeView Component
 * Powered by `react-native-safe-area-context`.
 * Safe area background: LinkUp official brand orange #E96F28
 * Default status bar: light-content on #E96F28
 */
export function SafeView({
  children,
  style,
  backgroundColor = '#E96F28',
  contentBackgroundColor = '#FDFEFE',
  statusBarStyle = 'light-content',
  statusBarColor,
  edges = ['top', 'right', 'bottom', 'left'],
  translucentStatusBar = false,
}: SafeViewProps) {
  const insets = useSafeAreaInsets();

  const topInset = edges.includes('top')
    ? insets.top > 0
      ? insets.top
      : Platform.OS === 'android' && translucentStatusBar
      ? RNStatusBar.currentHeight || 24
      : insets.top
    : 0;

  const paddingStyle: ViewStyle = {
    paddingTop: topInset,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const actualStatusBarColor = statusBarColor || backgroundColor;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        paddingStyle,
      ]}
    >
      <RNStatusBar
        barStyle={statusBarStyle}
        backgroundColor={actualStatusBarColor}
        translucent={translucentStatusBar}
      />
      <ExpoStatusBar
        style={statusBarStyle === 'light-content' ? 'light' : 'dark'}
        backgroundColor={actualStatusBarColor}
        translucent={translucentStatusBar}
      />
      <View style={[styles.content, { backgroundColor: contentBackgroundColor }, style]}>
        {children}
      </View>
    </View>
  );
}

export const SafeScreen = SafeView;
export const SafeAreaView = SafeView;
export type SafeScreenProps = SafeViewProps;
export type SafeAreaViewProps = SafeViewProps;
export default SafeView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
