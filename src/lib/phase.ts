/**
 * Conference lifecycle.
 *
 * `phase` in conference.yaml is the single switch that changes what the
 * homepage leads with. There is one homepage template; this module decides what
 * it emphasises. Adding a phase means adding one entry to PHASE_PLAN.
 */
import type { ConferenceData } from './conferences';
import { findDate } from './conferences';
import { formatDate } from './dates';
import type { Phase } from './schema';

export interface CallToAction {
  label: string;
  href: string;
  /** External links get an icon and rel="noopener". */
  external?: boolean;
  /** Short line under the button, usually a deadline. */
  note?: string | null;
  /** Rendered as a muted, non-clickable button when the target is not ready. */
  disabled?: boolean;
}

/** Sections the homepage can show, in render order. */
export type HomeSection =
  | 'announcements'
  | 'dates'
  | 'about'
  | 'committee'
  | 'keynotes'
  | 'program'
  | 'venue'
  | 'sponsors'
  | 'links';

interface PhasePlan {
  /** Human label used in the admin-ish "status" chip and in docs. */
  label: string;
  /**
   * A short sentence stating where the conference is in its cycle, shown in the
   * hero. It carries the weight when there is no action to offer yet — during
   * `pre_cfp` this is the whole message.
   */
  status: (c: ConferenceData) => string | null;
  /** What the site is asking the visitor to do right now. */
  primary: (c: ConferenceData) => CallToAction | null;
  secondary: (c: ConferenceData) => CallToAction | null;
  /** Homepage sections, in order. Sections with no content drop out anyway. */
  sections: HomeSection[];
}

const yearPath = (c: ConferenceData, slug = '') => `/${c.year}/${slug}`;

/** Deadline note for a CTA, e.g. "Deadline: December 15, 2026". */
function deadlineNote(c: ConferenceData, id: string, prefix = 'Deadline'): string | null {
  const entry = findDate(c, id);
  if (!entry?.date) return null;
  const time = entry.time ? `, ${entry.time} ${entry.timezone}` : ` (${entry.timezone})`;
  return `${prefix}: ${formatDate(entry.date)}${time}`;
}

/** A CTA that points at an external system, or a disabled placeholder if unset. */
function externalCta(
  href: string | null,
  label: string,
  note: string | null,
  fallbackHref: string,
): CallToAction {
  if (!href) {
    return { label, href: fallbackHref, note: note ?? 'Link to be announced', disabled: false };
  }
  return { label, href, external: true, note };
}

const cfpCta = (c: ConferenceData): CallToAction => ({
  label: 'Call for Papers',
  href: yearPath(c, 'cfp/'),
  note: deadlineNote(c, 'paper', 'Papers due'),
});

const datesCta = (c: ConferenceData): CallToAction => ({
  label: 'Important Dates',
  href: yearPath(c, 'dates/'),
});

const programCta = (c: ConferenceData): CallToAction => ({
  label: 'Program',
  href: yearPath(c, 'program/'),
});

const registerCta = (c: ConferenceData): CallToAction =>
  externalCta(
    c.links.registration,
    'Register',
    deadlineNote(c, 'early-registration', 'Early registration until'),
    yearPath(c, 'registration/'),
  );

