/**
 * Single source of truth for where the site lives.
 *
 * This file is plain JavaScript on purpose: it is imported both by
 * `astro.config.mjs` (which runs before TypeScript is available) and by
 * TypeScript modules inside `src/`.
 *
 * NOTHING here has been deployed. Change `origin` when a deployment target is
 * chosen; see docs/deployment.md.
 */
export const siteConfig = {
  /**
   * Public origin, no trailing slash. The apex, not www: ISPASS is cited as
   * ispass.org/ispassYYYY/ in published papers, so that is the canonical host.
   * While previewing on GitHub Pages this is https://<org>.github.io, with
   * `base` set to '/<repo>/'. See docs/deployment.md.
   */
  origin: 'https://ispass.org',
  /** Sub-path the site is served from. '/' for a root deployment. */
  base: '/',
  /** Which conference year the evergreen landing page points at. */
  currentYear: 2027,
};
