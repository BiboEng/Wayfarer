import type { TourSource } from '@/tour/types';

import type { SimRoute } from '../sim-route';
import { DRIVE_BOSPHORUS } from './drive-bosphorus';
import { WALK_SULTANAHMET } from './walk-sultanahmet';

export { DRIVE_BOSPHORUS, WALK_SULTANAHMET };

/** The simulated route for a tour source; null for real GPS. */
export function simRouteFor(source: TourSource): SimRoute | null {
  if (source === 'sim-walk') return WALK_SULTANAHMET;
  if (source === 'sim-drive') return DRIVE_BOSPHORUS;
  return null;
}
