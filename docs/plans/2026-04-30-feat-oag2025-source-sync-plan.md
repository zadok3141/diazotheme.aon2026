---
title: "feat: OAG2025 Source Sync Tooling and Runbook"
type: feat
status: active
date: 2026-04-30
upstream-pin: oag2025@ab06ff8c81fb433e3908a9b29b1f8e9830fdaf7b
brainstorm: docs/brainstorms/2026-04-30-oag2025-sync-brainstorm.md
revised-after: multi-agent review (simplicity, architecture, spec-flow, pattern, agent-native, learnings)
---

# OAG2025 Source Sync Tooling and Runbook

## Overview

One-shot, Claude-led, conversational triage to bring relevant changes from `diazotheme.oag2025` (`devel @ ab06ff8`) into `diazotheme.aon2026`. Delivers (1) a small shell-based enumerator, (2) a checkbox-style sync log Claude maintains during the conversation, (3) a runbook for the review loop. After this sync, aon2026 evolves independently.

The enumerator is read-only and produces a worklist; Claude walks it with the user, opens each diff, recommends an action, and only applies what the user confirms. Built artifacts (`theme/css/`, `theme/js/`) are regenerated locally from synced sources, never copied across.

## Why this shape

The brainstorm rationale (`docs/brainstorms/2026-04-30-oag2025-sync-brainstorm.md`) holds: file-state diff over commit replay, review-first never auto-apply, decision log as auditable artifact. After multi-agent review, the implementation collapsed to "shell + rsync + sed + `diff -rq` + checkboxes" because (a) `rsync --exclude-from` handles directory-tree exclusion natively whereas Python's `fnmatch` does not, (b) idempotent log preservation is unnecessary for a one-shot, (c) the unit of triage is a checkbox row, not a structured field, and (d) the project's `scripts/` directory is already polyglot (`create_site.py`, `domain-rename.sh`, three `.js` tools), so a shell entry is the lowest-friction fit.

## Deliverables

1. `scripts/sync-from-oag2025.sh` — bash enumerator (~40 lines, stdlib only).
2. `scripts/sync-from-oag2025.exclude` — rsync-style exclude file (the path policy).
3. `Makefile` target: `sync-oag2025`.
4. `.gitignore` entry for `.oag2025-sync-cache/`.
5. Generated during runs (committed): `docs/sync/<YYYY-MM-DD>-oag2025-sync-log.md`.

## Path policy

The enumerator copies the upstream tree minus everything in the exclude file. Anything left becomes a sync candidate. There is no INCLUDE/REVIEW distinction — every divergent file is reviewed during triage, with the user's judgment as the only filter beyond the policy.

If during triage the user wants to inspect an excluded category (e.g. ruff config in `pyproject.toml`, towncrier config, root dotfiles), they can `diff -u ../diazotheme.oag2025/<path> <path>` manually. Pre-routing those through the worklist costs more noise than it's worth.

### `scripts/sync-from-oag2025.exclude` contents

```
# Tool state and caches
.git/
.serena/
.claude/
.envrc
.envrc.local
.mxdev_cache/
.mypy_cache/
.pytest_cache/
.ruff_cache/
.venv/
__pycache__/
node_modules/
*.egg-info/

# Built artifacts
dist/
build/
theme/css/
theme/js/
backstop_data/
backstop.json

# OAG static content and brand assets (theme-internal)
theme/static/
theme/templates/
theme/tinymce-templates/
theme/tinymce/
theme/webfonts/
theme/roboto/
theme/preview.png
theme/oag2025-favicon.*
theme/oag2025-apple-touch-icon*

# OAG-specific code
feedbackportlet.py
feedbackportlet.pt
browser/tiles.py
setuphandlers/initial.py
upgrades/
controlpanel/

# Per-project profile files
profiles/default/browserlayer.xml
profiles/default/portlets.xml
profiles/default/types.xml
profiles/default/controlpanel.xml
profiles/default/metadata.xml

# Per-project i18n
locales/diazotheme.oag2025.pot
locales/**/*.po
locales/**/*.mo

# Per-project metadata and config
instance.yaml
mx.ini
requirements*.txt
constraints-mxdev.txt
setup.py
MANIFEST.in
bobtemplate.cfg
.mrbob.ini
pyproject.toml
.flake8
.pre-commit-config.yaml
.editorconfig
.gitignore
.gitattributes

# Project history and free-form docs
news/
CHANGELOG.md
CHANGES.md
CONTRIBUTORS.md
LICENSE.GPL
LICENSE.md
README.md
HOWTO_DEVELOP.md
demo.md
toolbar-demo.html
docs/

# Backups and work directories
branding-new/
tinified/
exports/
data/
notes/
planning/
sources/
analysis_*/
2026-*
*.fsz
*.fsz-*.tgz
*.tgz
current-backup-*/
latest/
dl_backup.sh
instance/

# OAG-specific test scenarios (keep base config and notes)
backstop.scenarios.json
backstop.showcase.json
backstop.features.json
backstop.link-styles.json
backstop.listing-view.json
```

