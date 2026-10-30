import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductItem } from '../components/ui/ProductCard';

const CACHE_PREFIX_FEED = '@linkup_cache_feed_';
const CACHE_PREFIX_DETAIL = '@linkup_cache_detail_';
const CACHE_KEY_METADATA = '@linkup_cache_meta';

// Freshness thresholds
const DEFAULT_FEED_TTL = 1000 * 60 * 5; // 5 minutes fresh
const DEFAULT_DETAIL_TTL = 1000 * 60 * 15; // 15 minutes fresh

export interface FeedCacheEnvelope {
  products: ProductItem[];
  hasMore: boolean;
  page: number;
  timestamp: number;
}

export interface DetailCacheEnvelope {
  product: any;
  timestamp: number;
}

export interface MetadataCacheEnvelope {
  categories: any[];
  zones: any[];
  markupRate: number;
  timestamp: number;
}

export const productCache = {
  /**
   * Retrieves the cached product feed for a given category & zone.
   * Returns data immediately with an `isStale` flag so SWR can revalidate in background.
   */
  async getFeed(
    category = 'All Products',
    zone = 'All Zones'
  ): Promise<{
    products: ProductItem[];
    hasMore: boolean;
    page: number;
    isStale: boolean;
  } | null> {
    try {
      const sanitizedKey = `${category}_${zone}`.replace(/\s+/g, '_').toLowerCase();
      const key = `${CACHE_PREFIX_FEED}${sanitizedKey}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      const parsed: FeedCacheEnvelope = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.products)) return null;

      const isStale = Date.now() - parsed.timestamp > DEFAULT_FEED_TTL;
      return {
        products: parsed.products,
        hasMore: parsed.hasMore ?? false,
        page: parsed.page ?? 0,
        isStale,
      };
    } catch (e) {
      console.warn('[productCache] Error reading feed cache:', e);
      return null;
    }
  },

  /**
   * Caches product list for offline/instant render and indexes each individual
   * product into the detail cache for instantaneous ProductDetailScreen viewing.
   */
  async setFeed(
    category = 'All Products',
    zone = 'All Zones',
    products: ProductItem[],
    hasMore: boolean,
    page: number
  ): Promise<void> {
    try {
      const sanitizedKey = `${category}_${zone}`.replace(/\s+/g, '_').toLowerCase();
      const key = `${CACHE_PREFIX_FEED}${sanitizedKey}`;
      const envelope: FeedCacheEnvelope = {
        products,
        hasMore,
        page,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(envelope));

      // Batch-index individual products into the detail cache
      if (products.length > 0) {
        const pairs: [string, string][] = products.slice(0, 50).map((p) => [
          `${CACHE_PREFIX_DETAIL}${p.id}`,
          JSON.stringify({ product: p, timestamp: Date.now() }),
        ]);
        await AsyncStorage.multiSet(pairs);
      }
    } catch (e) {
      console.warn('[productCache] Error writing feed cache:', e);
    }
  },

  /**
   * Retrieves an individual cached product detail.
   */
  async getDetail(id: string): Promise<{ product: any; isStale: boolean } | null> {
    try {
      if (!id) return null;
      const key = `${CACHE_PREFIX_DETAIL}${id}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      const parsed: DetailCacheEnvelope = JSON.parse(raw);
      if (!parsed || !parsed.product) return null;

      const isStale = Date.now() - parsed.timestamp > DEFAULT_DETAIL_TTL;
      return {
        product: parsed.product,
        isStale,
      };
    } catch (e) {
      console.warn('[productCache] Error reading detail cache:', e);
      return null;
    }
  },

  /**
   * Stores an individual product detail with full properties.
   */
  async setDetail(id: string, product: any): Promise<void> {
    try {
      if (!id || !product) return;
      const key = `${CACHE_PREFIX_DETAIL}${id}`;
      const envelope: DetailCacheEnvelope = {
        product,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[productCache] Error writing detail cache:', e);
    }
  },

  /**
   * Retrieves cached categories, zones, and markup rate metadata.
   */
  async getMetadata(): Promise<MetadataCacheEnvelope | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY_METADATA);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Stores categories, zones, and markup rate metadata.
   */
  async setMetadata(metadata: { categories: any[]; zones: any[]; markupRate: number }): Promise<void> {
    try {
      const envelope: MetadataCacheEnvelope = {
        ...metadata,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY_METADATA, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[productCache] Error writing metadata cache:', e);
    }
  },

  /**
   * Clears all marketplace product caches.
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const productKeys = keys.filter(
        (k) =>
          k.startsWith(CACHE_PREFIX_FEED) ||
          k.startsWith(CACHE_PREFIX_DETAIL) ||
          k === CACHE_KEY_METADATA
      );
      if (productKeys.length > 0) {
        await AsyncStorage.multiRemove(productKeys);
      }
    } catch (e) {
      console.warn('[productCache] Error clearing product cache:', e);
    }
  },
};
