import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();

// Intercept unhandled JS errors at runtime to prevent Android OS process crashes
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('[GlobalErrorTrap] Intercepted runtime error:', error, 'isFatal:', isFatal);
    if (__DEV__ && previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { RootNavigator } from './src/navigation/RootNavigator';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Caught app crash:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <StatusBar style="dark" />
          <Text style={errorStyles.title}>Linkup Marketplace</Text>
          <Text style={errorStyles.sub}>Something went wrong while starting the application.</Text>
          <ScrollView style={errorStyles.errorBox}>
            <Text style={errorStyles.errorText}>{this.state.error?.toString() || 'Unknown error'}</Text>
          </ScrollView>
          <TouchableOpacity style={errorStyles.btn} onPress={this.handleRestart}>
            <Text style={errorStyles.btnText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBox: {
    maxHeight: 180,
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <RootErrorBoundary>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <NetworkProvider>
            <AuthProvider>
              <CartProvider>
                <StatusBar style="light" />
                <RootNavigator />
              </CartProvider>
            </AuthProvider>
          </NetworkProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}
