import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { SafeView } from './SafeView';
import { X, Lock, ShieldCheck } from 'lucide-react-native';
import { ENV } from '../../config/env';

export interface PaystackWebViewModalProps {
  visible: boolean;
  email: string;
  amount: number; // in Naira (e.g., 5000 for ₦5,000)
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
  const webViewRef = useRef<WebView>(null);

  // Generate unique transaction reference if none passed
  const txRef = reference || `LKP_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const amountInKobo = Math.round(amount * 100);

  // Paystack Inline HTML template
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
        .loader {
          text-align: center;
          color: #EB7D30;
        }
      </style>
    </head>
    <body>
      <div class="loader">
        <p>Connecting to secure payment gateway...</p>
      </div>

      <script>
        function payWithPaystack() {
          var handler = PaystackPop.setup({
            key: '${ENV.PAYSTACK_PUBLIC_KEY}',
            email: '${email}',
            amount: ${amountInKobo},
            currency: 'NGN',
            ref: '${txRef}',
            metadata: ${JSON.stringify(metadata || {})},
            callback: function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'success',
                reference: response.reference
              }));
            },
            onClose: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'cancelled'
              }));
            }
          });
          handler.openIframe();
        }
        window.onload = payWithPaystack;
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'success') {
        onSuccess(data.reference);
      } else {
        onCancel();
      }
    } catch (e) {
      console.warn('[PaystackModal] Failed to parse message', e);
    }
  };

  const handleNavigationStateChange = (state: WebViewNavigation) => {
    const { url } = state;
    if (url.includes('standard.paystack.co/close') || url.includes('linkup-cancel')) {
      onCancel();
    } else if (url.includes('trxref=') || url.includes('reference=')) {
      const match = url.match(/[?&](trxref|reference)=([^&]+)/);
      if (match && match[2]) {
        onSuccess(match[2]);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeView backgroundColor="#FDFEFE">
        {/* Modal Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Lock size={15} color="#16a34a" />
            <Text style={styles.headerTitle}>Paystack Secure Checkout</Text>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Security Trust Banner */}
        <View style={styles.trustBanner}>
          <ShieldCheck size={14} color="#4338ca" />
          <Text style={styles.trustBannerText}>
            256-Bit Encrypted Payment • ₦{amount.toLocaleString('en-NG')}
          </Text>
        </View>

        {/* In-App WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: paystackHtml }}
            onMessage={handleMessage}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#EB7D30" />
                <Text style={styles.loadingText}>Initializing Paystack Secure Gateway...</Text>
              </View>
            )}
            style={styles.webview}
          />
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
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
});
