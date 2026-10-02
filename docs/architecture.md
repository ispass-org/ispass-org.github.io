# Architecture

## The one idea

**Conference content is data. The website is a renderer.**

Everything that changes from year to year — dates, people, venue, program,
sponsors, links, prose — lives under `conferences/<year>/` and `site/`. Nothing
under `src/` knows that ISPASS 2027 is in New York, or that its deadline is in
December. Adding ISPASS 2028 means adding a directory, not writing code.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | [Astro](https://astro.build) | Static site generation with zero client JS by default. Components are plain HTML + scoped CSS. |
| Language | TypeScript | The content schema is typed, so a page cannot read a field that does not exist. |
| Content | YAML + Markdown | YAML for records (dates, people, sessions); Markdown for prose. Both are editable without knowing the code. |
| Validation | [zod](https://zod.dev) | One schema, used both at build time and by `npm run validate`. |
| Styling | Plain CSS with custom properties | No build-time CSS framework, no utility classes, no runtime. |
| Client JS | ~2 KB, all optional | Program search and deadline re-checking. The site is complete without it. |

Deliberately **not** used: any database, any server-side code, PHP,
authentication, a CMS, React or any other UI framework, a paper-submission
system, a registration system, web fonts.

## Directory map

```
conferences/<year>/   Everything about one edition. Edited by the Web Chair.
site/                 The evergreen ISPASS layer: what outlives any one year.
templates/conference/ The blank year, used by `npm run new-conference`.
src/lib/              Load, validate and derive. No markup.
src/components/       Presentational components. No file reading.
src/layouts/          The two page shells: conference and evergreen.
src/pages/            Routes. Thin — they fetch data and choose components.
src/styles/           Design tokens and global styles.
scripts/              validate-content, new-conference, lint.
docs/                 This directory.
public/               Static assets served as-is.
```

## Data flow

```
conferences/2027/*.yaml ──┐
                          ├─► src/lib/schema.ts   (zod: shape + rules)
site/ispass.yaml       ──┘            │
                                      ▼
                          src/lib/conferences.ts  (read, validate, cache)
                                      │
             ┌────────────────────────┼────────────────────────┐
             ▼                        ▼                        ▼
      src/lib/phase.ts         src/lib/nav.ts           src/lib/dates.ts
   (what the homepage       (menu, derived from     (formatting, timezones,
    leads with)              the pages that exist)    deadline arithmetic)
             │                        │                        │
             └────────────────────────┼────────────────────────┘
                                      ▼
                             src/pages/**  ──►  dist/
```

`conferences.ts` is the only module that touches the filesystem. Components
receive already-validated data as props. This is why the validator and the site
can never disagree: they parse through the same schema.

Markdown takes a parallel path through Astro's content collections
(`src/content.config.ts`), whose frontmatter is validated by the *same*
`pageFrontmatterSchema`.

## Routing

| URL | Source | Notes |
| --- | --- | --- |
| `/` | `src/pages/index.astro` + `site/ispass.yaml` | The evergreen ISPASS landing page |
| `/about/`, `/policies/`, `/previous/`, `/steering-committee/` | `site/` | Evergreen |
| `/<year>/` | `src/pages/[year]/index.astro` | Conference homepage, phase-driven |
| `/<year>/<slug>/` | `conferences/<year>/<slug>.md` | One route file serves every Markdown page |
| `/<year>/committee/`, `/dates/`, `/program/`, `/keynotes/`, `/sponsors/`, `/news/`, `/workshops/`, `/accepted-posters/` | dedicated route files | Rendered from YAML |
| `/<year>/dates.ics`, `/<year>/program.ics` | endpoint files | Calendar feeds |
| `/robots.txt`, `/sitemap-index.xml`, `/404.html` | generated | |

`getStaticPaths` enumerates `conferences/`, so **every route above exists for
every year directory automatically**.

Astro gives static path segments priority over dynamic ones, so
`/2027/committee/` resolves to `committee.astro` rather than to `[slug].astro`.
`npm run validate` enforces this by rejecting a Markdown slug that collides
with a reserved name.

## The two layers

The site is deliberately split in two, so that `ispass.org` can eventually be a
permanent home for the symposium rather than a redirect to whichever year is
current.

**Evergreen** (`site/`, `SiteLayout.astro`) — what ISPASS is, its history, its
policies, its steering committee, and a pointer to the current conference. Its
navigation is short and its accent colour is the fixed ISPASS navy.

**Annual** (`conferences/<year>/`, `ConferenceLayout.astro`) — one edition.
Full four-group navigation, a per-year accent colour, and a phase-driven
homepage.

Handing over to the next year is one line: `current_year` in `site/ispass.yaml`
(and `npm run new-conference` writes it for you).

## Conference lifecycle

`phase` in `conference.yaml` is a single enum that drives the homepage. There is
one homepage template; `src/lib/phase.ts` decides what it leads with. See
[content-model.md](./content-model.md#phase) for the table.

The rule that makes this maintainable: **a section that has no content
disappears on its own.** The phase chooses ordering and emphasis; it does not
have to also check whether there are keynotes yet.

## Theming

`src/styles/tokens.css` defines the entire palette as custom properties. No
component writes a literal colour.

The palette is ISPASS's own, taken from the original ispass.org stylesheet and
from the logo artwork: navy `#000080`, green `#008000`, charcoal `#303030`,
pale blue `#e1e1ff`, warm paper `#f5f5ef`. See
[`public/brand/README.md`](../public/brand/README.md) for the logo colours and
[`src/styles/tokens.css`](../src/styles/tokens.css) for the full palette.

There is **one light theme** and no dark mode — a deliberate simplification for
a document-like site that is also printed and projected.

A conference picks its own accent in `conference.yaml`. That value is injected
as `--accent-seed` on `<html>`, and `--accent`, `--accent-wash` and
`--accent-line` derive from it, so a different seed stays coherent.

`npm run validate` rejects an accent that does not clear 4.5:1 against white,
because the accent is used for link text.

## Client-side JavaScript

Two scripts, both purely additive:

1. **Deadline re-check** (`ImportantDates.astro`) — a page built a week ago
   still shows the correct "passed"/"next" state on the morning of a deadline.
   Without it, the build-time classification stands.
2. **Program search** (`ProgramSchedule.astro`) — filters sessions and papers.
   The whole schedule is in the HTML; the script only hides rows, and the
   search box itself is `hidden` until the script removes the attribute.

Navigation needs no JavaScript at all: desktop menus open on `:hover` and
`:focus-within`, mobile uses `<details>`.

## Accessibility and performance

Both are verified rather than asserted. See the bottom of the [README](../README.md)
for current numbers and how to reproduce them.

Notable choices:

- No web fonts. A system serif for display and a system sans for text.
- One light palette, contrast-checked, rather than two themes to keep in step.
- Panels are hidden with `opacity`, not `visibility`, so their links stay in the
  tab order and `:focus-within` can reveal them without JavaScript.
- State is never signalled by colour alone — a passed deadline is struck
  through *and* labelled "Passed".
- `[hidden] { display: none !important }` is set globally, so a component's own
  `display` cannot defeat progressive enhancement.
