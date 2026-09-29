/**
 * Reads and validates everything under `conferences/` and `site/`.
 *
 * This runs at build time only (Node fs). Pages import the helpers here rather
 * than reading files themselves, so there is exactly one place where content is
 * parsed and exactly one place where it is validated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { z } from 'zod';

import {
  announcementsFileSchema,
  committeeSchema,
  conferenceSchema,
  datesFileSchema,
  keynotesFileSchema,
  linksSchema,
  postersFileSchema,
  programSchema,
  siteSchema,
  sponsorsSchema,
  workshopsFileSchema,
  type Announcement,
  type Committee,
  type Conference,
  type ImportantDate,
  type Keynote,
  type Links,
  type Program,
  type SiteData,
  type Sponsors,
} from './schema';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const conferencesDir = path.join(projectRoot, 'conferences');
export const siteDir = path.join(projectRoot, 'site');
export const publicDir = path.join(projectRoot, 'public');

/** Thrown with a readable, file-anchored message when content is malformed. */
export class ContentError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`${file}\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length ? issue.path.join('.') : '(root)';
    return `${where}: ${issue.message}`;
  });
}

/**
 * Parse one YAML file against a schema.
 *
 * A missing file is not an error: it yields `fallback`, so a new conference
 * directory can grow one file at a time.
 */
export function readYaml<T extends z.ZodTypeAny>(
  file: string,
  schema: T,
  fallback: unknown,
): z.infer<T> {
  let raw: unknown = fallback;
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    try {
      raw = YAML.parse(text) ?? fallback;
    } catch (error) {
      throw new ContentError(relative(file), [
        `YAML is not parseable: ${(error as Error).message}`,
      ]);
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(relative(file), formatIssues(result.error));
  }
  return result.data;
}

export function relative(file: string): string {
  return path.relative(projectRoot, file) || file;
}

/** Everything known about one edition of ISPASS. */
export interface ConferenceData {
  year: number;
  dir: string;
  conference: Conference;
  dates: ImportantDate[];
  committee: Committee;
  sponsors: Sponsors;
  keynotes: Keynote[];
  program: Program;
  announcements: Announcement[];
  links: Links;
  posters: z.infer<typeof postersFileSchema>;
  workshops: z.infer<typeof workshopsFileSchema>;
}

export function conferenceYears(): number[] {
  if (!fs.existsSync(conferencesDir)) return [];
  return fs
    .readdirSync(conferencesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .sort((a, b) => b - a);
}

/**
 * Parsed conferences, keyed by year.
 *
 * Disabled in dev: the cache would hold a stale copy after a YAML edit, and the
 * dev server has no way to know this module depends on files outside src/. The
 * watcher in astro.config.mjs triggers the reload; this makes the reload
 * actually pick up the new content.
 */
const cache = new Map<number, ConferenceData>();
const useCache = !import.meta.env?.DEV;

export function loadConference(year: number): ConferenceData {
  const cached = useCache ? cache.get(year) : undefined;
  if (cached) return cached;

  const dir = path.join(conferencesDir, String(year));
  if (!fs.existsSync(dir)) {
    throw new ContentError(`conferences/${year}`, ['directory does not exist']);
  }
  const at = (name: string) => path.join(dir, name);

  const conference = readYaml(at('conference.yaml'), conferenceSchema, undefined);
  if (conference.year !== year) {
    throw new ContentError(relative(at('conference.yaml')), [
      `year: is ${conference.year} but the directory is named ${year}`,
    ]);
  }

  const data: ConferenceData = {
    year,
    dir,
    conference,
    dates: readYaml(at('dates.yaml'), datesFileSchema, []),
    committee: readYaml(at('committee.yaml'), committeeSchema, {}),
    sponsors: readYaml(at('sponsors.yaml'), sponsorsSchema, {}),
    keynotes: readYaml(at('keynotes.yaml'), keynotesFileSchema, []),
    program: readYaml(at('program.yaml'), programSchema, {}),
    announcements: readYaml(at('announcements.yaml'), announcementsFileSchema, []),
    links: readYaml(at('links.yaml'), linksSchema, {}),
    posters: readYaml(at('posters.yaml'), postersFileSchema, {}),
    workshops: readYaml(at('workshops.yaml'), workshopsFileSchema, {}),
  };

  if (useCache) cache.set(year, data);
  return data;
}

export function loadAllConferences(): ConferenceData[] {
  return conferenceYears().map(loadConference);
}

let siteCache: SiteData | null = null;

export function loadSite(): SiteData {
  if (useCache && siteCache) return siteCache;
  siteCache = readYaml(path.join(siteDir, 'ispass.yaml'), siteSchema, undefined);
  return siteCache;
}

/* ------------------------------------------------------------------ */
/* Derived views used by more than one page                            */
/* ------------------------------------------------------------------ */

/** Public dates only, chronological, with undated entries last. */
export function visibleDates(data: ConferenceData): ImportantDate[] {
  return data.dates
    .filter((d) => !d.hidden)
    .slice()
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });
}

/** Newest first. */
export function sortedAnnouncements(data: ConferenceData): Announcement[] {
  return data.announcements.slice().sort((a, b) => b.date.localeCompare(a.date));
}

/** A single date row by id, for pages that need to name one deadline. */
export function findDate(data: ConferenceData, id: string): ImportantDate | undefined {
  return data.dates.find((d) => d.id === id);
}

/** True when the program has at least one real session. */
export function hasProgram(data: ConferenceData): boolean {
  return data.program.days.some((day) => day.slots.length > 0);
}

export function hasKeynotes(data: ConferenceData): boolean {
  return data.keynotes.some((k) => !k.placeholder);
}

/** True once at least one real (non-placeholder) sponsor is confirmed. */
export function hasSponsors(data: ConferenceData): boolean {
  return data.sponsors.tiers.some((t) => t.sponsors.some((s) => !s.placeholder));
}

/** True when there is anything to draw in a sponsor grid, placeholders included. */
export function hasSponsorSlots(data: ConferenceData): boolean {
  return data.sponsors.tiers.some((t) => t.sponsors.length > 0);
}
