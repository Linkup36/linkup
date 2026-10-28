import Constants from 'expo-constants';

/**
 * Mobile Environment Configuration
 * Fallback values are initialized with workspace project constants,
 * with overrides possible via Expo extra config or environment variables.
 */
export const ENV = {
  SUPABASE_URL:
    Constants.expoConfig?.extra?.supabaseUrl ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://dahuvbojcmcylpsryyoe.supabase.co',
  SUPABASE_ANON_KEY:
    Constants.expoConfig?.extra?.supabaseAnonKey ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaHV2Ym9qY21jeWxwc3J5eW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTU4NDYsImV4cCI6MjEwNjE5MTg0Nn0.cWZYYDyz7rPHxAv-6ah6lkkV4cYIBEV4Q0BoKwHOrsA',
  PAYSTACK_PUBLIC_KEY:
    Constants.expoConfig?.extra?.paystackPublicKey ||
    process.env.EXPO_PUBLIC_PAYSTACK_KEY ||
    // Live: 'pk_live_ea79f4c81626c5e236ca77b6c9a4842b3b81f472'
    'pk_test_9bf3e402d2a1b31736d57b7dc6ff8eb841c5f5cc',
  POSTHOG_KEY:
    Constants.expoConfig?.extra?.posthogKey ||
    process.env.EXPO_PUBLIC_POSTHOG_KEY ||
    'phc_uj7J8cTkdJAGbV8VEWLxtDNFRxbLcFfrqjqniXfPJ4XN',
  POSTHOG_HOST: 'https://us.i.posthog.com',
  POSTHOG_SHARED_DASHBOARD_URL:
    Constants.expoConfig?.extra?.posthogSharedDashboardUrl ||
    process.env.EXPO_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL ||
    'https://us.posthog.com/shared/BjHHToXCCkaJzue7fgJqrRnIzcZ1JQ',
  APP_SCHEME: 'linkup://',
};
