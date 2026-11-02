/**
 * Walking route through Sultanahmet, Istanbul: about 1.9 km at 5 km/h (about 23 minutes).
 * Hagia Sophia → Blue Mosque → Hippodrome → Basilica Cistern → Gülhane → Topkapı Imperial Gate.
 */
import { kmhToMps, type SimRoute } from '../sim-route';

export const WALK_SULTANAHMET: SimRoute = {
  name: 'Walk: Sultanahmet',
  speedMps: kmhToMps(5),
  points: [
    { lat: 41.0086, lng: 28.9802 }, // Hagia Sophia
    { lat: 41.008, lng: 28.979 }, // Sultanahmet Square
    { lat: 41.0072, lng: 28.9781 }, // Sultanahmet Park
    { lat: 41.0063, lng: 28.9776 },
    { lat: 41.0054, lng: 28.9768 }, // Blue Mosque
    { lat: 41.0047, lng: 28.976 }, // Torun Sokağı
    { lat: 41.0043, lng: 28.9743 }, // south end of the Hippodrome
    { lat: 41.0054, lng: 28.9748 }, // Walled Obelisk
    { lat: 41.0063, lng: 28.9752 }, // Hippodrome, Obelisk of Theodosius
    { lat: 41.0071, lng: 28.9758 }, // German Fountain
    { lat: 41.0078, lng: 28.9768 }, // Divanyolu
    { lat: 41.0084, lng: 28.9779 }, // Basilica Cistern
    { lat: 41.0092, lng: 28.9776 }, // Yerebatan Caddesi
    { lat: 41.0102, lng: 28.9779 },
    { lat: 41.0112, lng: 28.9786 }, // Gülhane (Alemdar Caddesi)
    { lat: 41.0108, lng: 28.9797 }, // Soğukçeşme Sokağı
    { lat: 41.0104, lng: 28.9806 },
    { lat: 41.0099, lng: 28.9813 }, // Topkapı Palace, Imperial Gate
  ],
};
