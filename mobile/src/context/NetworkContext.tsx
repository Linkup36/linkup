import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  isOffline: boolean;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown',
  isOffline: false,
  checkConnection: async () => true,
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networkState, setNetworkState] = useState<{
    isConnected: boolean;
    isInternetReachable: boolean | null;
    connectionType: string;
    isOffline: boolean;
  }>({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
    isOffline: false,
  });

  const updateFromState = useCallback((state: NetInfoState) => {
    const isConnected = state.isConnected ?? true;
    const isInternetReachable = state.isInternetReachable;
    // Consider offline only when explicitly not connected, or when reachable is false
    const isOffline = isConnected === false || isInternetReachable === false;

    setNetworkState({
      isConnected,
      isInternetReachable,
      connectionType: state.type,
      isOffline,
    });

    return !isOffline;
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      return updateFromState(state);
    } catch {
      return false;
    }
  }, [updateFromState]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      updateFromState(state);
    });

    // Initial check
    checkConnection();

    return () => {
      unsubscribe();
    };
  }, [checkConnection, updateFromState]);

  return (
    <NetworkContext.Provider
      value={{
        ...networkState,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
