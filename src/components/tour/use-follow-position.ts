import type { LatLng } from '@shared/geo/lat-lng';
import { useEffect, useRef, type RefObject } from 'react';
import type MapView from 'react-native-maps';

/** The camera moves at most this often, however fast the position updates arrive. */
const MIN_INTERVAL_MS = 1500;
const ANIMATION_MS = 900;

/**
 * Keeps the map centred on `position` at `zoom`: the first fix jumps there, later ones glide.
 * Throttled, and keyed on the coordinates (not the object) so unrelated snapshot updates
 * never touch the native map.
 */
export function useFollowPosition(
  mapRef: RefObject<MapView | null>,
  position: LatLng | null,
  zoom: number,
): void {
  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;
  const placed = useRef(false);
  const lastMoveAt = useRef(0);

  useEffect(() => {
    if (lat === null || lng === null) return;

    const move = () => {
      const map = mapRef.current;
      if (!map) return;
      lastMoveAt.current = Date.now();
      const center = { latitude: lat, longitude: lng };
      if (placed.current) {
        map.animateCamera({ center, zoom }, { duration: ANIMATION_MS });
      } else {
        placed.current = true;
        map.setCamera({ center, zoom, heading: 0, pitch: 0 });
      }
    };

    const wait = MIN_INTERVAL_MS - (Date.now() - lastMoveAt.current);
    if (wait <= 0) {
      move();
      return;
    }
    const timer = setTimeout(move, wait);
    return () => clearTimeout(timer);
  }, [mapRef, lat, lng, zoom]);
}
