# scripts/ — what lives here and how to run it

Build-and-test tooling for the AON2026 Diazo theme. The theme itself is built
through `package.json` (`pnpm build`, `pnpm watch`); the files here are the
things `package.json` shells out to, plus a few one-shot maintenance scripts.

## Visual regression and accessibility

All three are driven from `package.json`, so you rarely invoke them directly —
but knowing they exist is the point of this file.

| Script | Invoked as | Purpose |
|---|---|---|
| `backstop-config.js` | `pnpm backstop:generate` | Generates `backstop.json` by combining `backstop.base.json` with the scenario sets. Flags select the target and the reference: `--prod`, `--ref-prod`, `--ref-local`, plus scenario subsets `--showcase`, `--link-styles`, `--listing-view`, `--quick [viewport]`, and `--headed`. |
| `a11y-test.js` | `pnpm a11y:test` | axe-core audit against rendered pages, reusing the BackstopJS scenarios and auth pattern. `--prod`, `--scenario=<label>`, `--feature=<name>`. Report: `pnpm a11y:report`. |
| `hover-contrast-test.js` | `pnpm hover:test` | WCAG SC 1.4.3 hover-state contrast check. Scans CSSOM for `:hover` rules, triggers each with Puppeteer, measures foreground/background contrast and reports violations. |

The `pnpm` script names follow a fixed grammar — `<set>:<action>[:<target>]`:

- **set** — `backstop` (all scenarios), `quick`, `showcase`, `link-styles`, `listing-view`
- **action** — `generate` (write `backstop.json`), `reference` (capture baselines), `test`, `approve`, `report`
- **target** — none = local, `:prod` = production URLs, `:cross` / `:prod-cross` = compare local against production references

### Known gap

`package.json` defines `showcase:copy-references`, `showcase:copy-references:dry-run`
and `showcase:process`, but `scripts/copy-showcase-references.js` and
`scripts/process-showcase-results.js` **do not exist in this repo** — they were
not carried over from `diazotheme.oag2025`. Those four npm scripts fail if run.
Either port the scripts across or drop the entries.

## Site and repo maintenance

| Script | Run as | Purpose |
|---|---|---|
| `create_site.py` | `bin/instance run scripts/create_site.py` | Creates a Plone site with this theme's profile installed. `DELETE_EXISTING=1` drops an existing site first. Standard cookieplone bootstrap; near-identical copies live in every addon repo. |
| `sync-from-oag2025.sh` | `bash scripts/sync-from-oag2025.sh [upstream-path] [upstream-branch]` | Read-only enumerator for the one-shot `oag2025` → `aon2026` theme sync. Walks `../diazotheme.oag2025`, applies the `oag2025` → `aon2026` rename normalisation, and emits a markdown worklist of files that differ. **Does not modify the working tree.** Refuses to overwrite an existing log unless `FORCE=1`. Exclusions live in `sync-from-oag2025.exclude`. |
| `domain-rename.sh` | `bash scripts/domain-rename.sh` | Sweeps a domain + organisation-name rename across the repo. Dry-run by default; `--apply` to write. Covers plain URLs, `www.`-prefixed, percent-encoded, `mailto:` addresses, and plain + URL-encoded org names in one pass. Shared across repos — see below. |

## Shared across repos

| Script | Location | Note |
|---|---|---|
| `dl_backup.sh` | repo root | Downloads and installs a Plone backup from S3. **Byte-identical in all nine OAG/AO repos** since v2.0.1; this site's bucket and storage paths live in `dl_backup.env` beside it. |
| `domain-rename.sh` | `scripts/` | Byte-identical in four repos. |

`./dl_backup.sh --version` reports the script version and the config schema it
requires; `--help` prints this repo's actual bucket and paths. **To change how
the script behaves, edit it here and copy the file to the other eight repos** —
the `dl_backup.env` files stay put. That is the point of the split: this script
previously existed in four divergent generations because its config was baked
in, so no copy could ever be replaced wholesale.

This repo's layout differs from the buildout repos — `instance/var/filestorage`
and `instance/var/blobs`, not `var/filestorage` and `var/blobstorage`. That
difference now lives in `dl_backup.env` instead of in the code.

Full cross-repo picture: **"Work repo scripts index"** in the knowledge vault.
