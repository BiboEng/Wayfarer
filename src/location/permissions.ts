/** Foreground location permission and the "location services on" check. Never reject. */
import * as Location from 'expo-location';

import type { LocationPermission } from './types';

function toPermission(response: Location.LocationPermissionResponse): LocationPermission {
  if (response.granted) return grantedLevel(response);
  return response.canAskAgain ? 'undetermined' : 'denied';
}

/** A grant may be approximate only (`PermissionDetailsLocationAndroid.accuracy`, iOS 14+ `accuracy`). */
function grantedLevel(response: Location.LocationPermissionResponse): LocationPermission {
  if (response.android?.accuracy === 'coarse' || response.ios?.accuracy === 'reduced') return 'approximate';
  return 'granted';
}

/** Current foreground permission, without prompting. */
export async function getLocationPermission(): Promise<LocationPermission> {
  try {
    return toPermission(await Location.getForegroundPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** Shows the system prompt (call only from a user tap). Anything but a grant counts as refused. */
export async function requestLocationPermission(): Promise<LocationPermission> {
  try {
    const response = await Location.requestForegroundPermissionsAsync();
    return response.granted ? grantedLevel(response) : 'denied';
  } catch {
    return 'denied';
  }
}

/** False when location services are switched off on the phone. */
export async function locationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    // Can't tell: let the watch try; it reports its own errors.
    return true;
  }
}
