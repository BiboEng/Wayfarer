import {
  COUNTRY_LABEL_MAX_ZOOM,
  DEFAULT_VIEW_WIDTH_DP,
  visibleLabels,
  zoomFromRegion,
  type CountryLabel,
  type LabelRegion,
} from '../visible-labels';

/** With a 256 dp wide map, zoom z shows exactly 360 / 2^z degrees of longitude. */
const W = 256;
const deltaForZoom = (zoom: number, width = W) => (360 * width) / (256 * 2 ** zoom);

function region(latitude: number, longitude: number, zoom: number, latitudeDelta = 10): LabelRegion {
  return { latitude, longitude, latitudeDelta, longitudeDelta: deltaForZoom(zoom) };
}

function label(name: string, lat: number, lng: number, minZoom = 0, maxZoom = 8): CountryLabel {
  return { name, lat, lng, minZoom, maxZoom };
}

const names = (labels: CountryLabel[]) => labels.map((l) => l.name);

describe('zoomFromRegion', () => {
  it('is 0 when the whole world fits in one 256 dp tile', () => {
    expect(zoomFromRegion({ longitudeDelta: 360 }, 256)).toBeCloseTo(0, 10);
  });

  it('goes up by one each time the span halves', () => {
    expect(zoomFromRegion({ longitudeDelta: 180 }, 256)).toBeCloseTo(1, 10);
    expect(zoomFromRegion({ longitudeDelta: 45 }, 256)).toBeCloseTo(3, 10);
    expect(zoomFromRegion({ longitudeDelta: 360 / 2 ** 10 }, 256)).toBeCloseTo(10, 10);
  });

  it('goes up by one each time the map width doubles', () => {
    expect(zoomFromRegion({ longitudeDelta: 360 }, 512)).toBeCloseTo(1, 10);
  });

  it('uses the default phone width of 400 dp when none is given', () => {
    expect(DEFAULT_VIEW_WIDTH_DP).toBe(400);
    expect(zoomFromRegion({ longitudeDelta: 360 })).toBeCloseTo(Math.log2(400 / 256), 10);
    expect(zoomFromRegion({ longitudeDelta: 360 })).toBeCloseTo(zoomFromRegion({ longitudeDelta: 360 }, 400), 10);
  });

  it('gives zoom 5 for a (360 * 400 / 256 / 32) degree span on a 400 dp map', () => {
    expect(zoomFromRegion({ longitudeDelta: (360 * 400) / (256 * 32) })).toBeCloseTo(5, 10);
  });

  it('returns a high zoom (22) for a zero, negative or NaN span instead of Infinity/NaN', () => {
    expect(zoomFromRegion({ longitudeDelta: 0 })).toBe(22);
    expect(zoomFromRegion({ longitudeDelta: -5 })).toBe(22);
    expect(zoomFromRegion({ longitudeDelta: NaN })).toBe(22);
  });
});

