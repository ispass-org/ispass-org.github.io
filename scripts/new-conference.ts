#!/usr/bin/env tsx
/**
 * `npm run new-conference -- 2028`
 *
 * Creates conferences/<year>/ from templates/conference/, ready for the next
 * Web Chair to fill in.
 *
 * Deliberately does NOT copy the previous year's content. Dates, people,
 * submission links, venue and sponsors all start empty or null, because a
 * stale HotCRP link or a previous year's General Chair on a live site is worse
 * than an obvious blank.
 *
 * Options:
 *   --city "Zürich, Switzerland"   fill in the city placeholder
 *   --host "ETH Zürich"            fill in the host placeholder
 *   --force                        overwrite an existing directory
 *   --dry-run                      print what would happen and exit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const templateDir = path.join(projectRoot, 'templates', 'conference');
const conferencesDir = path.join(projectRoot, 'conferences');
const siteFile = path.join(projectRoot, 'site', 'ispass.yaml');

interface Options {
  year: number;
  city: string | null;
  host: string | null;
  force: boolean;
  dryRun: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}`);
  console.error(`
Usage: npm run new-conference -- <year> [options]

  <year>              Four-digit year, e.g. 2028

Options:
  --city <text>       City and country, e.g. "Zürich, Switzerland"
  --host <text>       Host institution, e.g. "ETH Zürich"
  --force             Overwrite conferences/<year>/ if it already exists
  --dry-run           Show what would be created, then stop
  --help              Show this message

Anything you do not pass is left as null or TBD, to be filled in by hand.
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]): Options {
  const options: Options = { year: 0, city: null, host: null, force: false, dryRun: false };
  let year: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '--help':
      case '-h':
        usage();
      // eslint-disable-next-line no-fallthrough
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--city':
        options.city = argv[++i] ?? usage('--city needs a value');
        break;
      case '--host':
        options.host = argv[++i] ?? usage('--host needs a value');
        break;
      default:
        if (arg.startsWith('-')) usage(`unknown option "${arg}"`);
        if (year !== null) usage(`unexpected extra argument "${arg}"`);
        year = arg;
    }
  }

  if (year === null) usage('a year is required');
  if (!/^\d{4}$/.test(year)) usage(`"${year}" is not a four-digit year`);

  const parsed = Number(year);
  const thisYear = new Date().getFullYear();
  if (parsed < thisYear || parsed > thisYear + 10) {
    usage(`${parsed} is outside the plausible range ${thisYear}–${thisYear + 10}`);
  }

  options.year = parsed;
  return options;
}

/** Substitute the template placeholders. */
function fill(text: string, options: Options): string {
  return text
    .replaceAll('{{YEAR}}', String(options.year))
    .replaceAll('{{CITY}}', options.city ?? 'TBD')
    .replaceAll('{{HOST}}', options.host ?? 'TBD');
}

/**
 * Write the city and host into conference.yaml if they were supplied. They are
 * `null` in the template, so a plain placeholder substitution would not reach
 * them.
 */
function applyKnownFacts(text: string, options: Options): string {
  let out = text;
  if (options.host) {
    out = out.replace(/^host: null$/m, `host: ${JSON.stringify(options.host)}`);
  }
  if (options.city) {
    // "Zürich, Switzerland" -> city: Zürich / country: Switzerland
    const [city, ...rest] = options.city.split(',').map((part) => part.trim());
    out = out.replace(/^city: null$/m, `city: ${JSON.stringify(city)}`);
    if (rest.length > 0) {
      out = out.replace(/^country: null$/m, `country: ${JSON.stringify(rest.join(', '))}`);
    }
  }
  return out;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const target = path.join(conferencesDir, String(options.year));
  const rel = path.relative(projectRoot, target);

  if (!fs.existsSync(templateDir)) {
    console.error(`Template directory is missing: ${path.relative(projectRoot, templateDir)}`);
    process.exit(1);
  }

  if (fs.existsSync(target) && !options.force) {
    console.error(
      `\n${rel}/ already exists.\n` +
        `Pass --force to overwrite it, or delete it first if you really mean to start over.\n`,
    );
    process.exit(1);
  }

  const files = fs.readdirSync(templateDir).filter((name) => /\.(ya?ml|mdx?)$/.test(name)).sort();

  if (options.dryRun) {
    console.log(`\nWould create ${rel}/ with ${files.length} files:`);
    for (const name of files) console.log(`  ${rel}/${name}`);
    console.log(`\nWould set site/ispass.yaml current_year to ${options.year}.`);
    console.log('\nNothing was written (--dry-run).\n');
    return;
  }

  fs.mkdirSync(target, { recursive: true });

  for (const name of files) {
    let text = fill(fs.readFileSync(path.join(templateDir, name), 'utf8'), options);
    if (name === 'conference.yaml') text = applyKnownFacts(text, options);
    fs.writeFileSync(path.join(target, name), text);
  }

  console.log(`\nCreated ${rel}/ (${files.length} files).`);

  /* --- point the evergreen landing page at the new edition ------------ */
  if (fs.existsSync(siteFile)) {
    const site = fs.readFileSync(siteFile, 'utf8');
    const updated = site.replace(/^current_year:\s*\d{4}\s*$/m, `current_year: ${options.year}`);
    if (updated !== site) {
      fs.writeFileSync(siteFile, updated);
      console.log(`Updated site/ispass.yaml: current_year is now ${options.year}.`);
    }
  }

  console.log(`
Next steps
  1. Edit ${rel}/conference.yaml — city, host, venue, dates, timezone, accent.
  2. Edit ${rel}/committee.yaml — add confirmed chairs only.
  3. Move the outgoing edition into site/ispass.yaml -> past_conferences,
     and set archived: true in its conference.yaml.
  4. npm run validate
  5. npm run dev  ->  http://localhost:4321/${options.year}/

Nothing was copied from a previous year: all dates are null, the committee is
empty, and every submission and registration link is null. That is deliberate.
`);
}

main();
