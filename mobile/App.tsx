import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuth } from './src/context/AuthContext';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { GlobalNotificationListener } from './src/services/GlobalNotificationListener';

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
    <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <AuthProvider>
            <GlobalNotificationListener />
            <CartProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </CartProvider>
          </AuthProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
