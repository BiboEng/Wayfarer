export const NARRATION_LENGTHS = ['short', 'medium', 'long'] as const;
export type NarrationLength = (typeof NARRATION_LENGTHS)[number];

export const TRAVEL_MODES = ['walking', 'driving'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Opaque voice identifier; its meaning depends on the server's TTS provider. */
export type VoiceId = string;
