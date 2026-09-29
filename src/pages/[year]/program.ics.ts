/**
 * Calendar feed for the technical program: /2027/program.ics
 *
 * One VEVENT per session, with the room as LOCATION and the paper list in the
 * description, so an attendee can put the whole conference in their calendar.
 * Times are emitted as floating local times with a VTIMEZONE-free
 * `TZID`-less DTSTART in the conference's own wall clock, which every major
 * client interprets as local time — correct behaviour for a schedule that is
 * only ever read on site.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { conferenceYears, loadConference } from '../../lib/conferences';
import { icsLocal, icsUtc } from '../../lib/dates';
import { siteConfig } from '../../lib/site-config.mjs';

export const getStaticPaths = (() =>
  conferenceYears().map((year) => ({ params: { year: String(year) } }))) satisfies GetStaticPaths;

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

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

export const GET: APIRoute = ({ params, site }) => {
  const year = Number(params.year);
  const c = loadConference(year);
  const stamp = icsUtc(new Date());
  const programUrl = new URL(`${siteConfig.base.replace(/\/$/, '')}/${year}/program/`, site ?? siteConfig.origin).href;

  const events = c.program.days.flatMap((day) =>
    day.slots.flatMap((slot) =>
      slot.sessions.map((session) => {
        const description = [
          session.chair ? `Chair: ${session.chair}` : null,
          session.speaker ? `Speaker: ${session.speaker}` : null,
          session.description,
          ...session.papers.map((paper) => `• ${paper.title}`),
          `${programUrl}#session-${session.id}`,
        ]
          .filter(Boolean)
          .join('\n');

        return [
          'BEGIN:VEVENT',
          `UID:${session.id}-${year}@ispass.org`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${icsLocal(day.date, session.start)}`,
          `DTEND:${icsLocal(day.date, session.end)}`,
          fold(`SUMMARY:${escapeText(session.title)}`),
          session.room ? fold(`LOCATION:${escapeText(session.room)}`) : null,
          fold(`DESCRIPTION:${escapeText(description)}`),
          `URL:${programUrl}#session-${session.id}`,
          'END:VEVENT',
        ].filter((line): line is string => line !== null);
      }),
    ),
  );

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//ISPASS//${c.conference.short_name} program//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escapeText(`${c.conference.short_name} program`)}`),
    `X-WR-TIMEZONE:${c.program.timezone}`,
    ...events.flat(),
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(`${body}\r\n`, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="ispass-${year}-program.ics"`,
    },
  });
};
