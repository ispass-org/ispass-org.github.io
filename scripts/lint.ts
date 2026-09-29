#!/usr/bin/env tsx
/**
 * `npm run lint`
 *
 * Checks the BUILT site in dist/ rather than the source, because that is what
 * visitors actually receive. Run `npm run build` first.
 *
 * Checks:
 *   - every internal href resolves to a file in dist/
 *   - every <img> has an alt attribute
 *   - every page has exactly one <h1>, a <title> and a meta description
 *   - heading levels do not skip (h2 -> h4)
 *   - no page is missing its canonical link
 *   - external links that open a new context carry rel="noopener"
 *   - page weight, so a page that balloons is noticed
 *
 * Deliberately dependency-free: regexes over the emitted HTML. It is not a
 * full HTML parser and does not try to be — it catches the mistakes that
 * actually happen when editing content, and `npm run validate` covers the
 * structured data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distDir = path.join(projectRoot, 'dist');

const errors: string[] = [];
const warnings: string[] = [];

const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);
const warn = (where: string, message: string) => warnings.push(`${where}: ${message}`);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** dist/2027/cfp/index.html -> /2027/cfp/ */
function urlOf(file: string): string {
  const rel = path.relative(distDir, file).split(path.sep).join('/');
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  if (rel === 'index.html') return '/';
  return `/${rel}`;
}

/** Strip <script>, <style> and comments before checking visible markup. */
function stripNonMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function main(): void {
  if (!fs.existsSync(distDir)) {
    console.error('\ndist/ does not exist. Run `npm run build` first.\n');
    process.exit(1);
  }

  const files = walk(distDir);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const known = new Set(files.map(urlOf));
  // A directory URL is served by its index.html; record both spellings.
  for (const file of files) {
    const rel = `/${path.relative(distDir, file).split(path.sep).join('/')}`;
    known.add(rel);
  }

  let totalBytes = 0;

  for (const file of htmlFiles) {
    const url = urlOf(file);
    const raw = fs.readFileSync(file, 'utf8');
    const html = stripNonMarkup(raw);
    const bytes = Buffer.byteLength(raw);
    totalBytes += bytes;

    if (bytes > 350_000) {
      warn(url, `page is ${Math.round(bytes / 1024)} KB of HTML`);
    }

    /* --- head ------------------------------------------------------- */
    if (!/<title>[^<]+<\/title>/.test(raw)) fail(url, 'has no non-empty <title>');
    if (!/<meta\s+name="description"\s+content="[^"]{20,}"/.test(raw)) {
      fail(url, 'has no meta description of at least 20 characters');
    }
    if (!/<link\s+rel="canonical"/.test(raw)) fail(url, 'has no canonical link');
    if (!/<html\s+lang="/.test(raw)) fail(url, '<html> has no lang attribute');

    /* --- headings --------------------------------------------------- */
    const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => Number(m[1]));
    const h1s = headings.filter((level) => level === 1).length;
    if (h1s === 0) fail(url, 'has no <h1>');
    if (h1s > 1) fail(url, `has ${h1s} <h1> elements; there should be exactly one`);

    let previous = 0;
    for (const level of headings) {
      if (previous && level > previous + 1) {
        warn(url, `heading level jumps from h${previous} to h${level}`);
        break;
      }
      previous = level;
    }

    /* --- images ----------------------------------------------------- */
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt=/.test(match[0])) fail(url, `<img> without alt: ${match[0].slice(0, 90)}`);
    }

    /* --- links ------------------------------------------------------ */
    for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)) {
      const [tag, href] = match as unknown as [string, string];
      if (/^(mailto:|tel:|#|data:)/.test(href)) continue;

      if (/^https?:/i.test(href)) {
        if (/target="_blank"/.test(tag) && !/rel="[^"]*noopener/.test(tag)) {
          fail(url, `external link opens a new tab without rel="noopener": ${href}`);
        }
        continue;
      }

      if (!href.startsWith('/')) {
        warn(url, `relative link "${href}" — prefer site-absolute paths starting with /`);
        continue;
      }

      const target = href.split('#')[0]!.split('?')[0]!;
      if (target === '' || known.has(target)) continue;
      // A directory link may be spelled with or without the trailing slash.
      if (known.has(`${target}/`) || known.has(target.replace(/\/$/, ''))) continue;
      fail(url, `internal link "${href}" does not resolve to anything in dist/`);
    }
  }

  /* --- required files ------------------------------------------------ */
  for (const required of ['/robots.txt', '/sitemap-index.xml', '/favicon.svg', '/404.html']) {
    if (!known.has(required)) fail('dist/', `${required} is missing from the build`);
  }

  /* --- report -------------------------------------------------------- */
  const avgKb = Math.round(totalBytes / htmlFiles.length / 1024);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
    for (const message of warnings) console.log(`  ! ${message}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const message of errors) console.error(`  ✗ ${message}`);
    console.error('\nLint FAILED.\n');
    process.exit(1);
  }

  console.log(`\n✓ Lint clean — ${htmlFiles.length} pages, ${avgKb} KB average HTML.\n`);
}

main();
