import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';
import { navigateSafely } from '../navigation/navigationRef';

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
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  return data.session.access_token;
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

/**
 * Parses and handles authentication deep links (email confirmation, password resets, PKCE codes)
 * ensuring seamless one-tap sign in when the user taps links in emails.
 */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const isRecovery =
      url.includes('type=recovery') ||
      url.includes('reset-password');

    // 1. Check for tokens in hash fragment (#access_token=...&refresh_token=...)
    if (url.includes('#')) {
      const hashPart = url.split('#')[1];
      const params = new URLSearchParams(hashPart);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          if (isRecovery) {
            navigateSafely('ResetPassword');
          }
          return true;
        }
      }
    }

    // 2. Check for PKCE exchange code (?code=...)
    if (url.includes('code=')) {
      const cleanUrl = url.replace('#', '?');
      const urlObj = new URL(cleanUrl);
      const code = urlObj.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          if (isRecovery) {
            navigateSafely('ResetPassword');
          }
          return true;
        }
      }
    }

    // 3. Fallback: If URL just directs to reset-password scheme
    if (isRecovery) {
      navigateSafely('ResetPassword');
      return true;
    }
  } catch (err) {
    console.warn('[supabase] Error processing auth deep link:', err);
  }
  return false;
}
