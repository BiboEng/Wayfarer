import { mapStyle } from '../map-style';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('mapStyle', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(mapStyle)).toBe(true);
    expect(mapStyle.length).toBeGreaterThan(0);
  });

  it('gives every entry at least one styler', () => {
    for (const entry of mapStyle) {
      expect(Array.isArray(entry.stylers)).toBe(true);
      expect(entry.stylers.length).toBeGreaterThan(0);
    }
  });

  it('uses valid #RRGGBB colours', () => {
    const colours = mapStyle.flatMap((entry) => entry.stylers).flatMap((styler) => ('color' in styler ? [String(styler.color)] : []));
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(colour).toMatch(HEX);
  });

  it('uses only visibility values Google Maps understands', () => {
    const visibilities = mapStyle.flatMap((entry) => entry.stylers).flatMap((styler) => ('visibility' in styler ? [String(styler.visibility)] : []));
    for (const visibility of visibilities) expect(['on', 'off', 'simplified']).toContain(visibility);
  });

  it('hides points of interest so landmark pins stand out', () => {
    const poi = mapStyle.find((entry) => entry.featureType === 'poi' && !entry.elementType);
    expect(poi?.stylers).toContainEqual({ visibility: 'off' });
  });

  it('hides Google country labels (the app draws its own)', () => {
    const country = mapStyle.find((entry) => entry.featureType === 'administrative.country' && entry.elementType === 'labels');
    expect(country).toBeDefined();
    expect(country?.stylers).toContainEqual({ visibility: 'off' });
  });
});
