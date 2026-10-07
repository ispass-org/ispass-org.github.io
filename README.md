# ISPASS website

Static website infrastructure for the **IEEE International Symposium on
Performance Analysis of Systems and Software**.

One repository serves both the permanent ISPASS landing page and every annual
conference site. Adding the next year's conference is one command; the rest is
editing YAML and Markdown.

> **Status: local only.** Nothing has been deployed. `ispass.org` has not been
> modified in any way — no DNS, no uploads, no redirects, no changes to the
> existing site.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321/
```

- `/` — the evergreen ISPASS landing page
- `/2027/` — the ISPASS 2027 conference site

**New Web Chair?** Read [HANDOFF.md](HANDOFF.md). About 30 minutes.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with live reload |
| `npm run build` | Validate, then build into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run validate` | Check all conference content: schemas, duplicate ids, internal links, missing assets, colour contrast |
| `npm run check` | TypeScript across `.ts` and `.astro` |
| `npm run lint` | Check the built HTML: links, alt text, heading order, metadata |
| `npm test` | validate + check + build |
| `npm run new-conference -- 2028` | Scaffold next year's conference |

## Layout

```
conferences/<year>/   One conference. YAML for records, Markdown for prose.
site/                 The evergreen ISPASS layer.
templates/conference/ The blank year used by `new-conference`.
src/                  The renderer: lib, components, layouts, pages, styles.
scripts/              validate-content, new-conference, lint.
docs/                 Architecture, content model, checklists, plans.
public/               Static assets. public/brand/ holds the ISPASS logo and its usage guide;
                      public/ispassYYYY/ are frozen copies of past editions (docs/archives.md).
```

The separation is strict: **nothing under `src/` knows anything about ISPASS
2027.** Conference facts live only in `conferences/` and `site/`.

## Documentation

| Document | Contents |
| --- | --- |
| [HANDOFF.md](HANDOFF.md) | **Start here.** Normal operation for a Web Chair. |
| [docs/content-model.md](docs/content-model.md) | Every content file and field |
| [docs/annual-checklist.md](docs/annual-checklist.md) | What to do at each stage of the cycle |
| [docs/architecture.md](docs/architecture.md) | How the site is built and why |
| [docs/deployment.md](docs/deployment.md) | How publishing works, and how to connect a domain |
| [docs/archives.md](docs/archives.md) | The archived past editions, and how to check them |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions for changing `src/` |

## Technology

Astro, TypeScript, YAML and Markdown, plain CSS. Static output: no PHP, no
database, no backend, no authentication, no CMS.

About 2 KB of optional client-side JavaScript (program search, deadline
re-checking). **The site is complete and usable with JavaScript disabled** —
including the navigation, which uses `:focus-within` and `<details>` rather
than scripts.

No web fonts. The type is a system serif for display and a system sans for
text, so the page costs nothing to render on conference wifi.

The palette is ISPASS's own — navy `#000080`, green `#008000` and the warm
paper tone of the original site's tables — taken from the legacy stylesheet and
from the logo artwork, and contrast-checked. One light theme, no dark mode.

## Verified

Measured on the built site, and reproducible:

| | Result | How |
| --- | --- | --- |
| Lighthouse | **100 / 100 / 100 / 100** on `/` and `/2027/` | `npx lighthouse http://localhost:4321/2027/` against `npm run preview` |
| Accessibility | **0 axe-core violations** across 13 pages × {1440px, 390px} | axe-core, WCAG 2.1 A/AA + best-practice |
| Page weight | 8–14 KB transferred per page | Lighthouse `total-byte-weight` |
| Horizontal scroll | none at 375, 390, 430, 768, 1024, 1440px | `scrollWidth` vs `clientWidth` |
| Without JavaScript | navigation, program and every page render | Playwright with `javaScriptEnabled: false` |

The Program page scores 66 on SEO **on purpose**: it ships with sample data and
is marked `noindex` until `sample: false` is set.

## Known limitation

The project currently pins **Astro 5**, because Astro 7 requires Node ≥ 22.12
and the machine this was built on had 22.9. Astro 5 has published security
advisories that are fixed in 7. None of them affect a statically generated site
with no server-side rendering, no `define:vars` on user input and no server
islands — but the dev server is still worth keeping current.

**Recommended first maintenance task:**

```bash
nvm install 22.12 && nvm use          # or any Node ≥ 22.12
npm install astro@^7 @astrojs/mdx@^8
npm test
```

The codebase uses only stable Astro APIs and is expected to build unchanged.
