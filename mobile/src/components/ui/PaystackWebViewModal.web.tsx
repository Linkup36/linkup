import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeView } from './SafeView';
import { X, Lock, ShieldCheck } from 'lucide-react-native';
import { ENV } from '../../config/env';

export interface PaystackWebViewModalProps {
  visible: boolean;
  email: string;
  amount: number;
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
}

export function PaystackWebViewModal({
  visible,
  email,
  amount,
  reference,
  metadata,
  onSuccess,
  onCancel,
}: PaystackWebViewModalProps) {
  const [loading, setLoading] = useState(true);

  const txRef = reference || `LKP_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const amountInKobo = Math.round(amount * 100);

  const paystackHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Linkup Paystack Checkout</title>
      <script src="https://js.paystack.co/v1/inline.js"></script>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      </style>
    </head>
    <body>
      <script>
        function payWithPaystack() {
          var handler = PaystackPop.setup({
            key: '${ENV.PAYSTACK_PUBLIC_KEY}',
            email: '${email}',
            amount: ${amountInKobo},
            ref: '${txRef}',
            metadata: ${JSON.stringify(metadata || {})},
            callback: function(response) {
              window.parent.postMessage(JSON.stringify({
                status: 'success',
                reference: response.reference
              }), '*');
            },
            onClose: function() {
              window.parent.postMessage(JSON.stringify({
                status: 'cancelled'
              }), '*');
            }
          });
          handler.openIframe();
        }
        window.onload = payWithPaystack;
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    if (!visible) return;

    const handleWebMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.status === 'success' && data?.reference) {
          onSuccess(data.reference);
        } else if (data?.status === 'cancelled') {
          onCancel();
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWebMessage);
    return () => {
      window.removeEventListener('message', handleWebMessage);
    };
  }, [visible, onSuccess, onCancel]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <SafeView style={styles.safeContainer}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Lock size={15} color="#16a34a" />
            <Text style={styles.headerTitle}>Paystack Secure Checkout</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <X size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Security Trust Banner */}
        <View style={styles.trustBanner}>
          <ShieldCheck size={14} color="#4338ca" />
          <Text style={styles.trustBannerText}>
            256-Bit Encrypted Payment • ₦{amount.toLocaleString('en-NG')}
          </Text>
        </View>

        {/* Web Iframe */}
        <View style={styles.webviewContainer}>
          <iframe
            srcDoc={paystackHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#f8fafc',
            }}
            onLoad={() => setLoading(false)}
            title="Paystack Checkout"
          />
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#EB7D30" />
              <Text style={styles.loadingText}>Initializing Paystack Secure Gateway...</Text>
            </View>
          )}
        </View>
      </SafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingVertical: 8,
  },
  trustBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});