## Rename normalization

Applied to file contents and file paths in the snapshot, in this order. **Order is critical:** the longest-match rules run first to avoid mid-substring substitution. The Feb 2026 fork's renaming strategy established this; the learnings researcher confirmed the namespace-first ordering.

1. `diazotheme.oag2025` → `diazotheme.aon2026` (full namespace; must run before bare `oag2025` rule)
2. `++theme++oag2025` → `++theme++aon2026` (Diazo theme resource URL)
3. `OAG2025` → `AON2026` (case-sensitive, all-caps)
4. `Oag2025` → `Aon2026` (case-sensitive, title case)
5. `oag2025` → `aon2026` (lowercase fallback)
6. Path components: any filename or directory containing `oag2025` is renamed to use `aon2026`.

**Out of scope for the rename rule** (handled per-row during triage):

- `oag.parliament.nz` / `ao.parliament.nz` — domain change internal to oag2025; aon2026 lives under a different domain. Reject these hunks.
- Bare `OAG` (3 letters) — too risky to auto-substitute. User decides per occurrence.
- Brand color tokens (`$oag-bark`, `$oag-teal`, `$oag-moss`, etc.) — keep aon2026's palette. Reject color-value hunks.
- Footer copy ("Office of the Auditor-General", "The Audit Office") — reject.

## The enumerator script

`scripts/sync-from-oag2025.sh`:

```bash
#!/usr/bin/env bash
# scripts/sync-from-oag2025.sh — read-only enumerator.
# Walks ../diazotheme.oag2025, applies path-policy filter and rename normalization,
# writes a normalized snapshot and a markdown worklist of divergent files.
set -euo pipefail

UP="${1:-../diazotheme.oag2025}"
BRANCH="${2:-devel}"

[[ -d "$UP/.git" ]] || { echo "fatal: $UP is not a git repo" >&2; exit 1; }
SHA="$(git -C "$UP" rev-parse "$BRANCH")"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXCLUDE="$SCRIPT_DIR/sync-from-oag2025.exclude"
SNAP=".oag2025-sync-cache/normalized"
LOG="docs/sync/$(date -I)-oag2025-sync-log.md"

if [[ -e "$LOG" && "${FORCE:-0}" != "1" ]]; then
  echo "fatal: $LOG already exists; commit or delete it, or run with FORCE=1" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG")" "$SNAP"
rm -rf "$SNAP" && mkdir -p "$SNAP"

# 1. Copy upstream tree minus excluded paths.
rsync -a --exclude-from="$EXCLUDE" "$UP/" "$SNAP/"

# 2. Rename file paths (depth-first; handles nested dirs).
find "$SNAP" -depth -name '*oag2025*' -execdir bash -c '
  for f in "$@"; do mv "$f" "${f//oag2025/aon2026}"; done
' _ {} +

# 3. Rename file contents (longest match first).
grep -rlIZ -e diazotheme.oag2025 -e '++theme++oag2025' \
              -e OAG2025 -e Oag2025 -e oag2025 "$SNAP" \
  | xargs -0 -r sed -i \
      -e 's|diazotheme\.oag2025|diazotheme.aon2026|g' \
      -e 's|++theme++oag2025|++theme++aon2026|g' \
      -e 's/OAG2025/AON2026/g' \
      -e 's/Oag2025/Aon2026/g' \
      -e 's/oag2025/aon2026/g'

# 4. Emit worklist.
{
  printf -- '---\ndate: %s\nupstream-sha: %s\nupstream-branch: %s\n---\n\n' \
    "$(date -I)" "$SHA" "$BRANCH"
  printf '# OAG2025 sync log — pinned to oag2025@%s\n\n' "${SHA:0:7}"
  printf 'Inspect each row: `diff -u %s/<path> <path>`\n' "$SNAP"
  printf 'New files (only in upstream): `cat %s/<path>`\n\n' "$SNAP"
  printf '## Files differing from snapshot\n\n'
  diff -rq "$SNAP/" . 2>&1 \
    | grep -E "^Files .* differ\$|^Only in $SNAP" \
    | sed -E \
        -e "s|^Files $SNAP/(.+) and \\./(.+) differ\$|- [ ] \1 — differs|" \
        -e "s|^Only in $SNAP: (.+)\$|- [ ] \1 — new (only in upstream)|" \
        -e "s|^Only in $SNAP/(.+): (.+)\$|- [ ] \1/\2 — new (only in upstream)|"
} > "$LOG"

echo "Wrote $LOG"
echo "Pinned: oag2025@$SHA ($BRANCH)"
```

