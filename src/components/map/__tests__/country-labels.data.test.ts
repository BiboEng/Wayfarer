import { COUNTRY_LABELS } from '../country-labels.data';

describe('COUNTRY_LABELS data', () => {
  it('is not empty', () => {
    expect(COUNTRY_LABELS.length).toBeGreaterThan(100);
  });

  it('gives every entry a non-empty, trimmed name', () => {
    for (const l of COUNTRY_LABELS) {
      expect(typeof l.name).toBe('string');
      expect(l.name.trim()).not.toBe('');
      expect(l.name).toBe(l.name.trim());
    }
  });

  it('gives every entry a valid latitude and longitude', () => {
    for (const l of COUNTRY_LABELS) {
      expect(Number.isFinite(l.lat)).toBe(true);
      expect(Number.isFinite(l.lng)).toBe(true);
      expect(l.lat).toBeGreaterThanOrEqual(-90);
      expect(l.lat).toBeLessThanOrEqual(90);
      expect(l.lng).toBeGreaterThanOrEqual(-180);
      expect(l.lng).toBeLessThanOrEqual(180);
    }
  });

  it('gives every entry finite zoom bounds with minZoom <= maxZoom', () => {
    for (const l of COUNTRY_LABELS) {
      expect(Number.isFinite(l.minZoom)).toBe(true);
      expect(Number.isFinite(l.maxZoom)).toBe(true);
      expect(l.minZoom).toBeLessThanOrEqual(l.maxZoom);
    }
  });

  it('has unique names', () => {
    const names = COUNTRY_LABELS.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  describe('Palestine requirement', () => {
    it('has exactly one entry named "Palestine"', () => {
      expect(COUNTRY_LABELS.filter((l) => l.name === 'Palestine')).toHaveLength(1);
    });

    it('has no entry named "Israel" (any case)', () => {
      expect(COUNTRY_LABELS.filter((l) => /israel/i.test(l.name))).toEqual([]);
    });

    it('places Palestine roughly within 29-34 N, 34-36 E', () => {
      const p = COUNTRY_LABELS.find((l) => l.name === 'Palestine');
      expect(p).toBeDefined();
      expect(p?.lat).toBeGreaterThanOrEqual(29);
      expect(p?.lat).toBeLessThanOrEqual(34);
      expect(p?.lng).toBeGreaterThanOrEqual(34);
      expect(p?.lng).toBeLessThanOrEqual(36);
    });
  });
});
