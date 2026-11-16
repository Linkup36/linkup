import * as Location from 'expo-location';

export interface GeocodedSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  latitude: number;
  longitude: number;
}

/**
 * Searches Nigerian addresses using Nominatim (non-blocking, abortable)
 * with native Expo Location.geocodeAsync fallback.
 */
export async function searchAddressSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodedSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ng&limit=5&addressdetails=1&q=${encodeURIComponent(
      trimmed,
    )}`;
    const res = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LinkupMarketplaceMobile/1.0',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data
          .filter((item: any) => item.lat && item.lon)
          .map((item: any, idx: number) => {
            const parts = String(item.display_name || '')
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            const label = parts.slice(0, 3).join(', ') || item.display_name;
            const sublabel = parts.slice(3, 5).join(', ');
            return {
              id: String(item.place_id ?? idx),
              label,
              sublabel: sublabel || undefined,
              latitude: Number(item.lat),
              longitude: Number(item.lon),
            };
          });
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
  }

  // Fallback to native device geocoder if available
  try {
    const geocodeFn = (Location as any).geocodeAsync;
    if (typeof geocodeFn === 'function') {
      const results = await geocodeFn(`${trimmed}, Nigeria`);
      if (Array.isArray(results) && results.length > 0) {
        return results.slice(0, 3).map((r: any, idx: number) => ({
          id: `native-${idx}`,
          label: trimmed,
          sublabel: `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
        }));
      }
    }
  } catch {
    // Ignore native geocoder errors (e.g. web or offline)
  }

  return [];
}

/**
 * Resolves a free-text address into { latitude, longitude } if possible.
 */
export async function geocodeAddressText(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const results = await searchAddressSuggestions(address);
  if (results.length > 0) {
    return {
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  }
  return null;
}

