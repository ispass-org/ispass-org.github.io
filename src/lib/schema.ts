/**
 * Canonical schema for all ISPASS conference content.
 *
 * Everything a Web Chair edits under `conferences/<year>/` and `site/` is
 * validated against these schemas, both by `npm run validate` and at build
 * time. If a field is not described here, no page will read it.
 *
 * Design rules:
 *  - Unknown information is `null` (YAML `null` / `~`), never a guess and never
 *    the literal string "TBD". Templates render `null` as "TBD" for you.
 *  - Every deadline lives in dates.yaml exactly once.
 *  - Adding a field means adding it here first.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** A slug-safe identifier: lowercase letters, digits and hyphens. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'must be lowercase letters, digits and hyphens');

/** ISO calendar date, `YYYY-MM-DD`. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, e.g. 2027-04-26')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'is not a real calendar date');

/** 24-hour wall clock, `HH:MM`. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time, e.g. 09:30');

/**
 * An IANA timezone name. Validated against the host's own timezone database so
 * a typo like `America/New_york` fails loudly instead of silently shifting
 * every deadline.
 */
export const timezoneSchema = z.string().refine((value) => {
  if (value === 'AoE') return true; // Anywhere on Earth, UTC-12, used by many CFPs
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'is not a known IANA timezone (or the special value "AoE")');

/** A URL that must be absolute and https, or an in-site absolute path. */
export const linkSchema = z
  .string()
  .refine(
    (value) => value.startsWith('/') || /^https:\/\//.test(value) || /^mailto:/.test(value),
    'must be an https:// URL, a mailto: link, or a site-absolute path starting with /',
  );

/** Anything that may legitimately be unknown. */
const tbd = <T extends z.ZodTypeAny>(inner: T) => inner.nullable().default(null);

/* ------------------------------------------------------------------ */
/* conference.yaml                                                     */
/* ------------------------------------------------------------------ */

/**
 * The conference lifecycle. Drives the homepage call-to-action and which
 * sections appear. See src/lib/phase.ts.
 */
export const phases = [
  'pre_cfp',
  'cfp_open',
  'submissions_open',
  'review',
  'accepted_papers',
  'registration_open',
  'program_published',
  'conference',
  'archived',
] as const;

export const phaseSchema = z.enum(phases);
export type Phase = z.infer<typeof phaseSchema>;

export const conferenceSchema = z.object({
  short_name: z.string().min(1),
  full_name: z.string().min(1),
  acronym: z.string().default('ISPASS'),
  edition: tbd(z.string()),
  year: z.number().int().min(2000).max(2100),
  city: tbd(z.string()),
  region: tbd(z.string()),
  country: tbd(z.string()),
  host: tbd(z.string()),
  venue: tbd(z.string()),
  venue_address: tbd(z.string()),
  start_date: tbd(isoDateSchema),
  end_date: tbd(isoDateSchema),
  timezone: timezoneSchema.default('UTC'),
  phase: phaseSchema,
  tagline: tbd(z.string()),
  description: z.string().min(20, 'used as the meta description; write a real sentence'),
  /** Per-year accent colour (CSS colour). Keeps each edition distinct without a redesign. */
  accent: z.string().default('#000080'),
  /** Shown verbatim in the footer. */
  maintained_by: z.string().default('the ISPASS Web Chair'),
  contact_email: tbd(z.string().email()),
  /** Set true when this edition is over; drives the archived banner. */
  archived: z.boolean().default(false),
});
export type Conference = z.infer<typeof conferenceSchema>;

/* ------------------------------------------------------------------ */
/* dates.yaml — the ONLY place a deadline may be written               */
/* ------------------------------------------------------------------ */

export const dateCategories = [
  'submission',
  'review',
  'notification',
  'camera_ready',
  'artifact',
  'poster',
  'workshop',
  'registration',
  'travel_grant',
  'conference',
] as const;

export const importantDateSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** `null` until announced. */
  date: tbd(isoDateSchema),
  /** Optional wall-clock deadline. Omit for all-day items. */
  time: tbd(timeSchema),
  /** Optional end date, for ranges such as a rebuttal period or the conference itself. */
  end_date: tbd(isoDateSchema),
  timezone: timezoneSchema.default('AoE'),
  category: z.enum(dateCategories),
  /** Shown as a short note under the date, e.g. "extended from March 7". */
  note: tbd(z.string()),
  /** Marks a deadline that was pushed back, so it can be rendered honestly. */
  extended: z.boolean().default(false),
  /** Hide from the public site without deleting the row. */
  hidden: z.boolean().default(false),
});
export type ImportantDate = z.infer<typeof importantDateSchema>;

