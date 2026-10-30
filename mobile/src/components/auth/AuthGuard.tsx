import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShieldAlert, Lock, ArrowLeft, LogIn } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { SafeView } from '../ui/SafeView';
import { RootStackParamList } from '../../navigation/types';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function AuthGuard({
  children,
  requiredRoles,
  fallbackTitle,
  fallbackDescription,
}: AuthGuardProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, roles, loading, signOut } = useAuth();

  // 1. Loading State
  if (loading) {
    return (
      <SafeView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Verifying authorization...</Text>
      </SafeView>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return (
      <SafeView style={styles.centerContainer}>
        <View style={styles.iconCircle}>
          <Lock size={36} color={colors.primary} />
        </View>
        <Text style={styles.title}>{fallbackTitle || 'Sign In Required'}</Text>
        <Text style={styles.description}>
          {fallbackDescription ||
            'You must be signed in to access this section of LinkUp.'}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <LogIn size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Sign In to Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('MainTabs')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <Text style={styles.secondaryButtonText}>Return to Marketplace</Text>
        </TouchableOpacity>
      </SafeView>
    );
  }

  // 3. Role-based Authorization State
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoles = roles || [];
    const hasRole =
      userRoles.includes('admin') ||
      requiredRoles.some((reqRole) => userRoles.includes(reqRole));

    if (!hasRole) {
      const roleLabel = requiredRoles.join(' or ');
      return (
        <SafeView style={styles.centerContainer}>
          <View style={[styles.iconCircle, styles.deniedCircle]}>
            <ShieldAlert size={38} color="#EF4444" />
          </View>
          <Text style={styles.title}>Access Denied (403)</Text>
          <Text style={styles.description}>
            Your account ({profile?.email || user.email || 'Current user'}) does
            not have {roleLabel.toUpperCase()} privileges to view this console.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('MainTabs')}
            activeOpacity={0.85}
          >
            <ArrowLeft size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Return to Marketplace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              await signOut();
              navigation.navigate('Login');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Switch Account</Text>
          </TouchableOpacity>
        </SafeView>
      );
    }
  }

  // Authorized
  return <>{children}</>;
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deniedCircle: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: Platform.OS === 'web' ? 'Syne, sans-serif' : undefined,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 380,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
