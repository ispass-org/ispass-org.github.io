/**
 * Date formatting and deadline arithmetic.
 *
 * All conference dates are stored as plain `YYYY-MM-DD` strings plus an
 * optional `HH:MM` and an IANA timezone, so nothing depends on the timezone of
 * the machine that runs the build.
 */
import type { ImportantDate } from './schema';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TBD = 'TBD';

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** `2027-04-26` -> `April 26, 2027`. */
export function formatDate(iso: string | null): string {
  if (!iso) return TBD;
  const { y, m, d } = parts(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** `2027-04-26` -> `Mon, Apr 26`. Used where space is tight. */
export function formatDateShort(iso: string | null): string {
  if (!iso) return TBD;
  const { y, m, d } = parts(iso);
  return `${MONTHS[m - 1]!.slice(0, 3)} ${d}, ${y}`;
}

/** `2027-04-26` -> `Monday`. */
export function weekdayName(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return WEEKDAYS[date.getUTCDay()]!;
}

/**
 * A human range: `April 26–28, 2027`, collapsing shared month and year.
 * Either end may be missing, in which case the known end is returned alone.
 */
export function formatDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso && !endIso) return TBD;
  if (!startIso) return formatDate(endIso);
  if (!endIso || startIso === endIso) return formatDate(startIso);

  const a = parts(startIso);
  const b = parts(endIso);
  if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}, ${a.y}`;
  if (a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`;
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

/** The time-with-timezone suffix shown next to a deadline, e.g. `23:59 AoE`. */
export function formatTime(entry: Pick<ImportantDate, 'time' | 'timezone'>): string | null {
  if (!entry.time) return null;
  return `${entry.time} ${entry.timezone}`;
}

/**
 * Offset in minutes for a timezone at a given instant.
 * `AoE` (Anywhere on Earth) is UTC-12 and has no daylight saving.
 */
function offsetMinutes(timeZone: string, at: Date): number {
  if (timeZone === 'AoE') return -12 * 60;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour) % 24, Number(map.minute), Number(map.second),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * The exact instant a deadline expires, as a UTC Date.
 * All-day entries expire at the end of the day in their timezone.
 */
export function deadlineInstant(entry: ImportantDate): Date | null {
  const iso = entry.end_date ?? entry.date;
  if (!iso) return null;
  // A range without an explicit time runs to the end of its final day.
  const time = entry.end_date && !entry.time ? '23:59' : (entry.time ?? '23:59');
  const { y, m, d } = parts(iso);
  const [hh, mm] = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hh!, mm!);
  // Two passes so a deadline that falls on a DST transition resolves correctly:
  // the first pass picks an approximate instant, the second uses the offset
  // that actually applies at that instant.
  let instant = new Date(wallClockAsUtc - offsetMinutes(entry.timezone, new Date(wallClockAsUtc)) * 60000);
  instant = new Date(wallClockAsUtc - offsetMinutes(entry.timezone, instant) * 60000);
  return instant;
}

export type DateStatus = 'past' | 'next' | 'upcoming' | 'unscheduled';

/** Whether a deadline has already passed, relative to `now`. */
export function isPast(entry: ImportantDate, now: Date = new Date()): boolean {
  const instant = deadlineInstant(entry);
  return instant !== null && instant.getTime() < now.getTime();
}

/**
 * Classify a chronological list: everything past is `past`, the first future
 * entry is `next`, the rest are `upcoming`, and undated entries `unscheduled`.
 */
export function classifyDates(
  entries: ImportantDate[],
  now: Date = new Date(),
): Array<{ entry: ImportantDate; status: DateStatus }> {
  let seenNext = false;
  return entries.map((entry) => {
    if (!entry.date) return { entry, status: 'unscheduled' as const };
    if (isPast(entry, now)) return { entry, status: 'past' as const };
    if (!seenNext) {
      seenNext = true;
      return { entry, status: 'next' as const };
    }
    return { entry, status: 'upcoming' as const };
  });
}

/** `2027-04-26` + `09:30` -> `20270426T093000` for an ICS local-time value. */
export function icsLocal(iso: string, time: string): string {
  return `${iso.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/** A UTC instant in ICS form: `20270426T133000Z`. */
export function icsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** `2027-04-26` -> `20270426`, for all-day ICS values. */
export function icsDate(iso: string): string {
  return iso.replace(/-/g, '');
}

/** The day after `iso`, used for exclusive ICS all-day end dates. */
export function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A reader-friendly timezone name: "Eastern Daylight Time" for an IANA id,
 * "AoE" left as is. `iso` picks the offset in force (standard vs daylight).
 */
export function timezoneLabel(zone: string, iso: string | null = null): string {
  if (zone === 'AoE') return zone;
  try {
    const at = new Date(`${iso ?? '2000-01-01'}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts(at);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? zone.replace(/_/g, ' ');
  } catch {
    return zone.replace(/_/g, ' ');
  }
}
