import { useQuery } from '@tanstack/react-query';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RoadRouteResult {
  distanceKm: number;
  durationMinutes: number;
  estimatedMinutesRange: string;
  coordinates: LatLng[];
  isRoadMatched: boolean;
  engine?: 'osrm' | 'haversine';
}

/**
 * Haversine distance calculator in KM
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0;
  if (lat1 === lat2 && lon1 === lon2) return 1.0;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(R * c * 10) / 10);
}

/**
 * Calculates the real road driving route, true distance in KM, realistic ETA,
 * and turn-by-turn road polyline using OSRM with haversine fallback.
 */
export async function fetchRoadRoute(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): Promise<RoadRouteResult> {
  // If points are identical
  if (pickupLat === dropoffLat && pickupLng === dropoffLng) {
    return {
      distanceKm: 1.0,
      durationMinutes: 15,
      estimatedMinutesRange: '15 - 25 mins',
      coordinates: [{ latitude: pickupLat, longitude: pickupLng }],
      isRoadMatched: true,
      engine: 'osrm',
    };
  }

  // 1. Try OSRM (Open Source Routing Machine)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    // OSRM expects coordinates in lng,lat order
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`OSRM routing failed: ${res.statusText}`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance;
      const durationSeconds = primaryRoute.duration;

      // Exact road distance in KM rounded to 1 decimal place
      const distanceKm = Math.max(1.0, Math.round((distanceMeters / 1000) * 10) / 10);

      // Duration in minutes
      const baseMinutes = Math.round(durationSeconds / 60);
      const minMins = Math.max(15, baseMinutes + 5);
      const maxMins = minMins + 20;

      // GeoJSON coordinates are [lng, lat] -> convert to { latitude, longitude } for react-native-maps
      const coordinates: LatLng[] = (primaryRoute.geometry.coordinates || []).map(
        ([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        })
      );

      return {
        distanceKm,
        durationMinutes: baseMinutes,
        estimatedMinutesRange: `${minMins} - ${maxMins} mins`,
        coordinates:
          coordinates.length > 0
            ? coordinates
            : [
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: dropoffLat, longitude: dropoffLng },
              ],
        isRoadMatched: true,
        engine: 'osrm',
      };
    }

    throw new Error('No valid road route found');
  } catch (err) {
    // Fallback: Haversine distance with 1.25x road tortuosity factor for real-world road networks
    const rawHaversine = calculateHaversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const roadEstimatedKm = Math.max(1.0, Math.round(rawHaversine * 1.25 * 10) / 10);
    const minMins = Math.round(15 + roadEstimatedKm * 2.5);
    const maxMins = minMins + 20;

    return {
      distanceKm: roadEstimatedKm,
      durationMinutes: Math.round(roadEstimatedKm * 3),
      estimatedMinutesRange: `${minMins} - ${maxMins} mins`,
      coordinates: [
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: dropoffLat, longitude: dropoffLng },
      ],
      isRoadMatched: false,
      engine: 'haversine',
    };
  }
}

/**
 * React Query hook for fetching and caching real road routes
 */
export function useRoadRoute(
  pickupLat?: number | null,
  pickupLng?: number | null,
  dropoffLat?: number | null,
  dropoffLng?: number | null
) {
  const hasBothCoords =
    typeof pickupLat === 'number' &&
    typeof pickupLng === 'number' &&
    typeof dropoffLat === 'number' &&
    typeof dropoffLng === 'number';

  return useQuery({
    queryKey: ['road_route', pickupLat, pickupLng, dropoffLat, dropoffLng],
    queryFn: () => fetchRoadRoute(pickupLat!, pickupLng!, dropoffLat!, dropoffLng!),
    enabled: hasBothCoords,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
