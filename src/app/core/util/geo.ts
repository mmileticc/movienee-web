export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * The user's approximate position (for sorting cinemas by distance), or null when geolocation is
 * unavailable, denied or slow. Asked only after an explicit user action, never on page load.
 */
export function currentPosition(timeoutMs = 10000): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    );
  });
}
