# Content model

Every file a Web Chair edits, and what each field means.

The authority is [`src/lib/schema.ts`](../src/lib/schema.ts) — if a field is not
there, no page reads it. `npm run validate` checks every rule below.

## Two universal rules

1. **Unknown is `null`, never `"TBD"`.** Write `venue: null`. The site renders
   that as *TBD* for you, and often hides the surrounding section entirely.
   `npm run validate` rejects the literal string `TBD` as a value, because a
   string is indistinguishable from a real answer to the templates.
2. **A deadline is written exactly once**, in `dates.yaml`. Never in Markdown,
   never in a page template. Pages that need to show a deadline reference it by
   `id` or by category.

---

## `conferences/<year>/conference.yaml`

The core facts. Edit this first.

| Field | Type | Notes |
| --- | --- | --- |
| `short_name` | string | `"ISPASS 2027"`. Used in the wordmark and page titles. |
| `full_name` | string | The spelled-out symposium name. |
| `acronym` | string | Defaults to `ISPASS`. |
| `edition` | string \| null | e.g. `"27th"`. Confirm against the IEEE record. |
| `year` | number | Must equal the directory name. |
| `city`, `region`, `country` | string \| null | Shown in the hero and in the event metadata. |
| `host` | string \| null | Host institution. |
| `venue`, `venue_address` | string \| null | Building and street address. |
| `start_date`, `end_date` | `YYYY-MM-DD` \| null | Once set, these drive the hero, the schema.org event metadata and the date range shown everywhere. |
| `timezone` | IANA name | e.g. `America/New_York`. |
| `phase` | enum | See [below](#phase). |
| `tagline` | string \| null | Short line under the name. |
| `description` | string | Used verbatim as the meta description and OpenGraph description. At least 20 characters. |
| `accent` | `#rrggbb` | This edition's accent colour. Must clear 4.5:1 against white — the validator checks. |
| `maintained_by` | string | Footer credit. |
| `contact_email` | email \| null | **A role address, not a personal one.** |
| `archived` | boolean | `true` puts an "archived" banner on every page of the edition. |

### `phase`

One enum, nine values, driving the homepage. Change it as the cycle moves.

| Phase | Homepage leads with | Secondary |
| --- | --- | --- |
| `pre_cfp` | "Call for Papers coming soon" | Important Dates |
| `cfp_open` | Call for Papers | Important Dates |
| `submissions_open` | **Submit a Paper** (external) | Call for Papers |
| `review` | Important Dates, with the notification date | Call for Papers |
| `accepted_papers` | Accepted Papers | Important Dates |
| `registration_open` | **Register** (external) | Important Dates |
| `program_published` | Program | Register |
| `conference` | Program | Venue & Directions |
| `archived` | Program | Proceedings |

The phase also chooses which homepage sections appear and in what order — for
example keynotes surface from `accepted_papers` onward, and the program takes
the top slot from `program_published`. A section with no content drops out
regardless, so you never have to keep the two in step by hand.

Defined in [`src/lib/phase.ts`](../src/lib/phase.ts). Adding a phase means
adding one entry to `PHASE_PLAN`.

---

## `conferences/<year>/dates.yaml`

A list. **The only place a deadline may be written.**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | slug | Stable. Referenced by `phase.ts` and by the per-date `.ics` link. |
| `name` | string | What the visitor reads. |
| `date` | `YYYY-MM-DD` \| null | `null` until announced. |
| `time` | `HH:MM` \| null | 24-hour. Omit for an all-day deadline. |
| `end_date` | `YYYY-MM-DD` \| null | For ranges: a rebuttal period, the conference itself. |
| `timezone` | IANA name or `AoE` | **Always shown to the reader.** `AoE` is Anywhere on Earth, UTC−12. |
| `category` | enum | `submission`, `review`, `notification`, `camera_ready`, `artifact`, `poster`, `workshop`, `registration`, `travel_grant`, `conference`. Groups the row and lets a page ask for just its own dates. |
| `note` | string \| null | Short clarification under the date. |
| `extended` | boolean | Marks a deadline that was pushed back. **Say so; do not silently edit the date.** |
| `hidden` | boolean | Keep a row out of the public site without deleting it. |

Ids referenced by the phase logic — keep them: `paper`, `notification`,
`camera-ready`, `early-registration`.

An all-day deadline expires at 23:59 in its timezone. A deadline with a `time`
expires at that instant. Daylight-saving transitions are handled; see
`deadlineInstant` in [`src/lib/dates.ts`](../src/lib/dates.ts).

---

## `conferences/<year>/committee.yaml`

```yaml
roles:
  - role: "General Chair"
    people:
      - name: "Ada Example"
        affiliation: "Example University"
        url: "https://example.edu/~ada"   # optional, a public profile page
program_committee: []                      # [{ name, affiliation }]
extra_groups: []                           # [{ title, description, people }]
```

A role with an empty `people:` list renders as **"To be announced"**. Early in
the cycle that is the honest state, and the empty card is a visible prompt.
Delete a role only if this edition genuinely will not have it.

### No email addresses

`personSchema` has **no email field**, deliberately. The 2026 site publishes
several committee members' personal addresses in plain text, which is a
spam-harvesting target and outlives their involvement with ISPASS. Use `url:`
to link a public profile, and route contact through `contact_email` in
`conference.yaml` — a role address the committee controls.

If the organizers decide a particular address should be public, put it in the
relevant Markdown page as a deliberate, reviewable act.

---

## `conferences/<year>/links.yaml`

Every external system, in one place: `paper_submission`, `poster_submission`,
`artifact_submission`, `camera_ready`, `registration`,
`travel_grant_application`, `hotel_booking`, `proceedings`,
`workshop_proposals`, `cfp_pdf`, `sponsorship`.

A `null` link renders as "to be announced" rather than as a dead button, and
the homepage call-to-action switches itself on the moment a link exists.

> **Never copy a link from a previous year.** HotCRP instances, IEEE
> registration pages and CPS portals are per-conference. A stale
> `paper_submission` sends authors' work to the wrong conference. The
> `new-conference` generator sets all of these to `null` for this reason.

---

## `conferences/<year>/announcements.yaml`

```yaml
- id: cfp-published          # slug, unique
  date: 2026-10-12           # YYYY-MM-DD
  title: "Call for Papers available"
  body: "One or two sentences."
  link: "/2027/cfp/"         # optional
  link_text: "Read the CFP"  # optional
  importance: high           # normal | high
  placeholder: false         # true renders a visible "Example entry" marker
```

Rendered newest first; the homepage shows the three most recent. Entries with
`placeholder: true` are visibly marked, so an example can never be mistaken for
real news — and `npm run validate` warns while any remain.

---

## `conferences/<year>/keynotes.yaml`

`id`, `speaker`, `affiliation`, `title`, `abstract`, `bio`, `photo`,
`photo_alt`, `url`, `session_id`, `placeholder`.

Add an entry only once a speaker is confirmed. Until then leave the list empty:
the Keynotes page says speakers are "to be announced" and the homepage omits
the section. Entries marked `placeholder: true` are never shown, so the site
does not reveal how many talks are planned before that is decided.

`photo` is a path under `public/`, e.g. `/images/keynotes/ada-example.jpg`. The
validator fails if the file is missing, if `photo_alt` is absent, or if a
non-placeholder keynote has no speaker.

**Never carry speakers over from a previous year.**

---

## `conferences/<year>/program.yaml`

```yaml
sample: false        # true => renders a loud "sample content" banner
draft: true          # true => renders a "provisional" notice
timezone: "America/New_York"
legend:
  - { symbol: "★", meaning: "Best paper nominee" }
days:
  - date: 2027-04-26
    label: "Main Conference"      # defaults to the weekday name
    slots:
      - start: "10:30"
        end: "12:00"
        sessions:                 # two or more => parallel tracks, side by side
          - id: s1a               # unique; becomes the #anchor
            kind: papers          # papers | keynote | break | social | poster |
                                  # workshop | tutorial | admin
            title: "Session 1A: Machine Learning Systems"
            start: "10:30"
            end: "12:00"
            room: "Auditorium"
            chair: "Ada Example"
            papers:
              - title: "..."
                authors: ["Bo Sample (Sample Institute)"]
                award: "Best Paper Nominee"    # optional
                badges: ["Available"]          # artifact badges
                recorded: false
```

The number of `sessions` in a slot **is** the number of parallel tracks; no
other markup expresses that.

`sample: true` makes the page render an unmissable banner and marks it
`noindex`. The validator **fails the build** if `sample` is still true once
`phase` reaches `program_published`.

The shipped `conferences/2027/program.yaml` is a complete worked example, marked
as sample. Use it as a reference and replace it wholesale.

---

## `conferences/<year>/sponsors.yaml`, `posters.yaml`, `workshops.yaml`

- **sponsors** — `intro`, `contact`, `prospectus`, and `tiers[]` of
  `{ tier, prominence: high|medium|low, sponsors: [{ name, logo, url, placeholder }] }`.
  Logos live in `public/logos/`; the validator fails on a missing file.

  An entry with `placeholder: true` is a **reserved slot**, not a sponsor. It
  renders as an empty dashed tile, labelled "Sponsor logo", at exactly the size
  a real logo in its tier occupies, and the grid shows a "Placeholder" notice
  above it. The shipped 2027 file and the template both start with slots
  (2 Gold, 3 Silver, 4 Bronze, 3 Supporting) so the page and the homepage can
  be reviewed in their final shape.

  To add a confirmed sponsor, replace one slot in its tier:

  ```yaml
  - name: "Company Name"
    logo: /logos/company-name.svg
    url: "https://www.example.com/"
  ```

  Delete the remaining slots before launch; `npm run validate` warns while any
  are left, and **fails** if a slot has a `logo` or `url` (a sign it was meant
  to be a real sponsor). Never give a placeholder a real organisation's name or
  logo — appearing as a sponsor before agreeing to be one is a real problem.

  The nav's "soon" marker on Sponsors stays until a real sponsor exists;
  placeholder slots do not clear it.
- **posters** — `published: false` until notifications go out; then `posters[]`
  of `{ title, authors[], url }`.
- **workshops** — `published: false` until proposals are accepted; then
  `items[]`, each optionally carrying its own `schedule[]`.

While `published` is false, each page shows the relevant call and its deadline
instead of an empty list, and is marked `noindex`.

---

## Markdown pages

Any `.md` in `conferences/<year>/` becomes `/<year>/<filename>/`.

```markdown
---
title: Call for Papers
description: One sentence. Becomes the meta description and the page lede.
nav: authors            # conference | attend | authors | community | none
nav_label: Call for Papers   # optional, if shorter than the title
order: 10               # position within its nav group
draft: false            # true => builds, but unlinked and noindexed
show_dates: [submission, review]   # renders a "Key dates" sidebar
since_phase: accepted_papers       # optional: hide from nav until this phase
---
```

Adding a page is one file. It appears in the navigation automatically.

### Callouts

Three container directives are available in any Markdown page:

```markdown
:::note
Ordinary clarification.
:::

:::warning
Something the reader must not miss.
:::

:::tbd
Not yet confirmed.
:::

:::note[Custom heading]
A callout with your own label.
:::
```

Reserved slugs — a Markdown file may not use these, because a template owns the
route: `committee`, `dates`, `keynotes`, `program`, `sponsors`, `news`,
`accepted-posters`, `workshops`, `index`.

---

## `site/ispass.yaml` — the evergreen layer

| Field | Notes |
| --- | --- |
| `name`, `full_name`, `description`, `tagline` | Used on `/` |
| `current_year` | **Which conference `/` points at.** The one line to change at handover; `npm run new-conference` writes it for you. |
| `sponsors_note` | Shown on the landing page |
| `steering_committee`, `steering_committee_note` | People who oversee ISPASS across years |
| `policies[]` | `{ title, url, description }` — rendered on `/policies/` |
| `past_conferences[]` | See below |

```yaml
past_conferences:
  - year: 2026
    city: "Seoul"
    country: "South Korea"
    url: "https://www.ispass.org/ispass2026/"
    archive_status: ok       # ok | broken | missing | unknown
    managed_here: false      # true once served from this repository
    proceedings: null        # IEEE Xplore link
```

`archive_status` records whether the linked archive actually loads. It is
surfaced on `/previous/` so nobody is sent to a dead page without warning, and
so any dead archive stays visible. As of 29 September 2026 every edition loads
except 2002, which is `missing`.
