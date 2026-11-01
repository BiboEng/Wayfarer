import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { memo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerPressEvent,
  type Region,
} from 'react-native-maps';

import { mapStyle } from '@/theme';

import { CountryLabels, isCountryMarkerId } from '@/components/map/country-labels';

import { LandmarkPin, TappedMarker } from './map-pins';
import { useFitLandmark } from './use-fit-landmark';

/** A whole-world view to start from. */
const WORLD_REGION: Region = { latitude: 25, longitude: 10, latitudeDelta: 110, longitudeDelta: 110 };

export interface ExploreMapProps {
  tapped: LatLng | null;
  landmark: Landmark | null;
  onTap: (point: LatLng) => void;
  /** Height of the card overlaid on the bottom, so the pin is framed above it. */
  bottomInset: number;
}

/**
 * Full-screen, tappable map in the app's style. Frames the tap and the landmark when one is found.
 * Memoized so player updates that re-render the screen do not touch the native map. The React
 * Compiler already caches the coordinate objects and the press handler per render, so no manual
 * useMemo/useCallback is needed inside.
 */
export const ExploreMap = memo(function ExploreMap({ tapped, landmark, onTap, bottomInset }: ExploreMapProps) {
  const mapRef = useRef<MapView>(null);
  useFitLandmark(mapRef, tapped, landmark, bottomInset);
  // Updated once a camera move finishes, not on every frame, so labels do not re-render while panning.
  const [region, setRegion] = useState<Region>(WORLD_REGION);

  const handlePress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onTap({ lat: latitude, lng: longitude });
  };

  // Markers cannot be click-through, so a tap that lands on a country name arrives here instead
  // of in onPress. Treat it as a tap on the name's own point, so those taps still work.
  const handleMarkerPress = (event: MarkerPressEvent) => {
    const { id, coordinate } = event.nativeEvent;
    if (isCountryMarkerId(id)) onTap({ lat: coordinate.latitude, lng: coordinate.longitude });
  };

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      customMapStyle={mapStyle}
      toolbarEnabled={false}
      initialRegion={WORLD_REGION}
      rotateEnabled={false}
      pitchEnabled={false}
      poiClickEnabled={false}
      moveOnMarkerPress={false}
      onPress={handlePress}
      onMarkerPress={handleMarkerPress}
      onRegionChangeComplete={setRegion}
    >
      <CountryLabels region={region} />
      {tapped ? <TappedMarker coordinate={{ latitude: tapped.lat, longitude: tapped.lng }} /> : null}
      {landmark ? (
        <LandmarkPin
          coordinate={{ latitude: landmark.location.lat, longitude: landmark.location.lng }}
          title={landmark.name}
        />
      ) : null}
    </MapView>
  );
});
