import type { MapStyleElement } from 'react-native-maps';

/**
 * Google map style in the app's "old map" palette: dark brown land, deep muted
 * water, copper roads, cream labels. Most POI icons and business labels are
 * hidden so the landmark pins stand out. Hex values mirror `colors.ts` (the
 * Google style format needs plain strings, so they are repeated here on purpose).
 */
const LAND = '#2A1410';
const LAND_RAISED = '#33190F';
const WATER = '#1B2A2E';
const ROAD = '#6B3A28';
const ROAD_MAJOR = '#8A4A30';
const TEXT_CREAM = '#F3E6D8';
const TEXT_MUTED = '#C9B3A0';
const BORDER = '#5A3A2E';

const color = (value: string) => ({ color: value });
const hidden = { visibility: 'off' };

export const mapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [color(LAND)] },
  { elementType: 'labels.text.fill', stylers: [color(TEXT_MUTED)] },
  { elementType: 'labels.text.stroke', stylers: [color(LAND), { weight: 3 }] },
  { elementType: 'labels.icon', stylers: [hidden] },

  // Borders and place names.
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [color(BORDER)] },
  // Country names are drawn by the app (src/components/map/country-labels.tsx), so Google's are hidden.
  { featureType: 'administrative.country', elementType: 'labels', stylers: [hidden] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [color(TEXT_CREAM)] },
  { featureType: 'administrative.neighborhood', stylers: [hidden] },
  { featureType: 'administrative.land_parcel', stylers: [hidden] },

  // Points of interest and businesses: hidden.
  { featureType: 'poi', stylers: [hidden] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, color(LAND_RAISED)] },
  { featureType: 'transit', stylers: [hidden] },

  // Roads in subdued copper.
  { featureType: 'road', elementType: 'geometry', stylers: [color(ROAD)] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [color(LAND)] },
  { featureType: 'road', elementType: 'labels', stylers: [hidden] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [color(ROAD_MAJOR)] },

  // Water.
  { featureType: 'water', elementType: 'geometry', stylers: [color(WATER)] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [color(TEXT_MUTED)] },
];
