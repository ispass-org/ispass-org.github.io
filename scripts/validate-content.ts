#!/usr/bin/env tsx
/**
 * `npm run validate`
 *
 * Fails loudly when conference content is malformed. Run before every build
 * (`npm run build` does this for you) and in CI.
 *
 * What it checks, beyond the zod schemas:
 *   - duplicate ids within a file (dates, keynotes, sessions, announcements)
 *   - Markdown slugs that collide with each other or with a reserved route
 *   - internal links pointing at pages that do not exist
 *   - referenced local assets (logos, photos) that are missing from public/
 *   - program days that fall outside the announced conference dates
 *   - sample program data still switched on once the program is published
 *   - the literal string "TBD" typed into a field that should be null
 *
 * Exit code 1 on any error. Warnings do not fail the build.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import {
  ContentError,
  conferenceYears,
  loadConference,
  loadSite,
  projectRoot,
  publicDir,
  relative,
  type ConferenceData,
} from '../src/lib/conferences';
import { phaseAtLeast } from '../src/lib/phase';
import { pageFrontmatterSchema } from '../src/lib/schema';

/* ------------------------------------------------------------------ */

const errors: string[] = [];
const warnings: string[] = [];

const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);
const warn = (where: string, message: string) => warnings.push(`${where}: ${message}`);

/** Routes that a Markdown slug must not shadow, because a template owns them. */
const RESERVED_SLUGS = new Set([
  'committee',
  'dates',
  'keynotes',
  'program',
  'sponsors',
  'news',
  'accepted-posters',
  'workshops',
  'index',
]);

/* ------------------------------------------------------------------ */
/* Markdown frontmatter                                                */
/* ------------------------------------------------------------------ */

interface MarkdownPage {
  file: string;
  slug: string;
  data: ReturnType<typeof pageFrontmatterSchema.parse>;
  body: string;
}

/** Minimal frontmatter split. Astro does the real parse; this mirrors it. */
function readMarkdown(file: string): { frontmatter: unknown; body: string } | null {
  const text = fs.readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return null;
  return { frontmatter: YAML.parse(match[1]!), body: match[2] ?? '' };
}

