/**
 * Calendar feed for a year's important dates: /2027/dates.ics
 *
 * Generated from dates.yaml, so the calendar can never drift from the website.
 * A deadline with a clock time becomes a 15-minute reminder event at that
 * instant; an all-day deadline or a range becomes an all-day event.
 *
 * Per-date download links append `?d=<id>`; static hosting serves the same file
 * and the query string is ignored, so a reader always gets a valid calendar.
 * Filtering a single date would require a server, which this site does not use.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { conferenceYears, loadConference, visibleDates } from '../../lib/conferences';
import { deadlineInstant, icsDate, icsUtc, nextDay } from '../../lib/dates';
import type { ImportantDate } from '../../lib/schema';
import { siteConfig } from '../../lib/site-config.mjs';

export const getStaticPaths = (() =>
  conferenceYears().map((year) => ({ params: { year: String(year) } }))) satisfies GetStaticPaths;

/** RFC 5545 escaping for TEXT values. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** RFC 5545 requires lines of at most 75 octets, continued with a leading space. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    chunks.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join('\r\n');
}

function event(entry: ImportantDate, shortName: string, year: number, stamp: string, pageUrl: string): string[] {
  const uid = `${entry.id}-${year}@ispass.org`;
  const summary = `${shortName}: ${entry.name}`;
  const description = [
    entry.note,
    entry.extended ? 'This deadline was extended.' : null,
    `Timezone as published: ${entry.timezone}`,
    pageUrl,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    fold(`SUMMARY:${escapeText(summary)}`),
    fold(`DESCRIPTION:${escapeText(description)}`),
    `URL:${pageUrl}`,
    'TRANSP:TRANSPARENT',
  ];

  if (entry.time) {
    // A timed deadline: a 15-minute marker ending at the deadline instant.
    const end = deadlineInstant(entry)!;
    const start = new Date(end.getTime() - 15 * 60 * 1000);
    lines.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(end)}`);
  } else {
    // All-day. DTEND is exclusive in RFC 5545.
    const startDay = entry.date!;
    const endDay = nextDay(entry.end_date ?? startDay);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(startDay)}`, `DTEND;VALUE=DATE:${icsDate(endDay)}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

export const GET: APIRoute = ({ params, site }) => {
  const year = Number(params.year);
  const c = loadConference(year);
  const stamp = icsUtc(new Date());
  const pageUrl = new URL(`${siteConfig.base.replace(/\/$/, '')}/${year}/dates/`, site ?? siteConfig.origin).href;

  const entries = visibleDates(c).filter((entry) => entry.date);

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//ISPASS//${c.conference.short_name}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escapeText(`${c.conference.short_name} important dates`)}`),
    ...entries.flatMap((entry) => event(entry, c.conference.short_name, year, stamp, pageUrl)),
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(`${body}\r\n`, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="ispass-${year}-dates.ics"`,
    },
  });
};
