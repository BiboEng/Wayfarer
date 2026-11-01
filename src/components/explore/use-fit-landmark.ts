import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { useEffect, useRef, type RefObject } from 'react';
import type MapView from 'react-native-maps';

import { spacing } from '@/theme';

import { pointsToFit } from './fit-points';

/** Wait for the card to finish measuring itself before moving the camera. */
const SETTLE_MS = 200;
/** A card height change smaller than this (dp) is not worth moving the camera for. */
const MEANINGFUL_INSET_CHANGE = 24;

/**
 * Keeps the tap and the landmark in view above the bottom card: fits when a new
 * landmark arrives, and again when the card height changes meaningfully for the
 * same landmark (it measures itself after the landmark renders, and grows when
 * the story is opened).
 *
 * Chosen over the `mapPadding` prop: that also shifts the map's centre and the
 * Google logo whenever the card resizes, and its behaviour with `fitToCoordinates`
 * differs between the old and new architecture. `edgePadding` is explicit per call.
 */
export function useFitLandmark(
  mapRef: RefObject<MapView | null>,
  tapped: LatLng | null,
  landmark: Landmark | null,
  bottomInset: number,
): void {
  const last = useRef<{ landmark: Landmark; inset: number } | null>(null);

  useEffect(() => {
    if (!landmark || !tapped) {
      last.current = null;
      return;
    }
    const previous = last.current;
    const isNew = previous?.landmark !== landmark;
    if (!isNew && Math.abs(bottomInset - previous.inset) < MEANINGFUL_INSET_CHANGE) return;

    const timer = setTimeout(() => {
      last.current = { landmark, inset: bottomInset };
      mapRef.current?.fitToCoordinates(pointsToFit(tapped, landmark.location), {
        edgePadding: {
          top: spacing.xxxl,
          right: spacing.xxxl,
          left: spacing.xxxl,
          bottom: bottomInset + spacing.xxl,
        },
        animated: true,
      });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [mapRef, tapped, landmark, bottomInset]);
}
