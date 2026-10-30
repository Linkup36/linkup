import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_OVERVIEW_PREFIX = '@linkup_logistics_overview_';
const CACHE_KEY_EARNINGS_PREFIX = '@linkup_logistics_earnings_';
const CACHE_KEY_FEED_PREFIX = '@linkup_logistics_feed_';
const CACHE_KEY_METADATA = '@linkup_logistics_metadata';

// Freshness thresholds (Time-To-Live in milliseconds)
const OVERVIEW_TTL = 1000 * 45; // 45 seconds fresh
const EARNINGS_TTL = 1000 * 90; // 90 seconds fresh
const FEED_TTL = 1000 * 30; // 30 seconds fresh
const METADATA_TTL = 1000 * 60 * 60; // 1 hour fresh for cities / delivery_zones / fee_config

export interface RiderOverviewData {
  balance: number;
  escrowBalance: number;
  isOnline: boolean;
  riderCityName: string;
  riderBankName: string;
  riderVehicle: string;
  activeMissions: any[];
  activeMissionCount: number;
  availableMissionCount: number;
  completedMissionCount: number;
  kycStatus: string;
}

export interface RiderEarningsData {
  balance: number;
  escrowBalance: number;
  walletId: string;
  transactions: any[];
  completedMissions: any[];
  payoutRequests: any[];
}

export interface LogisticsFeedData {
  myAssignedShipments: any[];
  broadcastMarketplace: any[];
  broadcastSendOrders: any[];
}

export interface LogisticsMetadata {
  cities: any[];
  zones: any[];
  feeConfigs?: {
    riderPayoutRate: number;
    riderMinPayout: number;
  };
}

interface Envelope<T> {
  data: T;
  timestamp: number;
}

// In-memory hot cache for instant zero-latency access during the active session
const memoryCache = new Map<string, Envelope<any>>();

