# Annual checklist

What the Web Chair does, in the order the conference cycle does it.

Each step names the file to edit. Details are in
[content-model.md](./content-model.md); the short version is in
[HANDOFF.md](../HANDOFF.md).

After **every** change: `npm run validate`, then `npm run dev` and look at it.

---

## Initialization

*From the moment a Web Chair is appointed.*

- [ ] **Web Chair appointed** and given write access to the repository.
- [ ] Read [HANDOFF.md](../HANDOFF.md) (about 30 minutes).
- [ ] `npm install && npm run dev` — confirm the site runs locally.
- [ ] **Create the new year:**
      `npm run new-conference -- <year> --city "City, Country" --host "Institution"`
- [ ] **Archive the outgoing edition:**
      - set `archived: true` and `phase: archived` in its `conference.yaml`
      - add it to `past_conferences` in `site/ispass.yaml`, with
        `managed_here: true` and its `proceedings` link
- [ ] Confirm `current_year` in `site/ispass.yaml` points at the new year.
- [ ] **conference.yaml:** city, country, host, timezone, `description`,
      `accent`, `maintained_by`.
- [ ] **committee.yaml:** add only confirmed chairs. Leave the rest empty —
      they render as "To be announced".
- [ ] **Verify dates and venue with the General Chair.** Add them to
      `conference.yaml` (`start_date`, `end_date`, `venue`) and to
      `dates.yaml` (the `conference` row) as soon as they are fixed.
- [ ] Set a role `contact_email`, or leave it `null`.
- [ ] `phase: pre_cfp`.
- [ ] Post the first real announcement in `announcements.yaml` and **delete any
      remaining placeholder entries**.

## Call for Papers

- [ ] **dates.yaml:** fill in `abstract`, `paper`, `rebuttal`, `notification`.
      Check the timezone on each — `AoE` and a local time are different
      deadlines.
- [ ] **cfp.md:** review the topic list with the Program Chair; remove the
      "being prepared" callout.
- [ ] **links.yaml:** `paper_submission` — the **new** HotCRP instance for this
      year. Open the link and confirm it is this conference.
- [ ] **submission.md:** confirm page limit, formatting and anonymity rules with
      the Program Chair.
- [ ] Optional: a one-page CFP PDF in `public/files/`, linked as `cfp_pdf`.
- [ ] **dates.yaml:** `workshop-proposal`, `workshop-notification`.
- [ ] `phase: cfp_open`, then `submissions_open` once the site accepts uploads.
- [ ] Announce it in `announcements.yaml` with `importance: high`.

**If a deadline is extended:** change the date **and** set `extended: true` with
a `note` saying what it moved from. Do not silently edit it — people have
already planned around the old one.

## Review

- [ ] `phase: review`.
- [ ] **dates.yaml:** `artifact-registration`, `artifact-submission`,
      `artifact-notification`.
- [ ] **links.yaml:** `artifact_submission`.
- [ ] **artifact-evaluation.md:** confirm the badge set and the appendix
      template link with the AE Chairs; remove the "not announced" callout.
- [ ] **dates.yaml:** `poster-abstract`, `poster-notification`.
- [ ] **links.yaml:** `poster_submission`.
- [ ] **workshops.yaml:** once proposals are accepted, add the items and set
      `published: true`.

## Acceptance

- [ ] **accepted-papers.md:** the list of accepted papers.
- [ ] `phase: accepted_papers`.
- [ ] **dates.yaml:** `camera-ready`.
- [ ] **links.yaml:** `camera_ready` (the IEEE CPS portal).
- [ ] **camera-ready.md:** add the IEEE PDF eXpress **Conference ID** and
      confirm the page limits with the Publications Chair.
- [ ] **posters.yaml:** accepted posters, `published: true`.
- [ ] **dates.yaml:** `early-registration`, `hotel-block`.
- [ ] **links.yaml:** `registration`.
- [ ] **registration.md:** the rate table for this year.
- [ ] `phase: registration_open` once registration actually opens.

## Pre-conference

- [ ] **program.yaml:** the real schedule. Delete the sample days and set
      `sample: false`. Keep `draft: true` until the schedule is final.
- [ ] Check the program at 390px as well as on a laptop, and print it to PDF.
- [ ] **keynotes.yaml:** speakers, titles, abstracts, biographies, photos.
      Add `photo_alt` for every photo. Set `placeholder: false`.
      Resize photos to about 400×400 before committing — do not commit a
      multi-megabyte portrait.
- [ ] **workshops.yaml:** rooms and per-event schedules.
- [ ] **venue.md:** building, room, address, transit, hotel — and the
      **accessibility** section. Ask the venue directly; do not guess.
- [ ] **travel.md:** airports, ground transport, practical notes.
- [ ] **visa.md:** the host country's requirements, and who issues invitation
      letters.
- [ ] **dates.yaml + links.yaml:** `travel-grant`,
      `travel_grant_application`.
- [ ] **student-travel-grants.md:** confirm with the Travel Grants Chair.
- [ ] **sponsors.yaml:** replace placeholder slots with confirmed sponsors —
      logos in `public/logos/`, correct tiers. Check every sponsor URL loads.
      **Delete leftover slots** (`npm run validate` lists them).
- [ ] `phase: program_published` once the schedule is public.
- [ ] `draft: false` in `program.yaml` when the schedule is final.

## Conference week

- [ ] `phase: conference`. The Program becomes the primary action.
- [ ] **Verify every room and time against the printed signage.** This is the
      week when an error costs someone a talk.
- [ ] Announce practical details — room changes, wifi, banquet directions — in
      `announcements.yaml` with `importance: high`.
- [ ] Check the program on a phone, on the venue's own wifi.
- [ ] Any change to a room or time: edit `program.yaml`, `npm run validate`,
      redeploy. Never edit built output.

## Post-conference

- [ ] **program.yaml:** record awards on the winning papers (`award:`) and any
      artifact `badges`.
- [ ] Announce the award winners in `announcements.yaml`.
- [ ] **links.yaml:** `proceedings` — the IEEE Xplore link, once it exists.
- [ ] Slides and videos, where speakers have agreed: `public/files/`, linked
      from the session or paper `url`.
- [ ] `archived: true` and `phase: archived` in `conference.yaml`.
- [ ] Add the edition to `past_conferences` in `site/ispass.yaml`
      (`managed_here: true`, `archive_status: ok`, `proceedings`).
- [ ] **Hand over:** confirm the next Web Chair has repository access, point
      them at [HANDOFF.md](../HANDOFF.md), and tell them the one thing this
      document did not cover.

---

## Standing items

- **Never copy a link, a date or a person from a previous year.** The generator
  starts everything empty for this reason.
- **Unknown is `null`, not `"TBD"`.** The validator enforces it.
- Run `npm run validate` before every commit, and `npm test` before every
  deploy.
- If `archive_status` in `site/ispass.yaml` still says `broken` for the older
  editions, that backlog is still open — see
  [migration-plan.md](./migration-plan.md).
