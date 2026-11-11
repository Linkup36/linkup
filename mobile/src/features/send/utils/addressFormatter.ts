/**
 * Infers the closest Nigerian city/state from latitude and longitude coordinates.
 */
export function inferNigerianCityFromCoords(lat: number, lng: number): string {
  // Lafia, Nasarawa: ~8.50, 8.53
  if (lat >= 8.2 && lat <= 8.7 && lng >= 8.2 && lng <= 8.8) return 'Lafia, Nasarawa';
  // Abuja (FCT): ~9.07, 7.40
  if (lat >= 8.8 && lat <= 9.3 && lng >= 7.0 && lng <= 7.7) return 'Abuja (FCT)';
  // Keffi, Nasarawa: ~8.84, 7.87
  if (lat >= 8.7 && lat <= 8.95 && lng >= 7.75 && lng <= 8.05) return 'Keffi, Nasarawa';
  // Jos, Plateau: ~9.89, 8.85
  if (lat >= 9.6 && lat <= 10.1 && lng >= 8.6 && lng <= 9.2) return 'Jos, Plateau';
  // Makurdi, Benue: ~7.73, 8.53
  if (lat >= 7.5 && lat <= 7.9 && lng >= 8.3 && lng <= 8.8) return 'Makurdi, Benue';
  // Lagos: ~6.52, 3.37
  if (lat >= 6.3 && lat <= 6.7 && lng >= 3.1 && lng <= 3.7) return 'Lagos';
  // Ibadan, Oyo: ~7.37, 3.94
  if (lat >= 7.2 && lat <= 7.6 && lng >= 3.7 && lng <= 4.2) return 'Ibadan, Oyo';
  // Abeokuta, Ogun: ~7.15, 3.34
  if (lat >= 7.0 && lat <= 7.3 && lng >= 3.2 && lng <= 3.6) return 'Abeokuta, Ogun';
  // Port Harcourt, Rivers: ~4.81, 7.04
  if (lat >= 4.6 && lat <= 5.1 && lng >= 6.8 && lng <= 7.3) return 'Port Harcourt, Rivers';
  // Benin City, Edo: ~6.33, 5.60
  if (lat >= 6.1 && lat <= 6.6 && lng >= 5.4 && lng <= 5.8) return 'Benin City, Edo';
  // Asaba, Delta: ~6.19, 6.73
  if (lat >= 6.1 && lat <= 6.3 && lng >= 6.6 && lng <= 6.9) return 'Asaba, Delta';
  // Warri, Delta: ~5.54, 5.75
  if (lat >= 5.4 && lat <= 5.7 && lng >= 5.6 && lng <= 5.9) return 'Warri, Delta';
  // Onitsha / Awka, Anambra: ~6.15, 6.78
  if (lat >= 6.0 && lat <= 6.35 && lng >= 6.7 && lng <= 7.2) return 'Anambra (Onitsha/Awka)';
  // Enugu, Enugu: ~6.45, 7.54
  if (lat >= 6.3 && lat <= 6.7 && lng >= 7.3 && lng <= 7.8) return 'Enugu, Enugu';
  // Owerri, Imo: ~5.48, 7.03
  if (lat >= 5.3 && lat <= 5.65 && lng >= 6.9 && lng <= 7.25) return 'Owerri, Imo';
  // Calabar, Cross River: ~4.95, 8.32
  if (lat >= 4.8 && lat <= 5.15 && lng >= 8.2 && lng <= 8.55) return 'Calabar, Cross River';
  // Uyo, Akwa Ibom: ~5.03, 7.91
  if (lat >= 4.9 && lat <= 5.2 && lng >= 7.8 && lng <= 8.1) return 'Uyo, Akwa Ibom';
  // Ilorin, Kwara: ~8.49, 4.54
  if (lat >= 8.3 && lat <= 8.7 && lng >= 4.4 && lng <= 4.8) return 'Ilorin, Kwara';
  // Minna, Niger: ~9.61, 6.55
  if (lat >= 9.4 && lat <= 9.8 && lng >= 6.3 && lng <= 6.8) return 'Minna, Niger';
  // Kaduna, Kaduna: ~10.51, 7.41
  if (lat >= 10.3 && lat <= 10.7 && lng >= 7.2 && lng <= 7.7) return 'Kaduna, Kaduna';
  // Kano, Kano: ~12.00, 8.59
  if (lat >= 11.8 && lat <= 12.2 && lng >= 8.4 && lng <= 8.8) return 'Kano, Kano';
  // Sokoto: ~13.06, 5.23
  if (lat >= 12.9 && lat <= 13.2 && lng >= 5.1 && lng <= 5.4) return 'Sokoto';
  // Katsina: ~12.98, 7.60
  if (lat >= 12.8 && lat <= 13.1 && lng >= 7.5 && lng <= 7.8) return 'Katsina';
  // Bauchi: ~10.31, 9.84
  if (lat >= 10.1 && lat <= 10.5 && lng >= 9.6 && lng <= 10.1) return 'Bauchi';
  // Gombe: ~10.28, 11.16
  if (lat >= 10.1 && lat <= 10.4 && lng >= 11.0 && lng <= 11.4) return 'Gombe';
  // Yola, Adamawa: ~9.20, 12.48
  if (lat >= 9.1 && lat <= 9.4 && lng >= 12.3 && lng <= 12.6) return 'Yola, Adamawa';
  // Maiduguri, Borno: ~11.83, 13.15
  if (lat >= 11.7 && lat <= 12.1 && lng >= 13.0 && lng <= 13.3) return 'Maiduguri, Borno';
  // Lokoja, Kogi: ~7.80, 6.74
  if (lat >= 7.6 && lat <= 8.0 && lng >= 6.6 && lng <= 6.9) return 'Lokoja, Kogi';
  // Akure, Ondo: ~7.25, 5.19
  if (lat >= 7.1 && lat <= 7.5 && lng >= 5.1 && lng <= 5.4) return 'Akure, Ondo';
  // Osogbo, Osun: ~7.78, 4.56
  if (lat >= 7.6 && lat <= 7.9 && lng >= 4.4 && lng <= 4.7) return 'Osogbo, Osun';
  // Ado-Ekiti, Ekiti: ~7.62, 5.22
  if (lat >= 7.5 && lat <= 7.8 && lng >= 5.1 && lng <= 5.4) return 'Ado-Ekiti, Ekiti';

  return 'Nigeria';
}

/**
 * Formats an address string to prevent raw GPS coordinates (e.g. "8.5079, 8.5394")
 * from being shown to users without context.
 */
export function formatLocationAddress(
  address?: string | null,
  latitude?: number | null,
  longitude?: number | null
): string {
  const trimmed = (address || '').trim();

  // Regex to detect raw coordinate pairs like "8.5079, 8.5394" or "8.507941, 8.539412"
  const coordsRegex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
  const match = trimmed.match(coordsRegex);

  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    const city = inferNigerianCityFromCoords(lat, lng);
    return `${city} (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  if (!trimmed) {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const city = inferNigerianCityFromCoords(latitude, longitude);
      return `${city} (GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    }
    return 'Location not specified';
  }

  return trimmed;
}

