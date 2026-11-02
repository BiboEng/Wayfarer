import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

/** Time after the first layout for Google Maps to snapshot the view into the marker bitmap. */
const SNAPSHOT_MS = 100;

export interface StaticMarkerProps {
  coordinate: { latitude: number; longitude: number };
  /** Accessibility label of the marker. */
  label: string;
  /** Set to find the marker in `onMarkerPress`. */
  identifier?: string;
  /** Higher draws on top. */
  zIndex?: number;
  /** Degrees clockwise from north. Applied natively, so changing it needs no re-snapshot. */
  rotation?: number;
  /** Lies on the map (turns with it) instead of facing the screen. Use with `rotation`. */
  flat?: boolean;
  children: ReactNode;
}

/**
 * Marker whose look never changes. Android re-snapshots a custom-view marker on
 * every frame while `tracksViewChanges` is true (CPU, battery, pan stutter), so
 * it is on only until the child has laid out once, then switched off.
 */
export function StaticMarker({ coordinate, label, identifier, zIndex, rotation, flat, children }: StaticMarkerProps) {
  const [tracking, setTracking] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tappable={false}
      identifier={identifier}
      zIndex={zIndex}
      rotation={rotation}
      flat={flat}
      tracksViewChanges={tracking}
      accessibilityLabel={label}
    >
      <View
        collapsable={false}
        onLayout={() => {
          timer.current = setTimeout(() => setTracking(false), SNAPSHOT_MS);
        }}
      >
        {children}
      </View>
    </Marker>
  );
}
