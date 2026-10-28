import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  statusMessage?: string;
}

export function SplashScreen({ statusMessage = 'Initializing Linkup...' }: SplashScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // 1. Initial fade in of the entire splash screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    // 2. Continuous breathing pulse for the logo and halo
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(haloAnim, {
            toValue: 1.15,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(haloAnim, {
            toValue: 0.95,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim, haloAnim, fadeAnim]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Background Decor Elements */}
      <View style={styles.topOrb} />
      <View style={styles.bottomOrb} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Animated Brand Badge */}
        <View style={styles.badgeWrapper}>
          <Animated.View
            style={[
              styles.haloCircle,
              {
                transform: [{ scale: haloAnim }],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.logoBadge,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Brand Title & Tagline */}
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.titleMain}>LINK</Text>
            <Text style={styles.titleAccent}>UP</Text>
          </View>
          <View style={styles.taglineBadge}>
            <Text style={styles.taglineText}>MARKETPLACE & EXPRESS LOGISTICS</Text>
          </View>
          <Text style={styles.subText}>
            Shop Local • Verified Sellers • Escrow Secured
          </Text>
        </View>

        {/* Loading Indicator & Status */}
        <View style={styles.loaderArea}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </Animated.View>

      {/* Escrow Trust Footer */}
      <View style={styles.footer}>
        <ShieldCheck size={14} color={colors.success} strokeWidth={2.2} />
        <Text style={styles.footerText}>100% Escrow Secured Payments</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Clean white background #FDFEFE
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  topOrb: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#fff7ed',
    opacity: 0.8,
  },
  bottomOrb: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#ffedd5',
    opacity: 0.6,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  badgeWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  haloCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(235, 125, 48, 0.15)', // Soft warm orange halo
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fed7aa',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleMain: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 2,
  },
  titleAccent: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.primary, // Orange #EB7D30
    letterSpacing: 2,
  },
  taglineBadge: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryDark,
    letterSpacing: 1.2,
  },
  subText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '600',
  },
  loaderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 36,
    backgroundColor: '#f8fafc',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.2,
  },
});