Why rsync? Its `--exclude-from` is *path-aware*: a pattern like `node_modules/` correctly excludes the whole tree, unlike Python's `fnmatch` against a flat path string. This was the architecture review's headline P1 finding; choosing rsync resolves it without writing custom exclusion logic.

The script does not check upstream cleanliness, has no `--check` mode, has no `--sha` flag. **Re-running is the verification.** It refuses to overwrite an existing log unless `FORCE=1` so a session's checkbox annotations aren't silently lost.

### Makefile target

Add to `Makefile`:

```makefile
.PHONY: sync-oag2025
sync-oag2025: ## Enumerate divergences from ../diazotheme.oag2025 (read-only)
	@bash scripts/sync-from-oag2025.sh
```

(No `-check` target; re-running the same target with `FORCE=1` and comparing the new worklist to the prior committed log is the verification.)

## Worklist format

The script writes a dated markdown file with frontmatter and a flat checkbox list — no per-row YAML, no `Status:` field, no `Decision:` field:

```markdown
---
date: 2026-04-30
upstream-sha: ab06ff8c81fb433e3908a9b29b1f8e9830fdaf7b
upstream-branch: devel
---

# OAG2025 sync log — pinned to oag2025@ab06ff8

Inspect each row: `diff -u .oag2025-sync-cache/normalized/<path> <path>`
New files (only in upstream): `cat .oag2025-sync-cache/normalized/<path>`

## Files differing from snapshot

- [ ] package.json — differs
- [ ] pnpm-lock.yaml — differs
- [ ] webpack/dev.config.js — differs
- [ ] src/diazotheme/aon2026/theme/scss/_variables.scss — differs
- [ ] src/diazotheme/aon2026/browser/overrides/listing_album.pt — new (only in upstream)
- [ ] src/diazotheme/aon2026/browser/overrides/nextprevious.pt — new (only in upstream)
- ...
```

Claude annotates each row inline as the conversation proceeds. Free-text annotation after the em-dash; checkbox state for "decided / not decided":

```markdown
- [x] package.json — applied (rejected name/version hunks)
- [x] pnpm-lock.yaml — applied (regenerated locally via pnpm install)
- [x] webpack/dev.config.js — rejected (OAG-specific entry point)
- [x] _variables.scss — modified (ported decoupling structure, kept aon2026 colors; hunks 1,3,7 applied; 2,4,5,6 rejected as brand colors)
- [x] listing_album.pt — applied (generic Plone listing, no OAG specifics)
- [x] nextprevious.pt — deferred (need to discuss whether navigation pattern fits aon2026 IA)
```

Resume across sessions reads this file; the first `- [ ]` row is where to pick up.

## Conversational loop runbook

### Pre-loop (Claude verifies)

1. `../diazotheme.oag2025` exists and is a git repo.
2. aon2026 working tree is clean (`git status --porcelain` empty). Refuse to start if dirty.
3. aon2026's `.venv/` exists. If not, ask user to run `make install` first and stop.
4. Current branch is `devel`. If not, ask the user to type the branch name back to confirm sync commits should land there.
5. Run `make sync-oag2025`.
6. Read the worklist. Show summary count to user. Confirm the upstream sha (recorded in frontmatter) matches what the user expects.

### Per-row triage (Claude leads, user decides)

For each unchecked row in worklist order:

1. **Show the diff.** `Bash diff -u .oag2025-sync-cache/normalized/<path> <path>` (or `cat .oag2025-sync-cache/normalized/<path>` for new files).
2. **Summarize in 1–3 lines.** What changed; whether anything looks OAG-specific (brand color, domain string, OAG copy, OAG-only feature); recommended action (port / reject / look more closely).
3. **For diffs longer than ~100 lines:** don't paste the full diff. List hunks numbered 1..N with one-line summaries; ask user to choose.
4. **Ask user:** `port` / `reject` / `modify` / `defer` / `show-more` / `pause`.
5. **Apply the user's decision** (see Decision actions below).
6. **Update the row in place.** Use `Edit` with the path-anchored line (`- [ ] <path> — differs` or `… — new …`) as the unique `old_string`.
7. **Move to the next row.**

