import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { supabase } from '../../../services/supabase';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../../theme/colors';
import * as Haptics from 'expo-haptics';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialEmail = route.params?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!email.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Required Field', 'Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'linkup://reset-password',
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Check Your Email',
        'Password reset instructions have been sent to your email address.',
        [{ text: 'Return to Sign In', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Reset Failed', err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Reset Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Brand Logo & Header */}
            <View style={styles.brandContainer}>
              <BrandLogo size="md" style={styles.brandLogo} />
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your registered email address and we'll send you instructions to reset your account password.
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color="#64748b" />
              <TextInput
                placeholder="name@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Button
              title="Send Reset Link"
              onPress={handleResetPassword}
              loading={loading}
              style={{ marginTop: 24 }}
            />

            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.returnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  keyboardContainer: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 290,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  returnBtn: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  returnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
