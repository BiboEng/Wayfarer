import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiResult, ClientError } from '@/api/client';
import { getNearbyLandmarks, getNearestLandmark } from '@/api/landmarks';

export type LandmarkSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ClientError }
  | {
      status: 'done';
      /** The point that was queried; distances are measured from here. */
      origin: LatLng;
      landmarks: Landmark[];
      /** Set for "nearest" searches: the radius of the last widening step. */
      searchedRadiusMeters?: number;
    };

export interface UseLandmarkSearch {
  state: LandmarkSearchState;
  searchNearby: (origin: LatLng, radiusMeters: number) => void;
  searchNearest: (origin: LatLng) => void;
}

/** Runs landmark searches; a response from an older search is ignored. */
export function useLandmarkSearch(): UseLandmarkSearch {
  const [state, setState] = useState<LandmarkSearchState>({ status: 'idle' });
  const latest = useRef(0);

  useEffect(() => {
    const ref = latest;
    return () => {
      ref.current += 1; // ignore responses after unmount
    };
  }, []);

  const run = useCallback(
    <T>(request: Promise<ApiResult<T>>, toState: (data: T) => LandmarkSearchState) => {
      const id = ++latest.current;
      setState({ status: 'loading' });
      request.then((result) => {
        if (id !== latest.current) return;
        setState(result.ok ? toState(result.data) : { status: 'error', error: result.error });
      });
    },
    [],
  );

  const searchNearby = useCallback(
    (origin: LatLng, radiusMeters: number) =>
      run(getNearbyLandmarks(origin, radiusMeters), (data) => ({
        status: 'done',
        origin,
        landmarks: data.landmarks,
      })),
    [run],
  );

  const searchNearest = useCallback(
    (origin: LatLng) =>
      run(getNearestLandmark(origin), (data) => ({
        status: 'done',
        origin,
        landmarks: data.landmark ? [data.landmark] : [],
        searchedRadiusMeters: data.searchedRadiusMeters,
      })),
    [run],
  );

  return { state, searchNearby, searchNearest };
}
