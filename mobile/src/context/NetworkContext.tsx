import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOnline: boolean;
  wasOffline: boolean;
  isChecking: boolean;
  lastChangedAt: number | null;
  connectionType: string;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
  wasOffline: false,
  isChecking: false,
  lastChangedAt: null,
  connectionType: 'unknown',
  checkConnection: async () => true,
});

export const useNetwork = () => useContext(NetworkContext);
export const useNetworkStatus = () => useContext(NetworkContext);

function isStateOnline(state: NetInfoState): boolean {
  // Treat null isInternetReachable as online while reachability probe settles on startup
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  const isInitialMount = useRef(true);
  const prevOnlineRef = useRef(true);
  const wasOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyNetInfoState = useCallback((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    const reachable = state.isInternetReachable ?? connected;
    const nextOnline = isStateOnline(state);

    setIsConnected(connected);
    setIsInternetReachable(reachable);
    setConnectionType(state.type);
    onlineManager.setOnline(nextOnline);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevOnlineRef.current = nextOnline;
      setIsOnline(nextOnline);
      if (!nextOnline) {
        setLastChangedAt(Date.now());
      }
      return;
    }

    if (nextOnline !== prevOnlineRef.current) {
      const wasPreviouslyOnline = prevOnlineRef.current;
      prevOnlineRef.current = nextOnline;
      setIsOnline(nextOnline);
      setLastChangedAt(Date.now());

      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current);
        wasOfflineTimerRef.current = null;
      }

      if (!nextOnline && wasPreviouslyOnline) {
        setWasOffline(true);
      } else if (nextOnline && !wasPreviouslyOnline) {
        setWasOffline(true);
        wasOfflineTimerRef.current = setTimeout(() => {
          setWasOffline(false);
          wasOfflineTimerRef.current = null;
        }, 5000);
      }
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const state = await NetInfo.fetch();
      applyNetInfoState(state);
      return isStateOnline(state);
    } catch {
      return prevOnlineRef.current;
    } finally {
      setIsChecking(false);
    }
  }, [applyNetInfoState]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyNetInfoState);

    NetInfo.fetch().then(applyNetInfoState);

    return () => {
      unsubscribe();
      if (wasOfflineTimerRef.current) {
        clearTimeout(wasOfflineTimerRef.current);
      }
    };
  }, [applyNetInfoState]);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        isOnline,
        wasOffline,
        isChecking,
        lastChangedAt,
        connectionType,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
