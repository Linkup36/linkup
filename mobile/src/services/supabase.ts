import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

/**
 * Mobile-optimized Supabase client configured with persistent AsyncStorage,
 * auto session refresh, and URL polyfills for React Native WebSockets.
 */
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disabled for native mobile deep-linking flows
  },
});

/**
 * Helper to fetch a fresh JWT access token for authenticating Supabase Edge Functions.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      if (error && (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token'))) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      return null;
    }
    return data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Generic API invocation helper for Supabase Edge Functions with automatic auth header injection.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  payload: Record<string, any> = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const token = await getFreshAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${ENV.SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    if (!response.ok) {
      return { data: null, error: new Error(responseData?.message || 'Edge function call failed') };
    }
    return { data: responseData as T, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}
