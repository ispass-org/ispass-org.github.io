# Contributing

Most changes to this repository are content changes: editing YAML or Markdown
under `conferences/` and `site/`. For those, [HANDOFF.md](HANDOFF.md) is all you
need.

This document is for changing `src/` — the renderer.

## Before you commit

```bash
npm run validate   # content
npm run check      # TypeScript
npm run build      # must succeed
npm run lint       # built HTML
```

or simply `npm test`.

## The rule that matters

**Nothing under `src/` may know a fact about a specific conference.**

If you find yourself typing `2027`, "New York", a deadline or a person's name
into a component, stop. That value belongs in `conferences/<year>/`, and the
component should take it as a prop.

The test: deleting `conferences/2027/` and running `npm run new-conference --
2029` should give a complete, working site for a conference somewhere else
entirely.

## Structure

| Directory | Responsibility |
| --- | --- |
| `src/lib/` | Read, validate and derive. **No markup.** `conferences.ts` is the only module that touches the filesystem. |
| `src/components/` | Presentation. Receive validated data as props; never read files. |
| `src/layouts/` | The two page shells — conference and evergreen. |
| `src/pages/` | Routes. Keep them thin: fetch data, choose components. |
| `src/styles/` | `tokens.css` (the palette) and `global.css` (base + shared). |

## Adding a content field

1. Add it to the zod schema in [`src/lib/schema.ts`](src/lib/schema.ts), with a
   comment explaining what it is for. If it can be unknown, wrap it in `tbd()`
   so it defaults to `null`.
2. Add it to the template under `templates/conference/`, commented.
3. Document it in [docs/content-model.md](docs/content-model.md).
4. Use it in a component.
5. If it needs a rule beyond its type — a cross-reference, a file that must
   exist, a value that must not appear after a certain phase — add a check to
   [`scripts/validate-content.ts`](scripts/validate-content.ts).

Steps 1–3 come before step 4. The schema is the contract.

## CSS

- **Never write a literal colour in a component.** Use a token from
  `tokens.css`. Every token is defined for both light and dark.
- Astro `<style>` blocks are scoped by default. Keep them that way; `is:global`
  is reserved for `Prose.astro`, which styles Markdown output it does not own.
- Mobile first. Add complexity in `min-width` media queries.
- A component in a narrow container cannot use a viewport media query to decide
  its own layout. The `dates-compact` variant is the worked example: it always
  stacks, because a 19rem sidebar on a 1440px screen is still 19rem.

## Accessibility

Non-negotiable, and checked:

- Semantic HTML. A heading is an `<h2>` because of its level, not its size.
- Do not skip heading levels. Components that can appear at two depths take a
  `headingLevel` prop — see `Announcements.astro`.
- Every `<img>` needs `alt`. Decorative SVGs need `aria-hidden="true"`.
- Focus must always be visible. Never remove an outline without replacing it.
- **State is never signalled by colour alone.** A passed deadline is struck
  through *and* labelled "Passed".
- Hiding something with `visibility: hidden` or `display: none` removes it from
  the tab order. If it must stay focusable — a menu panel revealed by
  `:focus-within` — hide it with `opacity` and `pointer-events` instead.
- Run `npm run lint` after building; it checks alt text, heading order, one
  `<h1>` per page and every internal link.

## JavaScript

The site must work without it. Any script is an enhancement:

- Render the full content in HTML; the script may only reorganise or hide it.
- Controls that only work with script start with the `hidden` attribute, and
  the script removes it. (`[hidden]` is forced to `display: none` globally, so a
  component's own `display` cannot defeat this.)
- No framework, no hydration, no client-side routing.

## Commits and pull requests

- One logical change per commit. Content and renderer changes in separate ones
  where practical.
- Say **why** in the message, not just what.
- In a pull request that changes anything visual, include a screenshot at a
  wide width **and** at 390px.
- Once CI is configured (see [docs/deployment-plan.md](docs/deployment-plan.md)),
  every pull request gets a preview URL. Use it.

## Never commit

Hosting or FTP passwords, registrar credentials, DNS API tokens, API keys,
recovery codes. The site needs no secrets to build or run. If that ever
changes, add `.env.example` with empty values and keep the real `.env` out of
Git.