export const datesFileSchema = z.array(importantDateSchema);

/* ------------------------------------------------------------------ */
/* committee.yaml                                                      */
/* ------------------------------------------------------------------ */

export const personSchema = z.object({
  name: z.string().min(1),
  affiliation: tbd(z.string()),
  /**
   * Public profile page. Personal email addresses are deliberately NOT part of
   * this schema — see docs/content-model.md. Use `contact_email` in
   * conference.yaml, or a role-based address, for anything public.
   */
  url: tbd(linkSchema),
  country: tbd(z.string()),
});
export type Person = z.infer<typeof personSchema>;

export const committeeRoleSchema = z.object({
  role: z.string().min(1),
  /** Empty list = the role exists but nobody is confirmed yet. Renders as TBD. */
  people: z.array(personSchema).default([]),
  /** Optional ordering hint; lower sorts first. Falls back to file order. */
  order: tbd(z.number().int()),
});

export const committeeSchema = z.object({
  /** Organising committee, rendered as named roles. */
  roles: z.array(committeeRoleSchema).default([]),
  /** Technical programme committee, rendered as a plain alphabetical list. */
  program_committee: z.array(personSchema).default([]),
  /** Optional extra groups, e.g. an ERC or a steering liaison list. */
  extra_groups: z
    .array(
      z.object({
        title: z.string().min(1),
        description: tbd(z.string()),
        people: z.array(personSchema).default([]),
      }),
    )
    .default([]),
});
export type Committee = z.infer<typeof committeeSchema>;

/* ------------------------------------------------------------------ */
/* sponsors.yaml                                                       */
/* ------------------------------------------------------------------ */

export const sponsorSchema = z.object({
  /** For a placeholder, a description of the slot, e.g. "Gold sponsor". */
  name: z.string().min(1),
  /** Path under public/, e.g. /logos/example.svg. Existence is checked by `npm run validate`. */
  logo: tbd(z.string()),
  url: tbd(linkSchema),
  /**
   * A reserved slot, not a sponsor. Renders as an empty, labelled logo tile so
   * the page shows its final shape before sponsors are confirmed. Never put a
   * real company's name or logo on a placeholder — an organisation appearing
   * as an ISPASS sponsor before it has agreed to be one is a real problem.
   */
  placeholder: z.boolean().default(false),
});

export const sponsorTierSchema = z.object({
  tier: z.string().min(1),
  /** Controls logo size; purely presentational. */
  prominence: z.enum(['high', 'medium', 'low']).default('medium'),
  sponsors: z.array(sponsorSchema).default([]),
});

export const sponsorsSchema = z.object({
  /** Shown on the sponsorship page above the tiers. */
  intro: tbd(z.string()),
  /** Who to contact about sponsoring. */
  contact: tbd(z.string()),
  prospectus: tbd(linkSchema),
  tiers: z.array(sponsorTierSchema).default([]),
});
export type Sponsors = z.infer<typeof sponsorsSchema>;

/* ------------------------------------------------------------------ */
/* keynotes.yaml                                                       */
/* ------------------------------------------------------------------ */

