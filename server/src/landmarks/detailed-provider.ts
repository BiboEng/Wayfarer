import type { Landmark } from '@shared/landmarks/landmark';
import type { LandmarkProvider, NearbyQuery } from '@shared/landmarks/provider';

export interface DetailedNearby {
  landmarks: Landmark[];
  /** True when a source failed, so the list may be missing landmarks. Cache it briefly. */
  partial: boolean;
}

/** Server-only extension of LandmarkProvider that also reports partial results. */
export interface DetailedLandmarkProvider extends LandmarkProvider {
  findNearbyDetailed(query: NearbyQuery, signal?: AbortSignal): Promise<DetailedNearby>;
}

export function isDetailedProvider(provider: LandmarkProvider): provider is DetailedLandmarkProvider {
  return typeof (provider as Partial<DetailedLandmarkProvider>).findNearbyDetailed === 'function';
}