### Decision actions

- **`port` (whole file).** `Bash mkdir -p $(dirname <path>) && cp -p .oag2025-sync-cache/normalized/<path> <path>`. `cp -p` preserves mode bits (matters for `*.sh` adoptions). Update row to `- [x] <path> — applied`.

- **`reject`.** No tree change. Update row to `- [x] <path> — rejected (<reason>)`.

- **`modify` (partial port — most common for SCSS files mixing structural changes with brand colors).** Procedure:
  1. Generate the full diff: `Bash diff -u .oag2025-sync-cache/normalized/<path> <path>`.
  2. Number the hunks 1..N. Summarize each in one line (e.g. "hunk 3: decouples `$link-color` from `$primary-color`"; "hunk 5: changes `$primary-color` value to midnight forest").
  3. Ask the user: which hunks to apply? (e.g. "1, 3, 7" or "all except color values")
  4. **Primary mechanism — per-hunk `Edit`:** for each chosen hunk, derive `old_string` from the hunk's `-` lines plus enough surrounding context to be unique, and `new_string` from the corresponding `+` lines plus the same context. Run `Edit`. Repeat per hunk.
  5. **Fallback mechanism — `patch`:** if hunks are too numerous or too overlapping for clean per-hunk Edit, write the chosen hunks to `.oag2025-sync-cache/<basename>.partial.patch` (preserve the `---`/`+++` headers from `diff -u`), then `Bash patch -p1 -d . < .oag2025-sync-cache/<basename>.partial.patch`. Add `patch` to the prerequisites list (universally available on Linux/macOS; declared for completeness).
  6. **Verify after applying:** re-run `Bash diff -u .oag2025-sync-cache/normalized/<path> <path>`. Show the user the residual divergence; confirm the chosen hunks landed and only the rejected hunks remain divergent.
  7. Update row to `- [x] <path> — modified (hunks A,B,C applied; D,E,F rejected — <reason>)`.

- **`defer`.** No tree change. Update row to `- [x] <path> — deferred (<reason>)`. Defer means *permanently for this session* — record for follow-up issue or later session.

- **`pause`.** No row change. Bookmark the row in conversation; offer to discuss adjacent context, look at other code, or simply wait. The row stays `- [ ]`. Resume on user signal.

- **`show-more`.** A menu, not a terminal action. Options:
  - Full diff (raw `diff -u` output).
  - Full snapshot file (`Read` it).
  - Full aon2026 file (`Read` it).
  - Upstream commit history: `Bash git -C ../diazotheme.oag2025 log -p --follow -- <upstream-original-path>`. Useful for understanding intent and detecting upstream renames.
  - Related-file scan: `Bash grep -rln "<symbol>" src/`.

  Pick one, then return to the row's `port / reject / modify / defer` prompt.

### Batch ordering and commits

Suggested batch order — informational; the loop is per-row, but commits are proposed at batch boundaries:

1. Build toolchain & root configs (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `postcss.config.js`, `webpack/`, `.stylelintrc`, `.stylelintignore`, `Makefile`, `scripts/*.js`)
2. SCSS sources (`scss/`, `src/diazotheme/aon2026/theme/scss/`)
3. Diazo theme skeleton (`rules.xml`, `index.html`, `manifest.cfg`, `backend.xml`, `grid-col-marker.xml`)
4. Browser overrides (`browser/overrides/*.pt`)
5. Browser code & ZCML (`common.py`, `utils.py`, `viewlets.py`, `browser/configure.zcml`, `browser/templates/`)
6. Package ZCML (`configure.zcml`, `dependencies.zcml`, `permissions.zcml`)
7. Profile registry & theme (`profiles/default/registry/`, `profiles/default/theme.xml`, `profiles/default/types/Document.xml`)
8. Tests & top-level test infra (`tests/`, `backstop.base.json`, `backstop.testing.md`)

After completing a batch (or when the user says "commit"), Claude proposes a commit using **existing project commit types** (`feat`, `fix`, `chore`, `build`, `style`, `docs`, `refactor`, `test` — no parenthesized scopes; this matches `git log --oneline` history):

