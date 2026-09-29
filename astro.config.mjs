// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import remarkDirective from 'remark-directive';
import { siteConfig } from './src/lib/site-config.mjs';
import { remarkCallouts } from './src/plugins/remark-callouts.mjs';

// The public origin of the deployed site. Change this once, here, when the
// site moves to its final home. Everything else (canonical URLs, OpenGraph
// tags, sitemap, robots.txt) derives from it.
const distDir = fileURLToPath(new URL('./dist/', import.meta.url));
const contentDirs = ['./conferences', './site'].map((d) =>
  fileURLToPath(new URL(d, import.meta.url)),
);

/**
 * Reload the dev server when conference content changes.
 *
 * YAML under conferences/ and site/ is read with `fs`, not imported, so Vite
 * has no dependency edge to it and would otherwise serve a stale page until a
 * manual restart. Markdown is handled by Astro's content collections and does
 * not need this.
 */
/** @returns {import('vite').Plugin} */
function watchConferenceContent() {
  return {
    name: 'ispass:watch-content',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(contentDirs);
      server.watcher.on('change', (/** @type {string} */ file) => {
        if (!/\.(ya?ml)$/i.test(file)) return;
        if (!contentDirs.some((dir) => file.startsWith(dir))) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: 'full-reload' });
        server.config.logger.info(`  content updated: ${path.basename(file)}`);
      });
    },
  };
}

/**
 * True when the built page carries `<meta name="robots" content="noindex">`.
 * Runs at `astro:build:done`, by which point dist/ has been written.
 *
 * @param {string} pageUrl absolute URL of a built page
 */
function isNoindex(pageUrl) {
  try {
    const { pathname } = new URL(pageUrl);
    const file = path.join(distDir, pathname.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(file)) return false;
    return /<meta\s+name="robots"\s+content="noindex/.test(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

export default defineConfig({
  site: siteConfig.origin,
  base: siteConfig.base,
  trailingSlash: 'always',
  integrations: [
    mdx(),
    sitemap({
      // Keep pages that mark themselves noindex out of the sitemap — a sample
      // program, an unpublished poster list, a draft page. Rather than
      // duplicating those conditions here, this reads the emitted HTML, so the
      // page itself stays the single source of truth.
      filter: (page) => !isNoindex(page),
    }),
  ],
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [watchConferenceContent()],
  },
  markdown: {
    // `:::note` / `:::warning` / `:::tbd` containers become styled callouts.
    remarkPlugins: [remarkDirective, remarkCallouts],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
  devToolbar: { enabled: false },
});
