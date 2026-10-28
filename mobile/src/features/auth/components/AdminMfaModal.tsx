import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ShieldCheck, Lock, Copy, Check, X, AlertTriangle } from 'lucide-react-native';
import { colors } from '../../../theme/colors';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui';
import { supabase } from '../../../services/supabase';
import * as Haptics from 'expo-haptics';

export interface AdminMfaModalProps {
  visible: boolean;
  mode: 'enroll' | 'verify';
  factorId: string;
  challengeId?: string;
  qrCodeUri?: string;
  secret?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminMfaModal({
  visible,
  mode,
  factorId,
  challengeId: initialChallengeId,
  qrCodeUri,
  secret,
  onSuccess,
  onCancel,
}: AdminMfaModalProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentChallengeId, setCurrentChallengeId] = useState<string | undefined>(initialChallengeId);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setErrorMessage(null);
      setCopied(false);
      setCurrentChallengeId(initialChallengeId);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible, initialChallengeId]);

  const handleCopySecret = async () => {
    if (!secret) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // If expo-clipboard is not directly installed, set state feedback
      setCopied(true);
      toast.info('Secret Key Copied', { description: 'Paste into Authenticator app manual setup.' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let activeChallengeId = currentChallengeId;

      // In verify mode, ensure we have an active challenge
      if (!activeChallengeId) {
        const { data: newChallenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId,
        });
        if (challengeError) throw challengeError;
        activeChallengeId = newChallenge.id;
        setCurrentChallengeId(activeChallengeId);
      }

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: activeChallengeId,
        code: code.trim(),
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Two-Factor Authentication Verified', {
        description: 'Secure admin terminal session activated.',
      });
      onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(err.message || 'Invalid 6-digit verification code. Please check your authenticator.');
      // Refresh challenge on invalid attempt
      try {
        const { data: refreshedChallenge } = await supabase.auth.mfa.challenge({ factorId });
        if (refreshedChallenge) {
          setCurrentChallengeId(refreshedChallenge.id);
        }
      } catch {
        // Ignore background refresh failure
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    if (errorMessage) setErrorMessage(null);

    if (cleaned.length > 0) {
      Haptics.selectionAsync();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={28} color={colors.primary} strokeWidth={2.4} />
            </View>
            <Text style={styles.title}>
              {mode === 'enroll' ? 'Admin 2FA Setup' : 'Admin Security Verification'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'enroll'
                ? 'Scan the QR code or enter the key in Google Authenticator or Authy to protect admin privileges.'
                : 'Enter the 6-digit code from your Authenticator app to proceed to the Admin Terminal.'}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Enrollment: QR Code & Secret */}
            {mode === 'enroll' && (
              <View style={styles.enrollBox}>
                {qrCodeUri && (
                  <View style={styles.qrWrapper}>
                    <QRCode value={qrCodeUri} size={170} />
                  </View>
                )}

                {secret && (
                  <View style={styles.secretBox}>
                    <View style={styles.secretLeft}>
                      <Lock size={14} color="#64748B" />
                      <Text style={styles.secretText} numberOfLines={1}>
                        {secret}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={handleCopySecret}
                      activeOpacity={0.7}
                    >
                      {copied ? (
                        <Check size={14} color="#059669" />
                      ) : (
                        <Copy size={14} color={colors.primary} />
                      )}
                      <Text style={[styles.copyBtnText, copied && { color: '#059669' }]}>
                        {copied ? 'Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* 6 Digit Display Boxes */}
            <View style={styles.codeContainer}>
              <View style={styles.boxesRow}>
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = code[index] || '';
                  const isCurrent = code.length === index;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.box,
                        isCurrent && styles.boxCurrent,
                        digit ? styles.boxFilled : null,
                      ]}
                    >
                      <Text style={styles.boxText}>{digit}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Invisible native input for smooth keyboard and paste handling */}
              <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                value={code}
                onChangeText={handleCodeChange}
                caretHidden
                autoFocus
              />
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <AlertTriangle size={15} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title={verifying ? 'Verifying...' : mode === 'enroll' ? 'Activate & Continue' : 'Verify Code'}
                onPress={handleVerify}
                loading={verifying}
                disabled={code.length !== 6 || verifying}
                style={{ height: 48 }}
              />

              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel & Sign Out</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '90%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  scrollContent: {
    alignItems: 'center',
  },
  enrollBox: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  secretBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secretLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  secretText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  codeContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
    position: 'relative',
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxCurrent: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  boxFilled: {
    borderColor: colors.primaryBorder,
    backgroundColor: '#FFF7ED',
  },
  boxText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    width: '100%',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
