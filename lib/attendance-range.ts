// Date filters use Malaysian work dates. Include boundary punches for overnight shifts.
export function attendanceRange(params = new URLSearchParams(), today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) {
  const end = params.get('to') || today;
  const start = params.get('from') || shiftDate(end, -31);
  for (const date of [start, end]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw new Error('Select valid attendance dates.');
    }
  }
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days < 0 || days > 62) throw new Error('Select an attendance range of up to 63 days.');
  return {
    start, end,
    from: new Date(shiftDate(start, -1) + 'T00:00:00+08:00').toISOString(),
    until: new Date(shiftDate(end, 2) + 'T00:00:00+08:00').toISOString(),
  };
}
function shiftDate(date: string, days: number) {
  const instant = Date.parse(date);
  if (!Number.isFinite(instant)) throw new Error('Select valid attendance dates.');
  return new Date(instant + days * 86400000).toISOString().slice(0, 10);
}
