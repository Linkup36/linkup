import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  timestamp?: number;
  address?: string;
  district?: string;
  city?: string;
}

export function useGeolocation() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize position from user profile coordinates if available
  const [position, setPosition] = useState<GeoPosition | null>(() => {
    if (profile?.latitude && profile?.longitude) {
      return {
        latitude: profile.latitude,
        longitude: profile.longitude,
        timestamp: Date.now(),
      };
    }
    return null;
  });

  // Sync if profile coordinates become available after initial auth load
  useEffect(() => {
    if (profile?.latitude && profile?.longitude && !position) {
      setPosition({
        latitude: profile.latitude,
        longitude: profile.longitude,
        timestamp: Date.now(),
      });
    }
  }, [profile?.latitude, profile?.longitude]);

  const hasRequestedRef = useRef(false);

  const getPreciseLocation = useCallback(
    async (force = false): Promise<GeoPosition | null> => {
      if (position && !force) return position;

      setLoading(true);
      setError(null);

      try {
        // 1. Verify device location services
        const isServicesEnabled = await Location.hasServicesEnabledAsync();
        if (!isServicesEnabled) {
          setLoading(false);
          setError('Location services disabled on device');
          return position;
        }

        // 2. Check permissions
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }

        if (status !== 'granted') {
          setLoading(false);
          setError('Location permission denied');
          return position;
        }

        // 3. Fast resolution: get cached/last known position first
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown?.coords) {
            const quickPos: GeoPosition = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              timestamp: Date.now(),
            };
            setPosition((prev) => prev || quickPos);
          }
        } catch {
          // ignore last-known error
        }

        // 4. Acquire precise balanced GPS position
        let loc: Location.LocationObject | null = null;
        try {
          loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('GPS timeout')), 7000)
            ),
          ]);
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }

        if (!loc?.coords) {
          setLoading(false);
          setError('Could not acquire GPS coordinates');
          return position;
        }

        const coords: GeoPosition = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: Date.now(),
        };

        // Try reverse geocoding
        try {
          const geoRes = await Location.reverseGeocodeAsync({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          if (geoRes && geoRes.length > 0) {
            const first = geoRes[0];
            coords.district = first.district || first.subregion || undefined;
            coords.city = first.city || first.region || undefined;
            coords.address = [first.name, first.street, first.district, first.city]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          // reverse geocode optional
        }

        setPosition(coords);
        setLoading(false);

        // Update profile in Supabase if logged in
        if (user) {
          try {
            await supabase
              .from('profiles')
              .update({
                latitude: coords.latitude,
                longitude: coords.longitude,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id);
            refreshProfile();
          } catch (profileErr) {
            console.warn('[useGeolocation] Profile coordinates update:', profileErr);
          }
        }

        return coords;
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || 'Unable to detect location');
        return position;
      }
    },
    [user, position, refreshProfile]
  );

  useEffect(() => {
    // Run initial GPS check once on mount if no position exists yet
    if (!hasRequestedRef.current && !position) {
      hasRequestedRef.current = true;
      getPreciseLocation();
    }
  }, [position, getPreciseLocation]);

  return {
    position,
    loading,
    error,
    refresh: () => getPreciseLocation(true),
    setPosition,
  };
}
