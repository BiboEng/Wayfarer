/** Allowed `radius` for GET /landmarks/nearby (Live Tour uses ~150–1000 m). */
export const NEARBY_RADIUS_MIN_M = 50;
export const NEARBY_RADIUS_MAX_M = 2000;

/**
 * Radii tried in order by GET /landmarks/nearest (Explore mode) until a landmark
 * with a Wikipedia article turns up. 10 km is the Wikipedia GeoSearch maximum;
 * nothing within it means "nothing notable here".
 */
export const EXPLORE_RADIUS_STEPS_M = [500, 2000, 5000, 10000] as const;

/** Cap on `WikipediaInfo.extract` length, in characters. */
export const WIKIPEDIA_EXTRACT_MAX_CHARS = 2000;
