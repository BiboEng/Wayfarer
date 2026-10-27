import { parseCoordinates } from '../parse-coordinates';

describe('parseCoordinates', () => {
  it.each([
    ['41.0086, 28.9802', { lat: 41.0086, lng: 28.9802 }],
    ['41.0086,28.9802', { lat: 41.0086, lng: 28.9802 }],
    ['  41.0086 ,  28.9802  ', { lat: 41.0086, lng: 28.9802 }],
    ['41.0086;28.9802', { lat: 41.0086, lng: 28.9802 }],
    ['41.0086 28.9802', { lat: 41.0086, lng: 28.9802 }],
    ['-33.8688, 151.2093', { lat: -33.8688, lng: 151.2093 }],
    ['+10, +20', { lat: 10, lng: 20 }],
    ['0, -30', { lat: 0, lng: -30 }],
    ['.5, 5.', { lat: 0.5, lng: 5 }],
    ['90, 180', { lat: 90, lng: 180 }],
    ['-90, -180', { lat: -90, lng: -180 }],
  ])('parses %j', (text, expected) => {
    expect(parseCoordinates(text)).toEqual(expected);
  });

  it.each([
    '',
    '   ',
    '41.0086',
    '1234',
    'a, b',
    '41.0086, 28.9802, 5',
    '41.0086 N, 28.9802 E',
    '90.0001, 0',
    '-90.1, 0',
    '0, 180.5',
    '0, -181',
    '1,,2',
    '1e2, 3',
    'NaN, 1',
    'Infinity, 1',
  ])('returns null for %j', (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});
