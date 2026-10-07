# Archived editions

`public/ispass2000/` … `public/ispass2026/` are **frozen copies of every past
ISPASS website**, served at exactly the addresses they always had —
`ispass.org/ispass2019/`, `ispass.org/ispass2026/program.php` and so on. Those
addresses are cited in papers and mailing lists, so they must keep working
after the domain moves to GitHub Pages.

**Do not edit them.** They are historical records. If an archived page has a
problem, note it here rather than changing the page.

## What is there

- 26 editions, 2000–2026. **2002 is missing**: its directory was already gone
  from the old host, so it is recorded as `archive_status: missing` in
  `site/ispass.yaml` and shown as unavailable.
- 767 files (≈187 MB), taken from the old host on 7 October 2026.
- Three shared stylesheets the archives use from the site root:
  `public/ispass1.css`, `ispass4.css`, `ispass11.css`.
- A handful of links inside the archives were already broken on the old host
  (a missing stylesheet, a missing logo, two `workshops.tutorials.php` pages
  that returned a server error). They are listed in
  [`scripts/archive/manifest.json`](../scripts/archive/manifest.json) with
  their original status codes.

## The one change: `.php` pages

The 2017–2026 sites were PHP. A static host cannot run PHP, and will not
reliably show a `.php` file as a web page. So each page that was served at
`…/name.php` is stored as **`…/name.php/index.html`**. A static host serves a
folder's `index.html` at the folder's address, so `…/name.php` still works
(with a redirect to `…/name.php/`).

Because those pages are now served one folder deeper, their relative links
(`images/x.png`, `../ispass11.css`, `committee.php`) were rewritten to the
absolute paths they originally pointed at. Nothing else in any page was
changed; every non-PHP file is byte-for-byte identical to the original.

## How they were made, and how to check them

The scripts are in [`scripts/archive/`](../scripts/archive/):

| Script | Does |
| --- | --- |
| `mirror.py <out> <years>` | Downloads each edition from the old host, read-only, and writes `manifest.json` recording every URL and its status. |
| `convert.py <mirror> <out>` | Applies the `.php` change above. |
| `verify.py <base-url> <manifest> [mirror]` | Requests every original address from a served copy and checks every link inside every archived page. |

To re-check the archives in a build:

```bash
npm run build
cd dist && python3 -m http.server 4500 &      # serves folders like GitHub Pages
python3 scripts/archive/verify.py http://127.0.0.1:4500 scripts/archive/manifest.json
```

It should report 767 / 767 addresses loading, and no newly broken links other
than the already-missing 2002.

`mirror.py` reads from the old host's IP address (`66.96.146.129`), so it only
works while that hosting account exists.

## Adding a future edition

When ISPASS 2027 is over, it does not need copying: it is already part of this
site at `/2027/`. Set `archived: true` in `conferences/2027/conference.yaml`
and add it to `past_conferences` in `site/ispass.yaml` with `url: "/2027/"`.
