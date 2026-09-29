/**
 * robots.txt, generated so the sitemap URL always matches the configured site
 * origin instead of being hard-coded in a static file.
 */
import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/site-config.mjs';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL(siteConfig.origin);
  const body = `User-agent: *
Allow: /

Sitemap: ${new URL('sitemap-index.xml', origin).href}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
