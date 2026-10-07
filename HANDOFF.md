# Handover — ISPASS Web Chair

Everything you need for normal operation. Should take about 30 minutes.

If you only read one thing: **conference content lives in
`conferences/<year>/`. You almost never need to touch `src/`.**

---

## 1. Install

You need [Node.js](https://nodejs.org) 20.3 or newer. Check `.nvmrc` for the
version this project is tested against; if you use `nvm`, run `nvm use`.

```bash
git clone <repository-url>
cd ispass_website
npm install
```

## 2. Run it locally

```bash
npm run dev
```

Open <http://localhost:4321/>. Edits to any file under `conferences/` appear
immediately — no restart.

- <http://localhost:4321/> — the evergreen ISPASS landing page
- <http://localhost:4321/2027/> — the ISPASS 2027 conference site

## 3. Where content lives

```
conferences/2027/        ← the entire ISPASS 2027 website
  conference.yaml        city, host, dates, timezone, phase, accent colour
  dates.yaml             EVERY deadline — the only place they may be written
  committee.yaml         chairs and the program committee
  links.yaml             every external system (HotCRP, registration, IEEE)
  announcements.yaml     news
  keynotes.yaml          speakers
  program.yaml           the schedule
  sponsors.yaml          logos by tier
  posters.yaml           accepted posters
  workshops.yaml         accepted workshops and tutorials
  *.md                   the long-form pages (CFP, submission, venue, visa…)

site/                    ← the evergreen ISPASS layer
  ispass.yaml            which year is current, past editions, policies
  about.md
```

`src/` renders that content. You will rarely open it.

**Two rules, and the validator enforces both:**

1. Unknown is `null`, never the string `"TBD"`. The site shows `null` for you:
   *TBA* for a date, *TBD* or "to be announced" elsewhere.
2. A deadline is written **once**, in `dates.yaml`.

## 4. Change a date

Open `conferences/2027/dates.yaml`, find the row, fill in `date`:

```yaml
- id: paper
  name: "Full paper submission"
  date: 2026-12-15        # was null
  time: "17:00"           # optional; omit for an all-day deadline
  timezone: "AoE"         # ALWAYS check this. AoE ≠ your local time.
  category: submission
```

That is the only edit. The homepage, the Call for Papers, the submission page,
the Important Dates page and the `.ics` feed all update.

**If a deadline moves**, change the date *and* say so — never silently:

```yaml
  date: 2026-12-18
  extended: true
  note: "Extended from December 15."
```

## 5. Change a committee member

`conferences/2027/committee.yaml`:

```yaml
  - role: "Program Chair"
    people:
      - name: "Ada Example"
        affiliation: "Example University"
        url: "https://example.edu/~ada"   # optional, a public profile page
```

A role with `people: []` shows as "To be announced" — that is the correct state
until someone is confirmed, so leave it.

**Do not add email addresses.** The schema has no field for one, on purpose.
Contact goes through `contact_email` in `conference.yaml`, which should be a
role address rather than a person's.

## 6. Add an announcement

`conferences/2027/announcements.yaml`, at the top:

```yaml
- id: cfp-published            # a unique slug
  date: 2026-10-12
  title: "Call for Papers available"
  body: "One or two sentences."
  link: "/2027/cfp/"           # optional
  link_text: "Read the CFP"    # optional
  importance: high             # or normal
```

Newest is shown first; the homepage shows the three most recent.

The shipped file contains two entries marked `placeholder: true`. They render
with a visible "Example entry" badge. **Delete them before the site goes
public.**

## 7. Add a sponsor

`conferences/2027/sponsors.yaml` ships with dashed **placeholder slots** in
each tier so you can see where logos will go. Put the logo file in
`public/logos/` (SVG preferred), then replace a slot in the right tier:

```yaml
  - tier: "Gold"
    prominence: high
    sponsors:
      - name: "Company Name"            # was: { name: "Gold sponsor", placeholder: true }
        logo: /logos/company-name.svg
        url: "https://www.example.com/"
```

Delete any slots left over before the site goes public.

The ISPASS logo itself lives in `public/brand/`, with a short usage guide.

## 8. Add a page

Create `conferences/2027/my-page.md`:

```markdown
---
title: My Page
description: One sentence. Becomes the meta description and the page lede.
nav: attend        # conference | attend | authors | community | none
order: 60
---

Ordinary Markdown.

:::warning
A callout for something the reader must not miss.
:::
```

It is live at `/2027/my-page/` and appears in the "Attend" menu. No route to
add, no navigation list to update.

`:::note`, `:::warning` and `:::tbd` all work. Add
`show_dates: [submission]` to the frontmatter for a "Key dates" sidebar.

## 9. Update the program

`conferences/2027/program.yaml`. The shipped file is a **worked example marked
`sample: true`** — replace its `days:` wholesale and set `sample: false`.

```yaml
days:
  - date: 2027-04-26
    label: "Main Conference"
    slots:
      - start: "10:30"
        end: "12:00"
        sessions:                  # 2+ sessions here = parallel tracks
          - id: s1a                # unique; becomes the #anchor
            kind: papers           # papers | keynote | break | social |
                                   # poster | workshop | tutorial | admin
            title: "Session 1A: Machine Learning Systems"
            start: "10:30"
            end: "12:00"
            room: "Auditorium"
            chair: "Ada Example"
            papers:
              - title: "Characterizing Inference Latency"
                authors: ["Bo Sample (Sample Institute)"]
                award: "Best Paper Nominee"   # optional
                badges: ["Available"]         # optional artifact badges
```

The number of `sessions` in a slot **is** the number of parallel tracks.

Check it at a narrow window as well as a wide one, and print it to PDF — the
program has its own print stylesheet and people do print it.

## 10. Run the checks

```bash
npm run validate   # content: schemas, duplicate ids, links, missing images
npm run check      # TypeScript
npm run build      # validate, then build into dist/
npm run lint       # the built HTML: links, alt text, headings, metadata
npm test           # all of the above
```

`npm run validate` is the one that matters day to day, and it is fast. It
catches a malformed date, a duplicate id, a link to a page that does not exist,
a sponsor logo that is not in `public/`, and a keynote photo without alt text.

It prints **warnings** (placeholders still present, sample program still on)
without failing, and **errors** that stop the build.

## 11. Deployment

**Not set up yet, deliberately.** Nothing has been deployed and `ispass.org` has
not been touched.

The recommendation is **GitHub Pages deployed by GitHub Actions, from a public
repository in a GitHub organisation owned by ISPASS** — one account for the
code and the hosting, nothing extra to hand to the next Web Chair. Checks run on
every pull request; merging to `main` publishes.

Note that a *private* repository would not make the published site private —
on GitHub Pages the site is public either way — and it would cost money. What
keeps an unfinished site out of sight is simply not pointing `ispass.org` at it
yet.

Read [docs/deployment.md](docs/deployment.md) before changing hosting, and
especially before touching the DNS for `ispass.org`.

One thing to know now: when a hosting origin is chosen, set `origin` **and**
`base` in [`src/lib/site-config.mjs`](src/lib/site-config.mjs). Canonical URLs,
OpenGraph tags, the sitemap and `robots.txt` all derive from those. On a
`github.io/<repo>/` URL, `base` must be `'/<repo>/'`; on a custom domain it is
`'/'`. Getting that wrong is the usual cause of a Pages site with broken CSS.

## 12. Create next year's site

```bash
npm run new-conference -- 2028 --city "Zürich, Switzerland" --host "ETH Zürich"
```

This creates `conferences/2028/` from `templates/conference/` and points the
evergreen landing page at 2028.

It deliberately copies **nothing** from 2027: every date is `null`, the
committee is empty, and every submission and registration link is `null`. A
stale HotCRP link would send authors' papers to the wrong conference, so the
generator would rather give you an obvious blank.

What carries over is the policy prose — the CFP topic list, submission
requirements, artifact evaluation badges, camera-ready rules — with the year
substituted. Review it with the Program Chair rather than assuming it still
holds.

Then work through [docs/annual-checklist.md](docs/annual-checklist.md).

---

## The one thing that changes the homepage

`phase` in `conference.yaml`. It decides what the homepage leads with:

```
pre_cfp → cfp_open → submissions_open → review → accepted_papers
        → registration_open → program_published → conference → archived
```

At `submissions_open` the main button becomes **Submit a Paper** and points at
`links.yaml → paper_submission`. At `registration_open` it becomes **Register**.
At `program_published` it becomes **Program**.

Move the phase along as the cycle moves. That is the whole mechanism — there is
one homepage, not nine.

---

## When something breaks

| Symptom | Look at |
| --- | --- |
| `npm run validate` fails | It names the file and the field. Fix that. |
| A page is missing from the menu | `nav:` in its frontmatter, or `since_phase:` gating it |
| A date shows as TBA | `date:` is still `null` in `dates.yaml` |
| The wrong button on the homepage | `phase` in `conference.yaml` |
| A link 404s | `npm run build && npm run lint` finds every broken internal link |
| A section is missing from the homepage | It has no content yet — that is by design |

## Further reading

| Document | When |
| --- | --- |
| [docs/content-model.md](docs/content-model.md) | Every field, in detail |
| [docs/annual-checklist.md](docs/annual-checklist.md) | What to do, when |
| [docs/architecture.md](docs/architecture.md) | How the site is built |
| [docs/deployment.md](docs/deployment.md) | Before changing hosting or DNS |
| [docs/archives.md](docs/archives.md) | Before touching `public/ispassYYYY/` (don't) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions, if you are changing `src/` |
