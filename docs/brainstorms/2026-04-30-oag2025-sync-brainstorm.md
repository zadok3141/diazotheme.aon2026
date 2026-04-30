---
date: 2026-04-30
topic: oag2025-sync
status: Approved
---

# One-Shot Sync from diazotheme.oag2025

## What We're Building

A reliable, verifiable, one-shot procedure to bring relevant changes from `diazotheme.oag2025` (current `devel` HEAD) into `diazotheme.aon2026`. After this sync, aon2026 evolves independently — there is no ongoing tracking obligation.

"Relevant" means: build infrastructure, theme source (SCSS), template overrides, browser code, ZCML, profile registry, test configs. *Not* relevant: built artifacts (CSS/JS in `theme/css/`, `theme/js/`, `dist/`), OAG-specific static content, OAG-specific page templates, OAG-specific portlets, OAG-specific brand colors, OAG-specific dependencies, project-history files (CHANGELOG, news fragments), backups, and local tooling state.

## Why This Approach

**File-state diff over commit replay.** The user does not need history fidelity — a one or two commit "Brought over from oag2025" landing is the desired output. Commit-by-commit cherry-pick would force replaying ~30 upstream commits including build-artifact churn, a revert chain, and a 2.0.0 release ceremony — all noise for a downstream sync.

