import { isCountryMarkerId } from '../country-labels';
import { COUNTRY_LABELS } from '../country-labels.data';

// country-labels.tsx pulls in react-native-maps (via StaticMarker), which needs native modules.
// babel-jest hoists this above the imports.
jest.mock('react-native-maps', () => ({ Marker: 'Marker' }));

describe('isCountryMarkerId', () => {
  it('is true for country marker ids', () => {
    expect(isCountryMarkerId('country:France')).toBe(true);
    expect(isCountryMarkerId('country:Palestine')).toBe(true);
  });

  it('is true for every id the labels produce', () => {
    for (const l of COUNTRY_LABELS) expect(isCountryMarkerId(`country:${l.name}`)).toBe(true);
  });

  it('is false for undefined and empty ids', () => {
    expect(isCountryMarkerId(undefined)).toBe(false);
    expect(isCountryMarkerId('')).toBe(false);
  });

  it('is false for other markers such as landmarks', () => {
    expect(isCountryMarkerId('wikipedia:12345')).toBe(false);
    expect(isCountryMarkerId('landmark-1')).toBe(false);
  });

  it('only matches the prefix at the start, and is case-sensitive', () => {
    expect(isCountryMarkerId('my-country:France')).toBe(false);
    expect(isCountryMarkerId('Country:France')).toBe(false);
    expect(isCountryMarkerId('country')).toBe(false);
  });
});
