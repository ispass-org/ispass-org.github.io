import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { pageFrontmatterSchema } from './lib/schema';

/**
 * Long-form conference content. One Markdown file per page, living beside the
 * YAML for the same year in `conferences/<year>/`.
 *
 * Entry ids look like `2027/cfp`, which is also the URL: /2027/cfp/.
 */
const pages = defineCollection({
  loader: glob({ base: './conferences', pattern: '*/*.{md,mdx}' }),
  schema: pageFrontmatterSchema,
});

/**
 * Evergreen ISPASS pages, independent of any single year.
 * Entry ids are bare slugs: `about` -> /about/.
 */
const evergreen = defineCollection({
  loader: glob({ base: './site', pattern: '*.{md,mdx}' }),
  schema: pageFrontmatterSchema,
});

export const collections = { pages, evergreen };
