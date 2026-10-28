import { useState } from 'react';
import * as Location from 'expo-location';
import { toast } from '../../../components/ui/GooeyToast';

export interface DetectedLocation {
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
}

export function useLocationDetector() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = async (): Promise<DetectedLocation | null> => {
    setIsDetecting(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Location permission is required to detect your location.';
        setError(msg);
        toast.error(msg);
        setIsDetecting(false);
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode with Nominatim for Nigerian details
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          const displayName = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.suburb ||
            data.address?.state ||
            '';

          toast.success('Location detected successfully');
          setIsDetecting(false);
          return {
            address: displayName,
            latitude,
            longitude,
            city,
          };
        }
      } catch (geocodeErr) {
        console.warn('Reverse geocode fallback:', geocodeErr);
      }

      // Native reverse geocode fallback
      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          const parts = [item.name, item.street, item.district, item.city, item.region].filter(
            Boolean
          );
          const address = parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

          toast.success('Location detected successfully');
          setIsDetecting(false);
          return {
            address,
            latitude,
            longitude,
            city: item.city || item.region || undefined,
          };
        }
      } catch (nativeErr) {
        console.warn('Native reverseGeocode error:', nativeErr);
      }

      toast.success('GPS coordinates retrieved');
      setIsDetecting(false);
      return {
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        latitude,
        longitude,
      };
    } catch (err: any) {
      console.error('Location detection error:', err);
      const msg = err.message || 'Unable to detect location. Please check your device GPS.';
      setError(msg);
      toast.error(msg);
      setIsDetecting(false);
      return null;
    }
  };

  return {
    isDetecting,
    error,
    detectLocation,
  };
}
