import type { TourSnapshot } from '@/tour/types';

import { StatusMessage } from '@/components/explore/status-message';

import { ActiveTour } from './active-tour';
import { NotificationsGate } from './notifications-gate';
import { TourEnded } from './tour-ended';
import { TourGate } from './tour-gate';

/** Picks what the Live Tour screen shows for the session's status. */
export function TourBody({ snapshot }: { snapshot: TourSnapshot }) {
  switch (snapshot.status) {
    case 'idle':
      return <StatusMessage busy tone="muted" message="Starting the tour…" />;
    case 'needs-permission':
    case 'permission-denied':
    case 'location-off':
    case 'location-approximate':
      return <TourGate status={snapshot.status} source={snapshot.source} />;
    case 'needs-notifications':
      return <NotificationsGate />;
    case 'ended':
      return <TourEnded source={snapshot.source} />;
    case 'listening':
    case 'preparing':
    case 'narrating':
    case 'paused':
      return <ActiveTour snapshot={snapshot} />;
  }
}
