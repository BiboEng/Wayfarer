import { withQuery } from '../query-string';

describe('withQuery', () => {
  it('appends params in order', () => {
    expect(withQuery('/landmarks/nearby', { lat: 41.0086, lng: 28.9802, radius: 250 })).toBe(
      '/landmarks/nearby?lat=41.0086&lng=28.9802&radius=250',
    );
  });

  it('returns the path unchanged when there are no params', () => {
    expect(withQuery('/health', {})).toBe('/health');
  });

  it('keeps negative numbers and zero', () => {
    expect(withQuery('/x', { lat: 0, lng: -30 })).toBe('/x?lat=0&lng=-30');
  });

  it('url-encodes keys and values', () => {
    expect(withQuery('/x', { 'a b': 'c&d=e', q: 'é/?' })).toBe('/x?a%20b=c%26d%3De&q=%C3%A9%2F%3F');
  });

  it('stringifies small numbers as JavaScript does', () => {
    expect(withQuery('/x', { v: 1e-7 })).toBe('/x?v=1e-7');
  });
});
