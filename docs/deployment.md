# Deployment

How the site gets from this repository to the web, and how to change where it
is served.

## What is deployed

A folder of static files. `npm run build` writes `dist/`: HTML, CSS, a little
optional JavaScript, images, calendar files and the sitemap — about 1 MB. No
code runs on the server, so any static host can serve it.

Node.js is needed only to **build** the site, on a laptop or in GitHub Actions.
Visitors receive plain files.

## How it works

The site is hosted on **GitHub Pages** and built by **GitHub Actions**. Two
workflows live in [`.github/workflows/`](../.github/workflows/):

- **CI** ([`ci.yml`](../.github/workflows/ci.yml)) runs on every pull request
  and every push to `main`: validate content, type-check, build, lint. It never
  publishes anything. Each run attaches the built site as a downloadable
  artifact, so a reviewer can see exactly what would go live.
- **Deploy** ([`deploy.yml`](../.github/workflows/deploy.yml)) runs on every
  push to `main`. It repeats the checks, then publishes `dist/` to GitHub Pages.
  `npm run validate` runs before anything is uploaded, so malformed content
  never reaches the live site.

While the repository is **private**, the deploy step is skipped automatically:
GitHub Pages is not available for private repositories on the free plan.
Making the repository public switches publishing on with no edits.

```
edit content on a branch
      │
      ▼
open a pull request ──► CI: validate · check · build · lint
      │                        │
      │                 all green?
      ▼                        ▼
review the artifact      merge to main
                               │
                               ▼
                         Deploy → GitHub Pages
```

### Recommended branch protection

- `main` is protected; changes arrive by pull request.
- The CI check must pass before merging.
- One approving review for content changes; two for changes under `src/`.

## Site address settings

Two values in [`src/lib/site-config.mjs`](../src/lib/site-config.mjs) control
every generated URL — canonical links, OpenGraph tags, the sitemap,
`robots.txt` and the calendar feeds:

| Setting | On a custom domain | On `<org>.github.io/<repo>/` |
| --- | --- | --- |
| `origin` | `https://ispass.org` | `https://<org>.github.io` |
| `base` | `'/'` | `'/<repo>/'` |

A wrong `base` is the usual cause of a GitHub Pages site with missing CSS and
broken links.

**Tip:** if the repository is named exactly `<org>.github.io`, GitHub serves it
at the root, `https://<org>.github.io/`, and `base` stays `'/'` everywhere —
nothing changes between the preview address and the custom domain except
`origin`.

## Connecting a custom domain

Two halves, both required:

1. **DNS**, at whoever hosts DNS for the domain, sends visitors to GitHub's
   servers.
2. **The custom domain setting** on GitHub tells those servers which site to
   show for that name.

Only DNS on its own gives GitHub's "Site not found" page; only the GitHub
setting on its own changes nothing, because visitors are still sent elsewhere.

### Before you start

- **Everything under the domain must already be in this repository.** DNS is
  domain-wide: once the domain points at GitHub, any path not in the published
  site returns 404 — including every archived `/ispassYYYY/` site. Archives
  belong in `public/ispassYYYY/`, which is copied verbatim into `dist/` and so
  keeps every historic URL working at its exact original path.
- **Inventory every existing DNS record** and keep a copy.
- **Lower the TTL** on the records you will change to 300 seconds, a day ahead,
  so both the switch and any rollback take effect within minutes.

### On GitHub

1. **Verify the domain** for the organization: organization settings → Pages →
   add the domain, then create the `TXT` record GitHub shows you (named
   `_github-pages-challenge-<org>`). This stops anyone else's GitHub Pages site
   from claiming the domain.
2. Set the custom domain in the repository: Settings → Pages → Custom domain.
   With the Actions-based deploy, no `CNAME` file is needed in the repository.

### DNS records

Make the apex (`ispass.org`) the canonical host, with `www` redirecting to it —
that is how ISPASS is cited in published papers. GitHub performs the redirect
once both are configured.

| Type | Host | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `AAAA` | `@` | `2606:50c0:8000::153` |
| `AAAA` | `@` | `2606:50c0:8001::153` |
| `AAAA` | `@` | `2606:50c0:8002::153` |
| `AAAA` | `@` | `2606:50c0:8003::153` |
| `CNAME` | `www` | `<org>.github.io` |
| `TXT` | `_github-pages-challenge-<org>` | value shown by GitHub |

Check these addresses against GitHub's documentation on the day. If the DNS
provider supports `ALIAS`/`ANAME` at the apex, one `ALIAS @ → <org>.github.io`
can replace the eight `A`/`AAAA` records.

- **Remove other `A`, `AAAA`, `ALIAS` or `CNAME` records on `@`.** Leftovers
  break certificate issuance.
- **Do not touch mail records** — `MX`, SPF `TXT`, and any host the `MX` points
  at. Changing web records does not affect email; deleting records wholesale
  does.
- **Edit records in place; do not move nameservers.** Moving means recreating
  every record by hand, and anything missed breaks silently.

### After the DNS change

1. Wait for GitHub's DNS check to pass, then tick **Enforce HTTPS**. GitHub
   requests a Let's Encrypt certificate automatically — usually minutes; if it
   stalls, remove and re-add the domain.
2. Check:
   - `https://ispass.org/` shows the site.
   - `http://` and `https://www.` both redirect to `https://ispass.org/`.
   - **Every archive URL listed in `site/ispass.yaml` loads** — the check most
     likely to fail.
   - Email to the domain still arrives.
3. Restore the TTL once everything is confirmed.

**Rollback:** put the previous `A` records back. With a 300-second TTL, visitors
return to the old host within minutes.

## Previewing a change

GitHub Pages has no per-pull-request preview. Download the `site` artifact from
the CI run on the pull request, unzip it, and serve it locally:

```bash
npx serve site
```

## Accounts

Every account the site depends on — the GitHub organization, the domain
registrar, DNS — should be owned by ISPASS rather than by one person:

- at least **two owners**, one of them from the Steering Committee;
- a **shared role address** (for example a mailing list the committee
  controls) as the contact and recovery email — never an address on the
  domain itself, which would vanish with the domain;
- auto-renew and a registrar transfer lock enabled on the domain.

## Secrets

The site needs none to build or run. Never commit hosting or FTP passwords,
registrar logins, DNS API tokens, API keys or recovery codes. If a variable is
ever needed, document it in `.env.example` with an empty value and keep the
real `.env` out of git (it is already in `.gitignore`).