export const keynoteSchema = z.object({
  id: idSchema,
  speaker: tbd(z.string()),
  affiliation: tbd(z.string()),
  title: tbd(z.string()),
  /** Plain text or light Markdown; rendered as paragraphs. */
  abstract: tbd(z.string()),
  bio: tbd(z.string()),
  /** Path under public/, e.g. /images/keynote-a.jpg. */
  photo: tbd(z.string()),
  photo_alt: tbd(z.string()),
  url: tbd(linkSchema),
  /** Links this keynote to a program session, so the schedule can deep-link. */
  session_id: tbd(idSchema),
  /** Placeholder entries render as "Speaker to be announced". */
  placeholder: z.boolean().default(false),
});
export type Keynote = z.infer<typeof keynoteSchema>;

export const keynotesFileSchema = z.array(keynoteSchema);

/* ------------------------------------------------------------------ */
/* program.yaml                                                        */
/* ------------------------------------------------------------------ */

export const paperSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  /** e.g. "Best Paper", "Best Paper Nominee", "Distinguished Artifact". */
  award: tbd(z.string()),
  /** Badges earned in artifact evaluation, e.g. ["Available", "Reviewed"]. */
  badges: z.array(z.string()).default([]),
  /** Marks a pre-recorded presentation. */
  recorded: z.boolean().default(false),
  url: tbd(linkSchema),
});
export type Paper = z.infer<typeof paperSchema>;

export const sessionKinds = [
  'papers',
  'keynote',
  'break',
  'social',
  'poster',
  'workshop',
  'tutorial',
  'admin',
] as const;

export const sessionSchema = z.object({
  id: idSchema,
  kind: z.enum(sessionKinds).default('papers'),
  title: z.string().min(1),
  start: timeSchema,
  end: timeSchema,
  room: tbd(z.string()),
  chair: tbd(z.string()),
  /** Keynote/invited speaker for this slot. */
  speaker: tbd(z.string()),
  description: tbd(z.string()),
  url: tbd(linkSchema),
  papers: z.array(paperSchema).default([]),
});
export type Session = z.infer<typeof sessionSchema>;

/**
 * A slot is one row of the schedule. Sessions inside a slot that overlap in
 * time are rendered as parallel tracks side by side.
 */
export const slotSchema = z.object({
  start: timeSchema,
  end: timeSchema,
  sessions: z.array(sessionSchema).min(1),
});

export const programDaySchema = z.object({
  date: isoDateSchema,
  /** e.g. "Workshops & Tutorials". Falls back to the weekday name. */
  label: tbd(z.string()),
  note: tbd(z.string()),
  slots: z.array(slotSchema).default([]),
});

export const programSchema = z.object({
  /** Set true while the schedule is provisional; renders a visible banner. */
  draft: z.boolean().default(true),
  /**
   * Marks the shipped example schedule. Renders an unmissable "sample content"
   * banner. `npm run validate` fails the build if this is still true while the
   * conference phase is `program_published` or later.
   */
  sample: z.boolean().default(false),
  timezone: timezoneSchema.default('UTC'),
  note: tbd(z.string()),
  /** Legend entries for award stars, badges, etc. */
  legend: z.array(z.object({ symbol: z.string(), meaning: z.string() })).default([]),
  days: z.array(programDaySchema).default([]),
});
export type Program = z.infer<typeof programSchema>;

/* ------------------------------------------------------------------ */
/* announcements.yaml                                                  */
/* ------------------------------------------------------------------ */

export const announcementSchema = z.object({
  id: idSchema,
  date: isoDateSchema,
  title: z.string().min(1),
  body: tbd(z.string()),
  link: tbd(linkSchema),
  link_text: tbd(z.string()),
  importance: z.enum(['normal', 'high']).default('normal'),
  /** Placeholders are rendered with a visible "example entry" marker. */
  placeholder: z.boolean().default(false),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const announcementsFileSchema = z.array(announcementSchema);

/* ------------------------------------------------------------------ */
/* links.yaml — every external system lives here                       */
/* ------------------------------------------------------------------ */

export const linksSchema = z.object({
  paper_submission: tbd(linkSchema),
  poster_submission: tbd(linkSchema),
  artifact_submission: tbd(linkSchema),
  camera_ready: tbd(linkSchema),
  registration: tbd(linkSchema),
  travel_grant_application: tbd(linkSchema),
  hotel_booking: tbd(linkSchema),
  proceedings: tbd(linkSchema),
  workshop_proposals: tbd(linkSchema),
  cfp_pdf: tbd(linkSchema),
  sponsorship: tbd(linkSchema),
});
export type Links = z.infer<typeof linksSchema>;

/* ------------------------------------------------------------------ */
/* posters.yaml and workshops.yaml                                     */
/* ------------------------------------------------------------------ */

export const acceptedPosterSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  url: tbd(linkSchema),
});