export const PHASE_PLAN: Record<Phase, PhasePlan> = {
  pre_cfp: {
    label: 'Before the Call for Papers',
    status: () => 'Call for Papers coming soon',
    primary: () => null,
    secondary: (c) => datesCta(c),
    sections: ['announcements', 'dates', 'about', 'venue', 'committee', 'links', 'sponsors'],
  },
  cfp_open: {
    label: 'Call for Papers published',
    status: () => 'The Call for Papers is open',
    primary: (c) => cfpCta(c),
    secondary: (c) => datesCta(c),
    sections: ['announcements', 'dates', 'about', 'venue', 'links', 'sponsors'],
  },
  submissions_open: {
    label: 'Submissions open',
    status: () => 'Paper submissions are open',
    primary: (c) =>
      externalCta(
        c.links.paper_submission,
        'Submit a Paper',
        deadlineNote(c, 'paper'),
        yearPath(c, 'submission/'),
      ),
    secondary: (c) => cfpCta(c),
    sections: ['announcements', 'dates', 'about', 'venue', 'links', 'sponsors'],
  },
  review: {
    label: 'Under review',
    status: () => 'Submissions are under review',
    primary: (c) => ({
      label: 'Important Dates',
      href: yearPath(c, 'dates/'),
      note: deadlineNote(c, 'notification', 'Notification'),
    }),
    secondary: (c) => cfpCta(c),
    sections: ['announcements', 'dates', 'about', 'venue', 'links', 'sponsors'],
  },
  accepted_papers: {
    label: 'Papers accepted',
    status: () => 'Accepted papers announced',
    primary: (c) => ({
      label: 'Accepted Papers',
      href: yearPath(c, 'accepted-papers/'),
      note: deadlineNote(c, 'camera-ready', 'Camera-ready due'),
    }),
    secondary: (c) => datesCta(c),
    sections: ['announcements', 'dates', 'keynotes', 'about', 'venue', 'links', 'sponsors'],
  },
  registration_open: {
    label: 'Registration open',
    status: () => 'Registration is open',
    primary: (c) => registerCta(c),
    secondary: (c) => datesCta(c),
    sections: ['announcements', 'dates', 'keynotes', 'venue', 'about', 'links', 'sponsors'],
  },
  program_published: {
    label: 'Program published',
    status: () => 'The program is published',
    primary: (c) => programCta(c),
    secondary: (c) => registerCta(c),
    sections: ['announcements', 'program', 'keynotes', 'dates', 'venue', 'links', 'sponsors'],
  },
  conference: {
    label: 'Conference week',
    status: () => 'The symposium is under way',
    primary: (c) => programCta(c),
    secondary: (c) => ({ label: 'Venue & Directions', href: yearPath(c, 'venue/') }),
    sections: ['announcements', 'program', 'venue', 'keynotes', 'links', 'sponsors'],
  },
  archived: {
    label: 'Archived',
    status: (c) => `ISPASS ${c.year} has concluded`,
    primary: (c) => programCta(c),
    secondary: (c) =>
      c.links.proceedings
        ? { label: 'Proceedings', href: c.links.proceedings, external: true }
        : { label: 'Previous Symposia', href: '/previous/' },
    sections: ['program', 'keynotes', 'announcements', 'about', 'sponsors'],
  },
};

export function phaseLabel(phase: Phase): string {
  return PHASE_PLAN[phase].label;
}

export interface HomePlan {
  status: string | null;
  primary: CallToAction | null;
  secondary: CallToAction | null;
  sections: HomeSection[];
}

export function homePlan(c: ConferenceData): HomePlan {
  const plan = PHASE_PLAN[c.conference.phase];
  const primary = plan.primary(c);
  let secondary = plan.secondary(c);

  // Both actions often reference the same deadline — during `submissions_open`,
  // "Submit a Paper" and "Call for Papers" are both governed by the paper
  // deadline. Printing it twice side by side reads as two different dates at a
  // glance, so the secondary drops its note when it says the same thing.
  if (secondary?.note && primary?.note) {
    const sameDate = secondary.note.replace(/^[^:]*:\s*/, '') === primary.note.replace(/^[^:]*:\s*/, '');
    if (sameDate) secondary = { ...secondary, note: null };
  }

  return {
    status: plan.status(c),
    primary,
    secondary,
    sections: plan.sections,
  };
}

/** Phase ordering, so pages can be gated with `since_phase`. */
const PHASE_ORDER: Phase[] = [
  'pre_cfp',
  'cfp_open',
  'submissions_open',
  'review',
  'accepted_papers',
  'registration_open',
  'program_published',
  'conference',
  'archived',
];

export function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** True when `current` is at or past `required`. `archived` sees everything. */
export function phaseAtLeast(current: Phase, required: Phase): boolean {
  if (current === 'archived') return true;
  return phaseIndex(current) >= phaseIndex(required);
}
