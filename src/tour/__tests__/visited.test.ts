import { addVisited, emptyDay, localDateKey, parseVisitedDay, visitedForDay } from '../visited';

describe('localDateKey', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 0, 5, 14, 30).getTime())).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 8, 0).getTime())).toBe('2026-12-31');
  });

  it('changes exactly at local midnight', () => {
    expect(localDateKey(new Date(2026, 5, 10, 23, 59, 59, 999).getTime())).toBe('2026-06-10');
    expect(localDateKey(new Date(2026, 5, 11, 0, 0, 0, 0).getTime())).toBe('2026-06-11');
  });

  it('rolls over month and year ends', () => {
    expect(localDateKey(new Date(2026, 0, 31, 23, 59).getTime() + 2 * 60_000)).toBe('2026-02-01');
    expect(localDateKey(new Date(2026, 11, 31, 23, 59).getTime() + 2 * 60_000)).toBe('2027-01-01');
  });
});

describe('visitedForDay', () => {
  const stored = { date: '2026-06-10', ids: ['a', 'b'] };

  it("keeps today's stored list", () => {
    expect(visitedForDay(stored, '2026-06-10')).toBe(stored);
  });

  it("starts a fresh list when the stored one is from another day (it resets after midnight)", () => {
    expect(visitedForDay(stored, '2026-06-11')).toEqual({ date: '2026-06-11', ids: [] });
  });

  it('starts a fresh list when nothing is stored', () => {
    expect(visitedForDay(null, '2026-06-10')).toEqual(emptyDay('2026-06-10'));
  });
});

describe('addVisited', () => {
  it('adds an id once', () => {
    const day = addVisited(addVisited(emptyDay('2026-06-10'), 'a'), 'a');
    expect(day.ids).toEqual(['a']);
  });

  it('does not change the input', () => {
    const day = emptyDay('2026-06-10');
    addVisited(day, 'a');
    expect(day.ids).toEqual([]);
  });
});

describe('parseVisitedDay', () => {
  it('reads a valid list', () => {
    expect(parseVisitedDay('{"date":"2026-06-10","ids":["a","b"]}')).toEqual({ date: '2026-06-10', ids: ['a', 'b'] });
  });

  it.each([null, '', 'not json', '[]', '"x"', '42', 'null', '{}', '{"date":"2026-06-10"}', '{"ids":[]}', '{"date":"yesterday","ids":[]}', '{"date":1,"ids":[]}'])(
    'treats %p as nothing stored',
    (raw) => {
      expect(parseVisitedDay(raw)).toBeNull();
    },
  );

  it('drops ids that are not strings', () => {
    expect(parseVisitedDay('{"date":"2026-06-10","ids":["a",1,null,"b"]}')?.ids).toEqual(['a', 'b']);
  });
});