**Review-first, Claude-led, never auto-apply.** The script's job is to *enumerate candidate changes*. Claude then walks the worklist with the user in a conversational loop: open the diff, summarize what changed and why, recommend a default action, ask the user to confirm/override. The user is the decision authority; Claude is the eyes, hands, and scribe. Each candidate is accepted, rejected, or modified by the user's call; Claude records the outcome in a sync log so the work is auditable and resumable across sessions. This is the difference between a sync *tool* (what we want) and a sync *daemon* (what we don't).

**Verifiability via a decision log.** Every divergent file or hunk between the rename-normalized upstream tree and aon2026 must end up in one of three columns: *applied*, *rejected (with reason)*, or *deferred*. After porting, re-running the enumerator must show no surprises — every remaining divergence is already accounted for in the log.

## Key Decisions

- **Workflow is Claude-led conversational triage, not automated patch.** The enumerator emits a candidate list; Claude walks it with the user one row at a time; Claude applies only what the user approves. No patch ever lands without explicit user acceptance in the chat.
- **Unit of triage: a divergent file** (not a hunk). Most files in this sync are small templates, configs, or short Python modules where whole-file review is faster and less error-prone than hunk-by-hunk. For a few large files (e.g. `package.json`, big SCSS bundles), Claude drops to hunk-level review and asks per-hunk.
- **Built artifacts are regenerated locally** from synced source after porting; they are never copied across.
- **Output shape: a small number of batched commits + one rebuild commit.** Claude proposes commit boundaries at the end of each category batch (e.g. `sync(toolchain)`, `sync(scss)`, `sync(templates)`) referencing the upstream sha; the user confirms before each. A final "Rebuild assets" commit lands after `make` regenerates CSS/JS. The user can also say "just one bulk commit at the end" — Claude defers commits in that case.
- **Rename rule applied to upstream side before diff:** `oag2025` → `aon2026`, `OAG2025` → `AON2026`, and path component `src/diazotheme/oag2025/` → `src/diazotheme/aon2026/`. File renames like `oag2025.scss` → `aon2026.scss`, `oag2025.js` → `aon2026.js`.
- **Reference upstream sha is pinned and recorded** in the sync commit message and in `docs/sync/sync-<date>.md`, so the next person can see exactly which upstream tree was used and what was decided.

### Path policy (high level — refined in the plan)

These categories drive the *default suggestion* the enumerator shows next to each candidate; they do not bypass review. Every divergent file in INCLUDE and REVIEW paths is presented to the human; EXCLUDE paths are filtered out so they never appear in the candidate list.

INCLUDE (default suggestion: port — but still ask):
- `package.json`, `pnpm-lock.yaml`, `postcss.config.js`, `pnpm-workspace.yaml`, `webpack/`, `.stylelintrc`, `.stylelintignore`
- `scripts/` (build, BackstopJS, a11y)
- `Makefile` frontend targets
- `scss/` (Barceloneta source)
- `src/diazotheme/<ns>/theme/scss/`
- `src/diazotheme/<ns>/theme/rules.xml`, `index.html`, `manifest.cfg`, `backend.xml`, `grid-col-marker.xml`
- `src/diazotheme/<ns>/browser/overrides/*.pt` (only files already adopted; new override files require explicit decision)
- `src/diazotheme/<ns>/browser/{common,utils,viewlets}.py` and ZCML
- `src/diazotheme/<ns>/{configure,dependencies,permissions}.zcml`
- `src/diazotheme/<ns>/profiles/default/registry/*.xml`
- `tests/` (theme-level)
- `backstop.base.json`, `backstop.testing.md` (not OAG-specific scenarios)
- `pyproject.toml` tooling sections (ruff config, etc.) — review only

EXCLUDE (filtered from the candidate list — not shown for review):
- `theme/css/`, `theme/js/`, `dist/` — built artifacts (regenerate)
- `theme/static/` — OAG static content
- `theme/templates/`, `theme/tinymce-templates/` — OAG page templates
- `feedbackportlet.*`, `tiles.py`, mosaic tile templates
- `setuphandlers/initial.py` and content payload
- `CHANGELOG.md`, `CHANGES.md`, `news/` — project-history
- `instance.yaml`, `mx.ini`, `requirements*.txt`, `constraints-mxdev.txt` — different dep set per project
- `branding-new/`, `tinified/`, `exports/`, `analysis_*`, `data/`, `notes/`, `planning/`, `sources/`
- `*.fsz*`, `*.tgz`, `current-backup-*`, `latest/`, dated backup dirs
- `node_modules/`, `.venv/`, `__pycache__/`, `.mypy_cache/`, `.ruff_cache/`, `.mxdev_cache/`
- `.git/`, `.serena/`, `.claude/`, `.envrc*`
- `backstop.scenarios.json`, `backstop.showcase.json`, `backstop.features.json`, `backstop.link-styles.json`, `backstop.listing-view.json` — OAG-specific scenarios
- `instance/`, `backstop_data/`

REVIEW (default suggestion: undecided — explicit human call):
- New override `.pt` files not yet present in aon2026 (e.g. `listing_album.pt`, `nextprevious.pt` from oag2025)
- New view templates in `browser/templates/` that aren't OAG-specific (rare)
- Brand-refactor patterns in SCSS where the *structure* is good but the *colors* must stay aon2026's (Midnight Forest decoupling work in oag2025 is the canonical example)
- `pyproject.toml` ruff/lint config changes
- Domain rename hunks (`oag.parliament.nz` → `ao.parliament.nz`) — drop, not relevant to aon2026

### The enumerator (read-only)

`scripts/sync-from-oag2025.sh <path-to-oag2025-checkout>` produces review material. It does **not** touch aon2026 source files.

1. Reads upstream HEAD sha; records it in the report header.
2. Stages a temporary copy of the upstream tree at `.sync-cache/oag2025-normalized/`, applies the rename rule in-place to file contents and file paths.
3. Filters to INCLUDE + REVIEW paths only (EXCLUDE never appears).
4. For each divergent file, emits one row in `docs/sync/sync-<date>.md`:
   - file path (post-rename)
   - category (INCLUDE / REVIEW)
   - status: `[ ]` unreviewed by default
   - decision column: blank, to be filled with `applied` / `rejected: <reason>` / `deferred: <reason>`
   - link/command to view the file diff (e.g. `diff .sync-cache/oag2025-normalized/<path> <path>`)
5. Also produces the normalized snapshot directory so the human can `cp` accepted files directly, or open them side-by-side in their editor.

### The Claude-led review loop

For each row in the worklist, Claude:

1. Reads the candidate file from the normalized snapshot and the corresponding aon2026 file (if present).
2. Summarizes the change in 1–3 lines: what changed, why upstream did it (from the commit log if useful), and a recommended action ("Suggest: port — pure infra, no OAG specifics" / "Suggest: reject — OAG brand color" / "Suggest: needs your call — affects template structure").
3. Shows the diff inline (or links to it for large files) and asks the user: **port / reject / modify / defer / skip-batch**.
4. On *port*: applies the file (or selected hunks) into aon2026, records `applied` + a one-line summary in the sync log row.
5. On *reject*: records `rejected: <user's reason or Claude's recap>`.
6. On *modify*: applies a user-directed variant (e.g. "port the structure but keep our colors"), records `modified: <how>`.
7. On *defer*: records `deferred: <reason>` and surfaces it again at the end of the run as a pending item.
8. On *skip-batch*: marks all remaining rows in the current category as deferred and moves to the next category.

Suggested batching order (Claude proceeds category by category, asking the user before each batch whether to start, skip, or save for later): build toolchain → root-level configs (`Makefile`, lint configs) → SCSS sources → theme skeleton (`rules.xml`, `index.html`, etc.) → browser overrides → browser views/utils/ZCML → profile registry → tests.

Once a batch is complete, Claude prompts to commit ("Ready to commit this batch as 'sync(toolchain): bring over webpack and pnpm changes from oag2025@<sha>'?") rather than committing unilaterally.

### Verification

When the worklist is exhausted, Claude re-runs the enumerator. Every row in the new report must already be present (with a decision) in the sync log, OR be a residual that maps cleanly to a documented `rejected` / `modified` reason. A clean run = no unreviewed rows. This is the auditable success signal — not "the diff is empty," but "every divergence is accounted for in writing." Claude reports the verification result and, if anything is unaccounted for, re-enters the review loop on those rows.

### Resumability

The sync log is the source of truth across sessions. If the loop is interrupted (user steps away, context resets), the next session reads `docs/sync/sync-<date>.md`, identifies rows with empty decision columns, and resumes from there. The normalized snapshot directory (`.sync-cache/oag2025-normalized/`) is gitignored and can be regenerated at any time from the recorded upstream sha.

## Open Questions

- Exact final form of the enumerator: pure shell with `rsync --include/--exclude` + `sed` for rename, or a Python script for clearer rename logic and report generation? (Defer to plan.)
- Report format: one markdown table per run, or per-category sub-tables? (Lean: per-category, easier to skim.)
- Should the per-row diff command be `diff -u`, `git diff --no-index`, or just an editor invocation? (Defer to plan — `git diff --no-index` gives nicest rename detection and color.)
- Pin point: oag2025 `devel` HEAD as of sync run, or last tagged release `2.0.0`? (Lean: `devel` HEAD — release tag is a marketing artifact for OAG, not a stability boundary for shared infra.)

## Next Steps

→ `/workflows:plan` to produce the enumerator script, exact rsync include/exclude rules, rename sed pipeline, the markdown report template, and the order of operations for the human reviewer.