describe('visibleLabels', () => {
  it('returns an empty list for no labels', () => {
    expect(visibleLabels([], region(0, 0, 3), 10, W)).toEqual([]);
  });

  describe('zoom range', () => {
    const l = label('Mid', 0, 0, 3, 6);

    it('is hidden below minZoom', () => {
      expect(visibleLabels([l], region(0, 0, 2.9), 10, W)).toEqual([]);
    });

    it('is shown exactly at minZoom and at maxZoom (inclusive)', () => {
      expect(names(visibleLabels([l], region(0, 0, 3), 10, W))).toEqual(['Mid']);
      expect(names(visibleLabels([l], region(0, 0, 6), 10, W))).toEqual(['Mid']);
    });

    it('is hidden above maxZoom', () => {
      expect(visibleLabels([l], region(0, 0, 6.1), 10, W)).toEqual([]);
    });

    it('is hidden above COUNTRY_LABEL_MAX_ZOOM even if the label allows more', () => {
      const greedy = label('Greedy', 0, 0, 0, 20);
      expect(names(visibleLabels([greedy], region(0, 0, COUNTRY_LABEL_MAX_ZOOM), 10, W))).toEqual(['Greedy']);
      expect(visibleLabels([greedy], region(0, 0, COUNTRY_LABEL_MAX_ZOOM + 0.1), 10, W)).toEqual([]);
      expect(visibleLabels([greedy], region(0, 0, 15), 10, W)).toEqual([]);
    });

    it('respects the view width: the same region is a higher zoom on a wider map', () => {
      const r: LabelRegion = { latitude: 0, longitude: 0, latitudeDelta: 10, longitudeDelta: deltaForZoom(2) };
      const l25 = label('Z', 0, 0, 2.5, 8);
      expect(visibleLabels([l25], r, 10, 256)).toEqual([]);
      expect(names(visibleLabels([l25], r, 10, 512))).toEqual(['Z']);
    });
  });

  describe('position', () => {
    it('shows labels inside the region and hides ones outside', () => {
      const r = region(10, 20, 4, 10);
      const inside = label('Inside', 12, 25);
      const farLat = label('FarLat', 40, 20);
      const farLng = label('FarLng', 10, 60);
      expect(names(visibleLabels([inside, farLat, farLng], r, 10, W))).toEqual(['Inside']);
    });

    it('includes a margin just outside the visible area but not far beyond it', () => {
      const r: LabelRegion = { latitude: 0, longitude: 0, latitudeDelta: 10, longitudeDelta: 20 };
      const justOutsideLat = label('JustOutsideLat', 5.5, 0); // edge 5, margin edge 5.75
      const beyondLat = label('BeyondLat', 6, 0);
      const justOutsideLng = label('JustOutsideLng', 0, 11); // edge 10, margin edge 11.5
      const beyondLng = label('BeyondLng', 0, 12);
      expect(names(visibleLabels([justOutsideLat, beyondLat, justOutsideLng, beyondLng], r, 10, W)).sort()).toEqual([
        'JustOutsideLat',
        'JustOutsideLng',
      ]);
    });

    it('handles the southern and western hemispheres', () => {
      const r = region(-30, -60, 4, 20);
      expect(names(visibleLabels([label('Chile', -35, -65), label('Spain', 40, -4)], r, 10, W))).toEqual(['Chile']);
    });
  });

  describe('longitude wrap across the 180th meridian', () => {
    const fiji = label('Fiji', -17, 179);
    const samoa = label('Samoa', -17, -179);
    const spain = label('Spain', -17, 0);

    it('a region centred at 180 sees labels at 179 and -179', () => {
      const r = region(-17, 180, 5, 20);
      expect(names(visibleLabels([fiji, samoa, spain], r, 10, W)).sort()).toEqual(['Fiji', 'Samoa']);
    });

    it('a region centred at -179.5 sees a label at 179', () => {
      const r = region(-17, -179.5, 5, 20);
      expect(names(visibleLabels([fiji, samoa], r, 10, W)).sort()).toEqual(['Fiji', 'Samoa']);
    });

    it('a region centred at 179.5 sees a label at -179', () => {
      const r = region(-17, 179.5, 5, 20);
      expect(names(visibleLabels([fiji, samoa], r, 10, W)).sort()).toEqual(['Fiji', 'Samoa']);
    });

    it('still hides labels on the far side of the world', () => {
      const r = region(-17, 180, 5, 20);
      expect(names(visibleLabels([spain], r, 10, W))).toEqual([]);
    });

    it('a region centred at 0 does not see labels at +-179', () => {
      const r = region(-17, 0, 5, 20);
      expect(names(visibleLabels([fiji, samoa, spain], r, 10, W))).toEqual(['Spain']);
    });

    it('accepts an unwrapped region centre (540 is the same as 180)', () => {
      const r = region(-17, 540, 5, 20);
      expect(names(visibleLabels([fiji, samoa, spain], r, 10, W)).sort()).toEqual(['Fiji', 'Samoa']);
    });
  });

  describe('whole world', () => {
    // minZoom -1: a span above 360 degrees is a negative zoom, so labels must allow it.
    const all = [label('A', 0, -170, -1), label('B', 0, 0, -1), label('C', 0, 170, -1), label('D', 0, 180, -1)];

    it('longitudeDelta 360 shows every label in latitude range, whatever the centre', () => {
      const r: LabelRegion = { latitude: 0, longitude: 100, latitudeDelta: 100, longitudeDelta: 360 };
      expect(names(visibleLabels(all, r, 10, 256)).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('longitudeDelta above 360 also counts as the whole world', () => {
      const r: LabelRegion = { latitude: 0, longitude: -120, latitudeDelta: 100, longitudeDelta: 500 };
      expect(names(visibleLabels(all, r, 10, 256)).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('still filters by latitude', () => {
      const r: LabelRegion = { latitude: 0, longitude: 0, latitudeDelta: 10, longitudeDelta: 360 };
      expect(names(visibleLabels([...all, label('North', 60, 0, -1)], r, 10, 256)).sort()).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('ordering and cap', () => {
    const r = region(0, 0, 5, 40);
    const set = [
      label('Zeta', 0, 1, 3),
      label('Alpha', 0, 2, 3),
      label('Big', 0, 3, 1),
      label('Medium', 0, 4, 2),
      label('Small', 0, 5, 4.5),
    ];

    it('puts the most prominent (lowest minZoom) first, ties by name', () => {
      expect(names(visibleLabels(set, r, 10, W))).toEqual(['Big', 'Medium', 'Alpha', 'Zeta', 'Small']);
    });

    it('caps the result at maxCount, keeping the most prominent', () => {
      expect(names(visibleLabels(set, r, 3, W))).toEqual(['Big', 'Medium', 'Alpha']);
      expect(names(visibleLabels(set, r, 1, W))).toEqual(['Big']);
    });

    it('returns everything when maxCount is larger than the matches', () => {
      expect(visibleLabels(set, r, 100, W)).toHaveLength(5);
    });

    it('returns nothing for maxCount 0 or negative', () => {
      expect(visibleLabels(set, r, 0, W)).toEqual([]);
      expect(visibleLabels(set, r, -4, W)).toEqual([]);
    });

    it('is deterministic regardless of input order', () => {
      expect(visibleLabels([...set].reverse(), r, 10, W)).toEqual(visibleLabels(set, r, 10, W));
    });

    it('does not mutate the input array', () => {
      const copy = [...set];
      visibleLabels(set, r, 10, W);
      expect(set).toEqual(copy);
    });
  });

  it('uses the default 400 dp width when none is given', () => {
    const l = label('X', 0, 0, 3, 3.5);
    const r: LabelRegion = { latitude: 0, longitude: 0, latitudeDelta: 10, longitudeDelta: (360 * 400) / (256 * 2 ** 3.2) };
    expect(names(visibleLabels([l], r, 10))).toEqual(['X']);
  });
});