export const logisticsCache = {
  // ==========================================================================
  // 1. OVERVIEW CACHE (Balances, Mission Counts, Vehicle, KYC, Online Status)
  // ==========================================================================
  async getOverview(userId: string): Promise<{ data: RiderOverviewData; isStale: boolean } | null> {
    if (!userId) return null;
    const key = `${CACHE_KEY_OVERVIEW_PREFIX}${userId}`;

    // 1. Check hot memory cache
    const mem = memoryCache.get(key);
    if (mem) {
      const isStale = Date.now() - mem.timestamp > OVERVIEW_TTL;
      return { data: mem.data, isStale };
    }

    // 2. Check persistent AsyncStorage
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed: Envelope<RiderOverviewData> = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;

      // Populate memory cache
      memoryCache.set(key, parsed);
      const isStale = Date.now() - parsed.timestamp > OVERVIEW_TTL;
      return { data: parsed.data, isStale };
    } catch (e) {
      console.warn('[logisticsCache] getOverview error:', e);
      return null;
    }
  },

  async setOverview(userId: string, data: RiderOverviewData): Promise<void> {
    if (!userId || !data) return;
    const key = `${CACHE_KEY_OVERVIEW_PREFIX}${userId}`;
    const envelope: Envelope<RiderOverviewData> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(key, envelope);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[logisticsCache] setOverview error:', e);
    }
  },

  async patchOverview(userId: string, partial: Partial<RiderOverviewData>): Promise<void> {
    if (!userId) return;
    const current = await this.getOverview(userId);
    if (current?.data) {
      await this.setOverview(userId, { ...current.data, ...partial });
    }
  },

  // ==========================================================================
  // 2. EARNINGS CACHE (Completed Missions, Transactions, Payout Requests)
  // ==========================================================================
  async getEarnings(userId: string): Promise<{ data: RiderEarningsData; isStale: boolean } | null> {
    if (!userId) return null;
    const key = `${CACHE_KEY_EARNINGS_PREFIX}${userId}`;

    const mem = memoryCache.get(key);
    if (mem) {
      const isStale = Date.now() - mem.timestamp > EARNINGS_TTL;
      return { data: mem.data, isStale };
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed: Envelope<RiderEarningsData> = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;

      memoryCache.set(key, parsed);
      const isStale = Date.now() - parsed.timestamp > EARNINGS_TTL;
      return { data: parsed.data, isStale };
    } catch (e) {
      console.warn('[logisticsCache] getEarnings error:', e);
      return null;
    }
  },

  async setEarnings(userId: string, data: RiderEarningsData): Promise<void> {
    if (!userId || !data) return;
    const key = `${CACHE_KEY_EARNINGS_PREFIX}${userId}`;
    const envelope: Envelope<RiderEarningsData> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(key, envelope);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[logisticsCache] setEarnings error:', e);
    }
  },

  // ==========================================================================
  // 3. FEED CACHE (Assigned Missions & Broadcast Orders)
  // ==========================================================================
  async getFeed(userId: string): Promise<{ data: LogisticsFeedData; isStale: boolean } | null> {
    if (!userId) return null;
    const key = `${CACHE_KEY_FEED_PREFIX}${userId}`;

    const mem = memoryCache.get(key);
    if (mem) {
      const isStale = Date.now() - mem.timestamp > FEED_TTL;
      return { data: mem.data, isStale };
    }

    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed: Envelope<LogisticsFeedData> = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;

      memoryCache.set(key, parsed);
      const isStale = Date.now() - parsed.timestamp > FEED_TTL;
      return { data: parsed.data, isStale };
    } catch (e) {
      console.warn('[logisticsCache] getFeed error:', e);
      return null;
    }
  },

  async setFeed(userId: string, data: LogisticsFeedData): Promise<void> {
    if (!userId || !data) return;
    const key = `${CACHE_KEY_FEED_PREFIX}${userId}`;
    const envelope: Envelope<LogisticsFeedData> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(key, envelope);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[logisticsCache] setFeed error:', e);
    }
  },

  // ==========================================================================
  // 4. METADATA CACHE (Cities, Delivery Zones, Fee Configs)
  // ==========================================================================
  async getMetadata(): Promise<{ data: LogisticsMetadata; isStale: boolean } | null> {
    const mem = memoryCache.get(CACHE_KEY_METADATA);
    if (mem) {
      const isStale = Date.now() - mem.timestamp > METADATA_TTL;
      return { data: mem.data, isStale };
    }

    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY_METADATA);
      if (!raw) return null;
      const parsed: Envelope<LogisticsMetadata> = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;

      memoryCache.set(CACHE_KEY_METADATA, parsed);
      const isStale = Date.now() - parsed.timestamp > METADATA_TTL;
      return { data: parsed.data, isStale };
    } catch (e) {
      console.warn('[logisticsCache] getMetadata error:', e);
      return null;
    }
  },

  async setMetadata(data: LogisticsMetadata): Promise<void> {
    const envelope: Envelope<LogisticsMetadata> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(CACHE_KEY_METADATA, envelope);
    try {
      await AsyncStorage.setItem(CACHE_KEY_METADATA, JSON.stringify(envelope));
    } catch (e) {
      console.warn('[logisticsCache] setMetadata error:', e);
    }
  },

  // ==========================================================================
  // 5. CACHE INVALIDATION / CLEAR
  // ==========================================================================
  async invalidateUser(userId: string): Promise<void> {
    if (!userId) return;
    const overviewKey = `${CACHE_KEY_OVERVIEW_PREFIX}${userId}`;
    const earningsKey = `${CACHE_KEY_EARNINGS_PREFIX}${userId}`;
    const feedKey = `${CACHE_KEY_FEED_PREFIX}${userId}`;

    memoryCache.delete(overviewKey);
    memoryCache.delete(earningsKey);
    memoryCache.delete(feedKey);

    try {
      await AsyncStorage.multiRemove([overviewKey, earningsKey, feedKey]);
    } catch (e) {
      console.warn('[logisticsCache] invalidateUser error:', e);
    }
  },

  async clearAll(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const logisticsKeys = keys.filter(
        (k) =>
          k.startsWith(CACHE_KEY_OVERVIEW_PREFIX) ||
          k.startsWith(CACHE_KEY_EARNINGS_PREFIX) ||
          k.startsWith(CACHE_KEY_FEED_PREFIX) ||
          k === CACHE_KEY_METADATA
      );
      if (logisticsKeys.length > 0) {
        await AsyncStorage.multiRemove(logisticsKeys);
      }
    } catch (e) {
      console.warn('[logisticsCache] clearAll error:', e);
    }
  },
};