export const postersFileSchema = z.object({
  published: z.boolean().default(false),
  note: tbd(z.string()),
  posters: z.array(acceptedPosterSchema).default([]),
});

export const workshopSchema = z.object({
  id: idSchema,
  kind: z.enum(['workshop', 'tutorial']),
  title: z.string().min(1),
  organizers: z.array(z.string()).default([]),
  date: tbd(isoDateSchema),
  start: tbd(timeSchema),
  end: tbd(timeSchema),
  room: tbd(z.string()),
  summary: tbd(z.string()),
  url: tbd(linkSchema),
  schedule: z
    .array(
      z.object({
        start: timeSchema,
        end: tbd(timeSchema),
        title: z.string().min(1),
        speaker: tbd(z.string()),
      }),
    )
    .default([]),
});

export const workshopsFileSchema = z.object({
  published: z.boolean().default(false),
  note: tbd(z.string()),
  items: z.array(workshopSchema).default([]),
});

/* ------------------------------------------------------------------ */
/* site/ — the evergreen ISPASS layer                                  */
/* ------------------------------------------------------------------ */

export const pastConferenceSchema = z.object({
  year: z.number().int().min(1990).max(2100),
  city: tbd(z.string()),
  country: tbd(z.string()),
  /** Where the archived site currently lives. */
  url: tbd(z.string()),
  /**
   * Health of that archive, as last checked.
   *   ok      reachable and readable
   *   broken  the URL resolves but the content does not render
   *   missing the URL 404s
   *   unknown not checked
   * Surfaced on the Previous Symposia page so a reader is not sent to a dead
   * link without warning, and so the backlog stays visible to the Web Chair.
   */
  archive_status: z.enum(['ok', 'broken', 'missing', 'unknown']).default('unknown'),
  /** True once the edition is served by this repository rather than the legacy host. */
  managed_here: z.boolean().default(false),
  proceedings: tbd(linkSchema),
});

export const siteSchema = z.object({
  name: z.string().min(1),
  full_name: z.string().min(1),
  description: z.string().min(20),
  tagline: tbd(z.string()),
  current_year: z.number().int().min(2000).max(2100),
  sponsors_note: tbd(z.string()),
  steering_committee: z.array(personSchema).default([]),
  steering_committee_note: tbd(z.string()),
  policies: z
    .array(z.object({ title: z.string(), url: linkSchema, description: tbd(z.string()) }))
    .default([]),
  past_conferences: z.array(pastConferenceSchema).default([]),
});
export type SiteData = z.infer<typeof siteSchema>;

/* ------------------------------------------------------------------ */
/* Markdown frontmatter                                                */
/* ------------------------------------------------------------------ */

export const navGroups = ['conference', 'attend', 'authors', 'community', 'none'] as const;

export const pageFrontmatterSchema = z.object({
  title: z.string().min(1),
  /** Meta description and search-result snippet. */
  description: tbd(z.string()),
  /** URL segment under /<year>/. Defaults to the filename. */
  slug: tbd(idSchema),
  /** Which navigation group the page belongs to. `none` keeps it out of the menu. */
  nav: z.enum(navGroups).default('none'),
  /** Label in the navigation, if shorter than the page title. */
  nav_label: tbd(z.string()),
  order: z.number().int().default(100),
  /** Hide the page entirely (still builds, but is unlinked and noindexed). */
  draft: z.boolean().default(false),
  /** Show these date categories in a sidebar box on the page. */
  show_dates: z.array(z.enum(dateCategories)).default([]),
  /** A phase-gated page only appears from this phase onwards. */
  since_phase: tbd(phaseSchema),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
