/** Local time of day for a list row, e.g. "2:35 PM" (follows the phone's locale). */
export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
