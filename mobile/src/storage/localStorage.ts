import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * High-security key-value storage for access tokens, refresh tokens, and PII.
 * Falls back safely to AsyncStorage on web/unsupported runtimes.
 */
export const SecureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Error reading key "${key}":`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.warn(`[SecureStore] Error writing key "${key}":`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStore] Error deleting key "${key}":`, error);
    }
  },
};

/**
 * Standard persistent storage for app preferences, draft carts, and query caches.
 */
export const LocalStorage = {
  async getItem<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value != null ? (JSON.parse(value) as T) : defaultValue;
    } catch (error) {
      console.error(`[LocalStorage] Error parsing "${key}":`, error);
      return defaultValue;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const json = JSON.stringify(value);
      await AsyncStorage.setItem(key, json);
    } catch (error) {
      console.error(`[LocalStorage] Error serializing "${key}":`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[LocalStorage] Error removing "${key}":`, error);
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('[LocalStorage] Error clearing storage:', error);
    }
  },
};

/**
 * TanStack React Query Client persister adapter for offline caching.
 */
export const queryStoragePersister = {
  getItem: async (key: string): Promise<string | null> => {
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    return AsyncStorage.removeItem(key);
  },
};