| Batch | Suggested type & message |
|---|---|
| Build toolchain | `chore: import build toolchain from oag2025@ab06ff8` |
| SCSS sources | `feat: port structural SCSS refactors from oag2025@ab06ff8` |
| Diazo theme skeleton | `feat: update Diazo theme skeleton from oag2025@ab06ff8` |
| Browser overrides | `feat: adopt template overrides from oag2025@ab06ff8` |
| Browser code & ZCML | `refactor: update browser views and ZCML from oag2025@ab06ff8` |
| Package ZCML | `refactor: update package ZCML from oag2025@ab06ff8` |
| Profile registry & theme | `feat: update profile registry from oag2025@ab06ff8` |
| Tests & test infra | `test: update test infra from oag2025@ab06ff8` |
| Final asset rebuild | `chore: rebuild theme assets after oag2025 sync` |

Commit policy:

- **Working-tree changes occurred:** `git add <specific paths> docs/sync/<log-file>` and commit with the batch message.
- **No working-tree changes (all rejects/defers):** `git add docs/sync/<log-file>` and commit `docs: record oag2025 sync decisions for <batch>`. The log progresses; the working tree doesn't.
- **Never `git add -A` or `git add .`.** Always path-scoped. The user may have unrelated edits in another shell.

### Special handling: SCSS Midnight Forest pattern

oag2025's 2.0.0 release decoupled `$link-color` from `$primary-color` and changed the primary palette to "Midnight Forest." For aon2026 we want the **structural decoupling** (good engineering) without the **color values** (we keep our palette).

Per-hunk classification rule for SCSS:

- Hunk that changes a `$<token>: <color>;` value → reject.
- Hunk that introduces or refactors variable plumbing (e.g. extracting `$link-color` from `$primary-color`) → port.
- Hunk that updates a selector or fixes an accessibility issue → port.
- Hunk that adds rules for OAG-specific selectors (`.crossword`, `.quiz-page`, etc.) → reject.

This is exactly the case the `modify` action's per-hunk Edit mechanism is designed for.

### Special handling: lockfile

`pnpm-lock.yaml` always pairs with `package.json`. After porting `package.json` (with name/version hunks rejected), don't try to merge the snapshot's lockfile content. Instead:

1. Reject the lockfile diff against snapshot in the worklist.
2. Run `Bash pnpm install` — resolves the new `package.json` deps into a fresh lockfile.
3. Mark the lockfile row `applied (regenerated locally via pnpm install)`.

Re-running the enumerator afterward will still show the lockfile as differing from the snapshot (different OS, registry resolution, pnpm version) — expected and unavoidable. Note in the row, move on.

### Resume across sessions

If interrupted:

1. Read `docs/sync/<latest-date>-oag2025-sync-log.md`.
2. Find the first `- [ ]` row; resume there.
3. **Working tree may be dirty** (changes applied but not yet committed). Run `Bash git diff` and cross-reference with checked rows. Either commit-as-progress with a partial-batch message, or continue and commit at the next batch boundary.
4. **If `.oag2025-sync-cache/` was deleted:** the snapshot is regenerable from the upstream sha pin. Before re-running the enumerator, compare the upstream's current `devel` HEAD to the log's `upstream-sha`:

   ```bash
   git -C ../diazotheme.oag2025 rev-parse devel    # current
   grep upstream-sha docs/sync/<date>-oag2025-sync-log.md   # pinned
   ```

   If they match, just re-run the enumerator (FORCE=1 if the log already exists — but only after committing it first). If they differ, the user decides:
   - Reset upstream to the recorded sha: `git -C ../diazotheme.oag2025 checkout <pinned-sha>`, re-run the enumerator, do work, return upstream to `devel` afterward.
   - Or accept drift: update the log's `upstream-sha` and add a row note recording the change, then re-run.

5. **Do not re-run the enumerator mid-session** unless explicitly verifying. The script overwrites the log; checkbox annotations from the in-progress run are lost from the file (recoverable from git if committed, working memory if not). Run it once at start, drive to completion, then run for verification.

### Verification (after worklist exhausted)

1. Commit the completed log (if not already committed in batches).
2. Re-run the enumerator: `FORCE=1 make sync-oag2025`.
3. `git diff HEAD~1 -- docs/sync/<date>-oag2025-sync-log.md` to compare new worklist against the just-committed prior version. Every row in the new worklist should be either:
   - A row from the prior log that was rejected, modified, or deferred (the file is still divergent because we chose not to fully port it — expected).
   - A "regenerated locally" entry like `pnpm-lock.yaml` (expected).
   - **Anything else is unaccounted** — re-enter the loop on it.
