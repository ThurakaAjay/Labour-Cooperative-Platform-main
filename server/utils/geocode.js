// Free geocoding via OpenStreetMap's Nominatim public API — no API key required.
// Nominatim's usage policy requires a descriptive User-Agent and at most ~1
// request/second, so results are cached in-process by address string to keep
// repeat lookups (e.g. re-saving the same booking) from re-hitting the API.
const geocodeCache = new Map();
const MAX_CACHE_ENTRIES = 500;

/**
 * Resolve a free-form address string to { lat, lng, formattedAddress }.
 * Returns null (never throws) if geocoding fails, times out, or the address
 * cannot be resolved — callers should treat location data as best-effort.
 */
const geocodeAddress = async (address) => {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return null;
  }

  const cacheKey = address.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(address)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        // Nominatim requires a real identifying User-Agent per its usage policy.
        'User-Agent': 'WorkHive-Cooperative-Platform/1.0 (contact: support@workhive.local)'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const best = results[0];
    const resolved = {
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      formattedAddress: best.display_name || address
    };

    if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
      geocodeCache.delete(geocodeCache.keys().next().value);
    }
    geocodeCache.set(cacheKey, resolved);

    return resolved;
  } catch (err) {
    console.warn('[Geocode] Failed to resolve address:', err.message);
    return null;
  }
};

module.exports = { geocodeAddress };
