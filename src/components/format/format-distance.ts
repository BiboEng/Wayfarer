/** "85 m" below 1 km, "1.3 km" up to 10 km, then whole km ("12 km"). */
export function formatDistance(meters: number): string {
  // Round first, then pick the unit from the rounded value.
  if (Math.round(meters) < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const tenths = Math.round(km * 10) / 10;
  return tenths < 10 ? `${tenths.toFixed(1)} km` : `${Math.round(km)} km`;
}
