/** One country name drawn on the map by the app (data from Natural Earth, see the generator). */
export interface CountryLabel {
  name: string;
  lat: number;
  lng: number;
  /** Shown from this zoom level on (Natural Earth MIN_LABEL; bigger countries appear first). */
  minZoom: number;
  /** Shown up to this zoom level (Natural Earth MAX_LABEL). */
  maxZoom: number;
}

/** The visible part of the map, as react-native-maps reports it. */
export interface LabelRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Country names are hidden above this zoom whatever Natural Earth says: past it
 * Google itself shows regions and cities instead, and a country name would only
 * sit on top of them. Tune here, no need to regenerate the data.
 */
export const COUNTRY_LABEL_MAX_ZOOM = 8;

/** A phone-sized map width in dp, for when the real width is not known. */
export const DEFAULT_VIEW_WIDTH_DP = 400;

/** Google tile size in dp at zoom 0: the whole world is this wide. */
const WORLD_WIDTH_AT_ZOOM_0 = 256;

/** Extra area around the screen, as a share of the visible span, so labels are ready before a pan reveals them. */
const VIEW_MARGIN = 0.15;

/** Google Maps zoom level for a region, from its longitude span and the map's width in dp. */
export function zoomFromRegion(region: Pick<LabelRegion, 'longitudeDelta'>, viewWidthDp = DEFAULT_VIEW_WIDTH_DP): number {
  if (!(region.longitudeDelta > 0)) return 22;
  return Math.log2((360 * viewWidthDp) / (WORLD_WIDTH_AT_ZOOM_0 * region.longitudeDelta));
}

/** Signed longitude difference from `from` to `to` in degrees, wrapped into [-180, 180). */
function wrappedLngDiff(to: number, from: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * The labels to draw for a region: right zoom range, inside the visible area
 * (plus a margin, across the 180th meridian too), most prominent first, at most
 * `maxCount` of them so Android stays smooth.
 */
export function visibleLabels(
  labels: readonly CountryLabel[],
  region: LabelRegion,
  maxCount: number,
  viewWidthDp = DEFAULT_VIEW_WIDTH_DP,
): CountryLabel[] {
  const zoom = zoomFromRegion(region, viewWidthDp);
  if (zoom > COUNTRY_LABEL_MAX_ZOOM) return [];

  const halfLat = (region.latitudeDelta / 2) * (1 + VIEW_MARGIN);
  const halfLng = (region.longitudeDelta / 2) * (1 + VIEW_MARGIN);
  const wholeWorldWide = halfLng >= 180;

  return labels
    .filter(
      (label) =>
        label.minZoom <= zoom &&
        zoom <= Math.min(label.maxZoom, COUNTRY_LABEL_MAX_ZOOM) &&
        Math.abs(label.lat - region.latitude) <= halfLat &&
        (wholeWorldWide || Math.abs(wrappedLngDiff(label.lng, region.longitude)) <= halfLng),
    )
    .sort((a, b) => a.minZoom - b.minZoom || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, maxCount));
}
