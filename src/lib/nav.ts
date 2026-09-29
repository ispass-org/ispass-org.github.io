/**
 * Navigation model.
 *
 * The menu is derived, not hand-written: it comes from the Markdown pages that
 * exist for a year plus a few fixed data-driven pages. A page joins the menu by
 * setting `nav:` in its frontmatter — there is no separate list to keep in sync.
 */
import { getCollection } from 'astro:content';
import type { ConferenceData } from './conferences';
import { hasKeynotes, hasProgram, hasSponsors } from './conferences';
import { phaseAtLeast } from './phase';
import type { navGroups } from './schema';

export type NavGroup = (typeof navGroups)[number];

export interface NavItem {
  label: string;
  href: string;
  /** Marked in the menu while the underlying content is still a placeholder. */
  pending?: boolean;
}

export interface NavSection {
  id: Exclude<NavGroup, 'none'>;
  label: string;
  items: NavItem[];
}

const GROUP_LABELS: Record<Exclude<NavGroup, 'none'>, string> = {
  conference: 'Conference',
  attend: 'Attend',
  authors: 'Authors',
  community: 'Community',
};

/** One nav entry plus the grouping metadata used to sort it into a section. */
type GroupedNavItem = NavItem & { group: Exclude<NavGroup, 'none'>; order: number };

/**
 * Pages that come from structured data rather than Markdown, and so have no
 * frontmatter to carry their own nav entry.
 */
function dataDrivenPages(c: ConferenceData): GroupedNavItem[] {
  return [
    { group: 'conference', order: 20, label: 'Committee', href: `/${c.year}/committee/` },
    {
      group: 'conference',
      order: 25,
      label: 'Keynotes',
      href: `/${c.year}/keynotes/`,
      pending: !hasKeynotes(c),
    },
    {
      group: 'conference',
      order: 30,
      label: 'Program',
      href: `/${c.year}/program/`,
      pending: !hasProgram(c) || c.program.sample,
    },
    {
      group: 'conference',
      order: 35,
      label: 'Workshops & Tutorials',
      href: `/${c.year}/workshops/`,
      pending: !c.workshops.published,
    },
    { group: 'conference', order: 45, label: 'Important Dates', href: `/${c.year}/dates/` },
    {
      // With the program, not under Authors: it is what attendees see at the
      // conference. Submitting a poster (Call for Posters, Poster Submission)
      // stays under Authors.
      group: 'conference',
      order: 32,
      label: 'Accepted Posters',
      href: `/${c.year}/accepted-posters/`,
      pending: !c.posters.published,
    },
    { group: 'community', order: 10, label: 'Previous Symposia', href: '/previous/' },
    {
      group: 'community',
      order: 20,
      label: 'Sponsors',
      href: `/${c.year}/sponsors/`,
      pending: !hasSponsors(c),
    },
    { group: 'community', order: 30, label: 'About ISPASS', href: '/about/' },
  ];
}

export async function buildNav(c: ConferenceData): Promise<NavSection[]> {
  const pages = await getCollection('pages');
  const prefix = `${c.year}/`;

  const fromMarkdown: GroupedNavItem[] = pages
    .filter((page) => page.id.startsWith(prefix))
    .filter((page) => !page.data.draft)
    .filter((page) => page.data.nav !== 'none')
    // A page gated on a later phase stays out of the menu until then.
    .filter(
      (page) =>
        !page.data.since_phase || phaseAtLeast(c.conference.phase, page.data.since_phase),
    )
    .map((page) => ({
      group: page.data.nav as Exclude<NavGroup, 'none'>,
      order: page.data.order,
      label: page.data.nav_label ?? page.data.title,
      href: `/${c.year}/${page.data.slug ?? page.id.slice(prefix.length)}/`,
    }));

  const all: GroupedNavItem[] = [...fromMarkdown, ...dataDrivenPages(c)];

  return (Object.keys(GROUP_LABELS) as Array<Exclude<NavGroup, 'none'>>)
    .map((id) => ({
      id,
      label: GROUP_LABELS[id],
      items: all
        .filter((item) => item.group === id)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
        .map(({ label, href, pending }) => ({ label, href, pending })),
    }))
    .filter((section) => section.items.length > 0);
}

/** True when `href` is the current page, tolerating trailing-slash differences. */
export function isCurrent(href: string, pathname: string): boolean {
  const norm = (value: string) => (value.endsWith('/') ? value : `${value}/`);
  return norm(href) === norm(pathname);
}