function collectMarkdown(dir: string): MarkdownPage[] {
  if (!fs.existsSync(dir)) return [];
  const pages: MarkdownPage[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/\.mdx?$/.test(name)) continue;
    const file = path.join(dir, name);
    const parsed = readMarkdown(file);
    if (!parsed) {
      fail(relative(file), 'has no YAML frontmatter block');
      continue;
    }
    const result = pageFrontmatterSchema.safeParse(parsed.frontmatter);
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail(relative(file), `frontmatter ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    pages.push({
      file,
      slug: result.data.slug ?? name.replace(/\.mdx?$/, ''),
      data: result.data,
      body: parsed.body,
    });
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let body = match[1]!;
  if (body.length === 3) body = body.split('').map((ch) => ch + ch).join('');
  const channels = (body.match(/../g) ?? []).map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastWithWhite(hex: string): number | null {
  const luminance = relativeLuminance(hex);
  if (luminance === null) return null;
  return 1.05 / (luminance + 0.05);
}

/**
 * The per-edition accent is used for link text and for button backgrounds on a
 * white page, and the dark theme derives its accent by lightening this one. A
 * seed that is too light fails contrast in light mode and cannot be rescued.
 */
function checkAccent(where: string, accent: string): void {
  const ratio = contrastWithWhite(accent);
  if (ratio === null) {
    fail(where, `accent: "${accent}" is not a #rgb or #rrggbb colour`);
    return;
  }
  if (ratio < 4.5) {
    fail(
      where,
      `accent: "${accent}" has only ${ratio.toFixed(2)}:1 contrast against white, ` +
        'but it is used as link text. Pick a darker colour (WCAG AA needs 4.5:1)',
    );
  } else if (ratio < 5.5) {
    warn(
      where,
      `accent: "${accent}" is close to the contrast limit (${ratio.toFixed(2)}:1 against white)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

function checkDuplicateIds(where: string, label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(where, `duplicate ${label} id "${id}"`);
    seen.add(id);
  }
}

/** Catches "TBD" typed into a field whose unknown value should be `null`. */
function checkNoLiteralTbd(file: string): void {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  raw.split(/\r?\n/).forEach((line, index) => {
    if (line.trimStart().startsWith('#')) return;
    if (/:\s*["']?TB[DA]["']?\s*(#.*)?$/i.test(line)) {
      fail(
        `${relative(file)}:${index + 1}`,
        'a literal "TBD"/"TBA" was written as a value. Use null (or ~) instead — the site shows unknown values for you (dates as TBA)',
      );
    }
  });
}

/** A local asset path must resolve to a file under public/. */
function checkAsset(where: string, field: string, value: string | null): void {
  if (!value || /^https?:/.test(value)) return;
  if (!value.startsWith('/')) {
    fail(where, `${field}: "${value}" must be a site-absolute path starting with /`);
    return;
  }
  const onDisk = path.join(publicDir, value.replace(/^\//, ''));
  if (!fs.existsSync(onDisk)) {
    fail(where, `${field}: "${value}" does not exist (looked for public${value})`);
  }
}

function checkConference(year: number, knownRoutes: Set<string>): ConferenceData | null {
  let c: ConferenceData;
  try {
    c = loadConference(year);
  } catch (error) {
    if (error instanceof ContentError) {
      for (const issue of error.issues) fail(error.file, issue);
    } else {
      fail(`conferences/${year}`, (error as Error).message);
    }
    return null;
  }

  const dir = c.dir;
  const at = (name: string) => relative(path.join(dir, name));

  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.yaml') || name.endsWith('.yml')) {
      checkNoLiteralTbd(path.join(dir, name));
    }
  }

  checkAccent(at('conference.yaml'), c.conference.accent);

  /* --- ids ---------------------------------------------------------- */
  checkDuplicateIds(at('dates.yaml'), 'date', c.dates.map((d) => d.id));
  checkDuplicateIds(at('keynotes.yaml'), 'keynote', c.keynotes.map((k) => k.id));
  checkDuplicateIds(at('announcements.yaml'), 'announcement', c.announcements.map((a) => a.id));
  checkDuplicateIds(
    at('program.yaml'),
    'session',
    c.program.days.flatMap((day) => day.slots.flatMap((slot) => slot.sessions.map((s) => s.id))),
  );
  checkDuplicateIds(at('workshops.yaml'), 'workshop', c.workshops.items.map((w) => w.id));

  /* --- dates -------------------------------------------------------- */
  for (const entry of c.dates) {
    if (entry.end_date && entry.date && entry.end_date < entry.date) {
      fail(at('dates.yaml'), `"${entry.id}": end_date is before date`);
    }
    if (entry.time && !entry.date) {
      warn(at('dates.yaml'), `"${entry.id}": has a time but no date`);
    }
    if (entry.extended && !entry.note) {
      warn(
        at('dates.yaml'),
        `"${entry.id}": is marked extended but has no note saying what it was extended from`,
      );
    }
  }

  /* --- conference span --------------------------------------------- */
  const { start_date: start, end_date: end } = c.conference;
  if (start && end && end < start) {
    fail(at('conference.yaml'), 'end_date is before start_date');
  }
  if (end && !start) fail(at('conference.yaml'), 'end_date is set but start_date is not');

  /* --- program ------------------------------------------------------ */
  let emptyPaperSessions = 0;
  for (const day of c.program.days) {
    if (start && end && (day.date < start || day.date > end)) {
      warn(
        at('program.yaml'),
        `day ${day.date} falls outside the conference dates (${start} to ${end})`,
      );
    }
    for (const slot of day.slots) {
      if (slot.end <= slot.start) {
        fail(at('program.yaml'), `slot ${day.date} ${slot.start}-${slot.end} ends before it starts`);
      }
      for (const session of slot.sessions) {
        if (session.end <= session.start) {
          fail(at('program.yaml'), `session "${session.id}" ends before it starts`);
        }
        if (session.kind === 'papers' && session.papers.length === 0) emptyPaperSessions += 1;
        for (const paper of session.papers) {
          if (paper.authors.length === 0) {
            warn(at('program.yaml'), `paper "${paper.title}" has no authors`);
          }
        }
      }
    }
  }

  if (emptyPaperSessions > 0) {
    // One reminder rather than one line per slot: an empty skeleton is a normal
    // state until paper notification, but it must not survive to publication.
    const report = phaseAtLeast(c.conference.phase, 'program_published') ? fail : warn;
    report(
      at('program.yaml'),
      `${emptyPaperSessions} paper session${emptyPaperSessions === 1 ? ' has' : 's have'} no papers yet`,
    );
  }

  if (c.program.sample && phaseAtLeast(c.conference.phase, 'program_published')) {
    fail(
      at('program.yaml'),
      `the conference phase is "${c.conference.phase}" but the program is still marked "sample: true". ` +
        'Replace the example schedule with the real one and set sample: false',
    );
  }
  if (c.program.sample && c.program.days.length > 0) {
    warn(at('program.yaml'), 'still contains the shipped sample schedule');
  }

  /* --- assets ------------------------------------------------------- */
  for (const keynote of c.keynotes) {
    checkAsset(at('keynotes.yaml'), `keynote "${keynote.id}" photo`, keynote.photo);
    if (keynote.photo && !keynote.photo_alt) {
      fail(at('keynotes.yaml'), `keynote "${keynote.id}": photo is set but photo_alt is missing`);
    }
    if (!keynote.placeholder && !keynote.speaker) {
      fail(
        at('keynotes.yaml'),
        `keynote "${keynote.id}": is not a placeholder but has no speaker. Set placeholder: true or fill in the speaker`,
      );
    }
  }
  let sponsorSlots = 0;
  for (const tier of c.sponsors.tiers) {
    for (const sponsor of tier.sponsors) {
      if (sponsor.placeholder) {
        sponsorSlots += 1;
        // A slot carrying a logo or link was probably meant to be a real
        // sponsor, and would silently render as an empty tile.
        if (sponsor.logo || sponsor.url) {
          fail(
            at('sponsors.yaml'),
            `"${sponsor.name}" in tier "${tier.tier}" is marked placeholder: true but has a logo or url. ` +
              'Remove placeholder: true if this is a confirmed sponsor',
          );
        }
        continue;
      }
      checkAsset(at('sponsors.yaml'), `sponsor "${sponsor.name}" logo`, sponsor.logo);
    }
  }
  if (sponsorSlots > 0) {
    warn(
      at('sponsors.yaml'),
      `${sponsorSlots} placeholder sponsor slot${sponsorSlots === 1 ? '' : 's'} still present`,
    );
  }

  /* --- placeholders left live -------------------------------------- */
  const placeholders = c.announcements.filter((a) => a.placeholder).length;
  if (placeholders > 0) {
    warn(
      at('announcements.yaml'),
      `${placeholders} placeholder announcement${placeholders === 1 ? '' : 's'} still present`,
    );
  }

  /* --- Markdown ----------------------------------------------------- */
  const pages = collectMarkdown(dir);
  const slugs = new Set<string>();
  for (const page of pages) {
    if (RESERVED_SLUGS.has(page.slug)) {
      fail(
        relative(page.file),
        `slug "${page.slug}" collides with a built-in page. Rename the file or set a different slug:`,
      );
    }
    if (slugs.has(page.slug)) {
      fail(relative(page.file), `slug "${page.slug}" is used by more than one file`);
    }
    slugs.add(page.slug);
    knownRoutes.add(`/${year}/${page.slug}/`);
    if (!page.data.description) {
      warn(relative(page.file), 'has no description; search engines will invent a snippet');
    }
  }

  for (const slug of RESERVED_SLUGS) {
    if (slug !== 'index') knownRoutes.add(`/${year}/${slug}/`);
  }
  knownRoutes.add(`/${year}/`);
  knownRoutes.add(`/${year}/dates.ics`);
  knownRoutes.add(`/${year}/program.ics`);

  return c;
}

/** Internal links in Markdown bodies and in YAML must resolve to a real page. */
function checkInternalLinks(year: number, knownRoutes: Set<string>): void {
  const c = loadConference(year);
  const pages = collectMarkdown(c.dir);

  const check = (where: string, href: string) => {
    if (!href.startsWith('/')) return;
    const target = href.split('#')[0]!.split('?')[0]!;
    if (target === '') return;
    const normalised = target.endsWith('/') || target.includes('.') ? target : `${target}/`;
    if (knownRoutes.has(normalised)) return;
    // A file under public/ is also a valid internal target.
    if (fs.existsSync(path.join(publicDir, normalised.replace(/^\//, '')))) return;
    fail(where, `internal link "${href}" does not match any page on this site`);
  };

  for (const page of pages) {
    for (const match of page.body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
      check(relative(page.file), match[1]!);
    }
  }
  for (const announcement of c.announcements) {
    if (announcement.link) {
      check(`${relative(c.dir)}/announcements.yaml`, announcement.link);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Evergreen layer                                                     */
/* ------------------------------------------------------------------ */

function checkSite(knownRoutes: Set<string>): void {
  let site: ReturnType<typeof loadSite>;
  try {
    site = loadSite();
  } catch (error) {
    if (error instanceof ContentError) {
      for (const issue of error.issues) fail(error.file, issue);
    } else {
      fail('site/ispass.yaml', (error as Error).message);
    }
    return;
  }

  checkNoLiteralTbd(path.join(projectRoot, 'site', 'ispass.yaml'));

  const years = conferenceYears();
  if (!years.includes(site.current_year)) {
    fail(
      'site/ispass.yaml',
      `current_year is ${site.current_year} but there is no conferences/${site.current_year}/ directory`,
    );
  }

  const seen = new Set<number>();
  for (const edition of site.past_conferences) {
    if (seen.has(edition.year)) fail('site/ispass.yaml', `past_conferences lists ${edition.year} twice`);
    seen.add(edition.year);
    if (edition.year >= site.current_year) {
      warn(
        'site/ispass.yaml',
        `past_conferences includes ${edition.year}, which is not earlier than current_year`,
      );
    }
  }

  for (const page of collectMarkdown(path.join(projectRoot, 'site'))) {
    knownRoutes.add(`/${page.slug}/`);
  }
  for (const route of ['/', '/previous/', '/policies/', '/steering-committee/', '/404/']) {
    knownRoutes.add(route);
  }
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

function main(): void {
  const years = conferenceYears();
  if (years.length === 0) {
    fail('conferences/', 'no conference directories found');
  }

  const knownRoutes = new Set<string>();
  checkSite(knownRoutes);

  const loaded: number[] = [];
  for (const year of years) {
    if (checkConference(year, knownRoutes)) loaded.push(year);
  }
  // Links are checked in a second pass, once every route is known.
  for (const year of loaded) checkInternalLinks(year, knownRoutes);

  const label = `${years.length} conference${years.length === 1 ? '' : 's'} (${years.join(', ')})`;

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
    for (const message of warnings) console.log(`  ! ${message}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const message of errors) console.error(`  ✗ ${message}`);
    console.error(`\nContent validation FAILED. Nothing was built.\n`);
    process.exit(1);
  }

  console.log(`\n✓ Content valid — ${label}, ${knownRoutes.size} routes.\n`);
}

main();