4. `make install`, `make`, `make check`, `make test`. Address any failures (see Test failure handling).
5. Final commit: `chore: rebuild theme assets after oag2025 sync` with `git add theme/css/ theme/js/ <any-regenerated>`.

### Test failure handling

If `make test` fails after sync:

1. Identify the failing test.
2. Classify:
   - (a) Generic test, broken by a real bug we just synced → fix the sync (revert the offending hunk or adapt the test).
   - (b) OAG-fixture-bound test that was synced incorrectly → revert the test sync.
   - (c) Test was already broken pre-sync, unrelated → note and move on.
3. Default action when uncertain: **revert the synced test.** Sync scope is "import source"; rewriting tests beyond what oag2025 has is out of scope.

### Definition of done

- All worklist rows are `- [x]`.
- Verification re-run shows no unaccounted divergence.
- `make check` and `make test` pass.
- Dev server starts (`make start`) and the home page renders without console errors.
- All sync commits in `git log` reference the upstream sha pin (`oag2025@ab06ff8`).

## Implementation order

1. **Phase 1 — Enumerator.** Write `scripts/sync-from-oag2025.sh` and `scripts/sync-from-oag2025.exclude` per the script and policy above. Add the `Makefile` `sync-oag2025` target. Add `.oag2025-sync-cache/` to `.gitignore`. Run `make sync-oag2025` and spot-check:
   - Snapshot under `.oag2025-sync-cache/normalized/` has no excluded paths (no `theme/static/`, no `theme/css/`, no `node_modules/`, no `.venv/`, no backup tarballs).
   - Renames applied: `src/diazotheme/aon2026/__init__.py` exists (not `oag2025`); `package.json` content references `@diazotheme/aon2026`; `manifest.cfg` references `++theme++aon2026`.
   - Worklist size is reasonable (tens of entries, not thousands). If thousands, the exclude file has a gap.
2. **Phase 2 — Triage.** Run the conversational loop per the runbook. Estimate 4–8 hours of focused work.
3. **Phase 3 — Verify and rebuild.** Re-run, address residuals, `make install && make && make check && make test`, commit assets.

## Risks

- **Brand-color leak.** SCSS triage is the highest-stakes batch. Mitigation: explicit hunk classification rules; verify post-sync that `_variables.scss` (and similar) still hold aon2026 colors via `git diff <pre-sync-sha> -- src/diazotheme/aon2026/theme/scss/_variables.scss`.
- **Lockfile churn.** Expected and noted; not a regression.
- **Upstream sha drift mid-session.** Detected on resume by comparing live `git rev-parse devel` against log frontmatter.
- **Mid-row interruption.** Working tree may be partial. Recovered via `git diff` cross-referenced with checkbox state.
- **Decision-log corruption from lossy edits.** Mitigated by per-batch commits; `git log` is the recovery path.
- **Exclude file gap.** Default behavior on a missed pattern is "the file shows up as a candidate" — surfaces as a question, not a silent drop. The user rejects it and we iterate the exclude file if it's a recurring nuisance.

## References

- `docs/brainstorms/2026-04-30-oag2025-sync-brainstorm.md` — spec input (review-first, file-state diff, checkbox log).
- `docs/brainstorms/2026-02-18-theme-migration-brainstorm.md` — original fork rationale.
- `docs/plans/2026-02-18-feat-theme-migration-from-oag2025-and-intranet2021-plan.md` — original fork execution; this plan's path policy and rename rules descend from there.
- `scripts/create_site.py`, `scripts/domain-rename.sh` — sibling scripts in the same directory; new sync scripts live alongside.
- Upstream pin: `diazotheme.oag2025@ab06ff8c81fb433e3908a9b29b1f8e9830fdaf7b` (`devel`, captured 2026-04-30).

## Out of scope (explicit)

- Bidirectional sync.
- Continuous integration of upstream changes.
- Automatic conflict resolution.
- Importing OAG-specific tests, portlets, tiles, or static content.
- Any change to aon2026's brand identity.
- Routing through the worklist for files in `pyproject.toml`, `.flake8`, `.pre-commit-config.yaml`, `.editorconfig`, `.gitignore`, `.gitattributes` — excluded by policy. If the user wants to review them (e.g. `[tool.towncrier]` config, ruff rules), they `diff -u ../diazotheme.oag2025/<path> <path>` manually.
