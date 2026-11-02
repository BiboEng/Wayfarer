/**
 * The places narrated today, so none repeats on the same day. Pure: no React or Expo imports.
 * Keyed by the local date; a new date starts an empty list.
 */

export interface VisitedDay {
  /** Local date, YYYY-MM-DD. */
  date: string;
  ids: string[];
}

/** Local calendar date of an epoch-ms time, YYYY-MM-DD. */
export function localDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyDay(date: string): VisitedDay {
  return { date, ids: [] };
}

/** The list for `today`: the stored one if it is from today, otherwise a fresh one. */
export function visitedForDay(stored: VisitedDay | null, today: string): VisitedDay {
  return stored && stored.date === today ? stored : emptyDay(today);
}

export function addVisited(day: VisitedDay, id: string): VisitedDay {
  return day.ids.includes(id) ? day : { date: day.date, ids: [...day.ids, id] };
}

/** Parses the stored JSON; anything malformed counts as nothing stored. */
export function parseVisitedDay(raw: string | null): VisitedDay | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { date, ids } = value as Record<string, unknown>;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids)) return null;
    return { date, ids: ids.filter((id): id is string => typeof id === 'string') };
  } catch {
    return null;
  }
}
