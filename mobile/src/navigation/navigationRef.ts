import { createNavigationContainerRef } from '@react-navigation/core';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Helper to navigate safely from outside React components
 */
export function navigateSafely(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  } else {
    // Retry once if navigator is still mounting
    setTimeout(() => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate(name, params);
      }
    }, 400);
  }
}
