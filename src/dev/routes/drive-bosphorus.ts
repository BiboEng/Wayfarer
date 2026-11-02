/**
 * Driving route along the Bosphorus shore road, Istanbul: about 5.1 km at 40 km/h (about 8 minutes).
 * Karaköy → Tophane → Kabataş → Dolmabahçe → Beşiktaş → Çırağan → Ortaköy.
 */
import { kmhToMps, type SimRoute } from '../sim-route';

export const DRIVE_BOSPHORUS: SimRoute = {
  name: 'Drive: Bosphorus',
  speedMps: kmhToMps(40),
  points: [
    { lat: 41.0227, lng: 28.977 }, // Karaköy
    { lat: 41.024, lng: 28.98 }, // Kemeraltı Caddesi
    { lat: 41.026, lng: 28.983 }, // Tophane
    { lat: 41.029, lng: 28.987 }, // Fındıklı (Meclis-i Mebusan Caddesi)
    { lat: 41.033, lng: 28.992 }, // Kabataş
    { lat: 41.0365, lng: 28.996 },
    { lat: 41.0392, lng: 29.0004 }, // Dolmabahçe Palace
    { lat: 41.0408, lng: 29.004 },
    { lat: 41.0422, lng: 29.0067 }, // Beşiktaş
    { lat: 41.0428, lng: 29.01 }, // Çırağan Caddesi
    { lat: 41.0434, lng: 29.0135 },
    { lat: 41.044, lng: 29.017 }, // Çırağan Palace
    { lat: 41.045, lng: 29.021 },
    { lat: 41.0462, lng: 29.024 },
    { lat: 41.0473, lng: 29.0262 }, // Ortaköy
  ],
};
