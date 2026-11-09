import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react-native';
import { colors } from '../../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ModalVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface AppModalButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'secondary' | 'outline';
}

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  variant?: ModalVariant;
  icon?: React.ReactNode | React.ComponentType<any>;
  children?: React.ReactNode;
  primaryButton?: AppModalButtonProps;
  secondaryButton?: AppModalButtonProps;
  closeOnBackdropPress?: boolean;
  showCloseButton?: boolean;
  maxHeight?: number | string;
  avoidKeyboard?: boolean;
  noPadding?: boolean;
}

export function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  variant = 'default',
  icon,
  children,
  primaryButton,
  secondaryButton,
  closeOnBackdropPress = true,
  showCloseButton = true,
  maxHeight = SCREEN_HEIGHT * 0.85,
  avoidKeyboard = true,
  noPadding = false,
}: AppModalProps) {
  // Render status badge icon based on variant if no custom icon passed
  const renderStatusIcon = () => {
    if (icon) {
      if (React.isValidElement(icon)) return icon;
      if (
        typeof icon === 'function' ||
        (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
      ) {
        const IconComponent = icon as any;
        return (
          <View style={[styles.variantBadge, { backgroundColor: '#f8fafc' }]}>
            <IconComponent size={24} color={colors.primary} strokeWidth={2.4} />
          </View>
        );
      }
      return null;
    }

    switch (variant) {
      case 'success':
        return (
          <View style={[styles.variantBadge, { backgroundColor: '#f0fdf4' }]}>
            <CheckCircle2 size={24} color={colors.success} strokeWidth={2.4} />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.variantBadge, { backgroundColor: '#fffbeb' }]}>
            <AlertTriangle size={24} color="#f59e0b" strokeWidth={2.4} />
          </View>
        );
      case 'danger':
        return (
          <View style={[styles.variantBadge, { backgroundColor: '#fef2f2' }]}>
            <AlertCircle size={24} color={colors.danger} strokeWidth={2.4} />
          </View>
        );
      case 'info':
        return (
          <View style={[styles.variantBadge, { backgroundColor: '#eff6ff' }]}>
            <Info size={24} color={colors.info} strokeWidth={2.4} />
          </View>
        );
      default:
        return null;
    }
  };

  const content = (
    <View style={styles.backdrop}>
      {/* Backdrop touchable to close */}
      <TouchableWithoutFeedback onPress={closeOnBackdropPress ? onClose : undefined}>
        <View style={styles.backdropOverlay} />
      </TouchableWithoutFeedback>

      {/* Modal Card */}
      <View
        style={[
          styles.modalCard,
          { maxHeight },
          noPadding && { paddingHorizontal: 0, paddingTop: 0, overflow: 'hidden' },
        ]}
      >
        {/* Top Handle for bottom-sheet feel */}
        {!noPadding && <View style={styles.dragHandle} />}

        {/* Header */}
        {(title || subtitle || showCloseButton || variant !== 'default' || icon) && (
          <View style={styles.header}>
            <View style={styles.headerContent}>
              {renderStatusIcon()}
              <View style={styles.titleWrap}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            </View>

            {showCloseButton && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#64748b" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Scrollable Body */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.bodyContent, noPadding && { paddingBottom: 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* Footer Actions */}
        {(primaryButton || secondaryButton) && (
          <View style={styles.footer}>
            {secondaryButton && (
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnSecondary,
                  secondaryButton.disabled && styles.btnDisabled,
                ]}
                onPress={secondaryButton.onPress}
                disabled={secondaryButton.disabled || secondaryButton.loading}
                activeOpacity={0.75}
              >
                {secondaryButton.loading ? (
                  <ActivityIndicator size="small" color="#64748b" />
                ) : (
                  <Text style={styles.btnSecondaryText}>{secondaryButton.label}</Text>
                )}
              </TouchableOpacity>
            )}

            {primaryButton && (
              <TouchableOpacity
                style={[
                  styles.btn,
                  primaryButton.variant === 'danger'
                    ? styles.btnDanger
                    : styles.btnPrimary,
                  primaryButton.disabled && styles.btnDisabled,
                ]}
                onPress={primaryButton.onPress}
                disabled={primaryButton.disabled || primaryButton.loading}
                activeOpacity={0.8}
              >
                {primaryButton.loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text
                    style={[
                      styles.btnPrimaryText,
                      primaryButton.variant === 'danger' && { color: '#ffffff' },
                    ]}
                  >
                    {primaryButton.label}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // Deep dark overlay with smooth backdrop feel
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    width: '100%',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  variantBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bodyContent: {
    paddingVertical: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 6,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimary: {
    backgroundColor: colors.primary, // Linkup Orange #EB7D30
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDanger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
});
