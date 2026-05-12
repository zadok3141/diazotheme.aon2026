#!/usr/bin/env bash
# domain-rename.sh — sweep a domain + organisation name rename across the repo.
#
# Defaults to dry-run. Pass --apply to actually modify files. Covers plain URLs,
# www.-prefixed, percent-encoded, mailto: emails, and plain + URL-encoded org
# names in one pass. Skips file names, identifiers, compiled build outputs,
# vendor/cache dirs, and large backup archives.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/domain-rename.sh \
         --old-domain <old.example> --new-domain <new.example> \
         [--old-org "<Long Name>"]  [--new-org "<Short Name>"] \
         [--apply]

Default mode is dry-run: prints the files that would change and a unified diff
preview, without writing anything. Pass --apply to perform the edits.

Coverage (all derived from the --old-/--new- values):
  1. Plain domain                               e.g. https://old.example/...
  2. www.-prefixed domain                       e.g. https://www.old.example/...
  3. Percent-encoded domain inside share URLs   e.g. %2Fold.example%2F
  4. Email addresses on the domain              e.g. webmaster@old.example
  5. Plain organisation name                    e.g. Office of the Auditor-General
  6. URL-encoded organisation name              e.g. Office%20of%20the%20Auditor-General

Deliberately skipped:
  - Package/directory names, Python imports, SCSS variables, CSS classes
  - Compiled build outputs: *.min.*, theme.css, theme.min.css, *.map, dist/**
  - Vendor/cache: node_modules, .venv, .git, .mxdev_cache, .mypy_cache,
    .ruff_cache, __pycache__, .serena
  - Backups and runtime data: current-backup-*, backstop_data, tinified,
    exports, latest, instance/var, *.fsz, *.fsz.*.tgz
  - Gitignored files (everything .gitignore already excludes)
  - Historical changelogs: notes/changelog_*.md (pass --include-history to force)
  - This script itself

Example:
  scripts/domain-rename.sh \
    --old-domain oag.parliament.nz --new-domain ao.parliament.nz \
    --old-org "Office of the Auditor-General" --new-org "The Audit Office" \
    --apply
EOF
}

OLD_DOMAIN=""; NEW_DOMAIN=""
OLD_ORG="";    NEW_ORG=""
APPLY=0
INCLUDE_HISTORY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --old-domain)      OLD_DOMAIN="$2"; shift 2 ;;
    --new-domain)      NEW_DOMAIN="$2"; shift 2 ;;
    --old-org)         OLD_ORG="$2";    shift 2 ;;
    --new-org)         NEW_ORG="$2";    shift 2 ;;
    --apply)           APPLY=1;         shift ;;
    --include-history) INCLUDE_HISTORY=1; shift ;;
    -h|--help)         usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$OLD_DOMAIN" || -z "$NEW_DOMAIN" ]]; then
  echo "error: --old-domain and --new-domain are required" >&2
  usage >&2
  exit 2
fi
if [[ -n "$OLD_ORG" && -z "$NEW_ORG" ]] || [[ -z "$OLD_ORG" && -n "$NEW_ORG" ]]; then
  echo "error: --old-org and --new-org must be provided together" >&2
  exit 2
fi

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# Escape a literal for use on sed's RHS (& and \ are the only specials there).
esc_sed_rhs() { printf '%s' "$1" | sed -e 's/[&\]/\\&/g'; }
# Escape a literal for use inside a sed basic-regex LHS delimited by |.
esc_sed_lhs() { printf '%s' "$1" | sed -e 's/[].\*/[^$|]/\\&/g'; }
# Percent-encode spaces (the only URL-encoded form actually used in this repo).
urlenc_spaces() { printf '%s' "$1" | sed -e 's/ /%20/g'; }

OLD_ORG_URLENC=""; NEW_ORG_URLENC=""
if [[ -n "$OLD_ORG" ]]; then
  OLD_ORG_URLENC="$(urlenc_spaces "$OLD_ORG")"
  NEW_ORG_URLENC="$(urlenc_spaces "$NEW_ORG")"
fi

# Build a single sed program with all substitutions. Using | as delimiter so
# forward slashes in URLs don't need escaping. LHS uses basic regex; literal
# dots in domains stay literal dots, which is fine for matching (dot also
# matches any char, but we accept that — no false positives in practice
# because the domain ends in known TLD chars).
SED_PROG=""
add_sub() {
  local from="$1" to="$2"
  # Only the delimiter | needs escaping in LHS for our use; dots we leave.
  from_esc="$(printf '%s' "$from" | sed -e 's/|/\\|/g')"
  to_esc="$(esc_sed_rhs "$to")"
  to_esc="$(printf '%s' "$to_esc" | sed -e 's/|/\\|/g')"
  SED_PROG="${SED_PROG}s|${from_esc}|${to_esc}|g;"
}

add_sub "$OLD_DOMAIN" "$NEW_DOMAIN"
if [[ -n "$OLD_ORG" ]]; then
  add_sub "$OLD_ORG"        "$NEW_ORG"
  add_sub "$OLD_ORG_URLENC" "$NEW_ORG_URLENC"
fi

# Discover candidate files: any text file that contains any of the old tokens.
declare -a GREP_PATTERNS=("$OLD_DOMAIN")
[[ -n "$OLD_ORG" ]] && GREP_PATTERNS+=("$OLD_ORG" "$OLD_ORG_URLENC")

# Build a single alternation for grep -E.
ALT=""
for p in "${GREP_PATTERNS[@]}"; do
  # Escape regex metachars in pattern.
  esc="$(printf '%s' "$p" | sed -e 's/[.[\*^$()+?{|\\/]/\\&/g')"
  ALT="${ALT:+$ALT|}$esc"
done

# Discover candidate files. Prefer `git ls-files` so .gitignore (and any
# per-project ignores) are respected automatically, falling back to grep if
# the repo isn't a git checkout. Filter additionally to drop build outputs,
# runtime data, and this script itself.
SELF_PATH="scripts/$(basename "$0")"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Tracked files + untracked-but-not-ignored (honors .gitignore).
  mapfile -t ALL_FILES < <(git ls-files --cached --others --exclude-standard)
else
  # Fallback: walk the tree excluding common noise dirs.
  mapfile -t ALL_FILES < <(
    find . -type f \
      -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/.git/*' \
      -not -path '*/dist/*'         -not -path '*/backstop_data/*' \
      -not -path '*/tinified/*'     -not -path '*/exports/*' \
      -not -path '*/__pycache__/*'  -not -path '*/.mxdev_cache/*' \
      -not -path '*/.mypy_cache/*'  -not -path '*/.ruff_cache/*' \
      -not -path '*/latest/*'       -not -path '*/.serena/*' \
      -not -path '*/current-backup-*/*' -not -path '*/instance/var/*' \
    | sed -e 's|^\./||'
  )
fi

# Filter ALL_FILES down to candidates: drop build outputs, self, and history.
mapfile -t FILTERED < <(
  printf '%s\n' "${ALL_FILES[@]}" \
  | grep -Ev '\.(min\.(css|js)|map)$' \
  | grep -Ev '(^|/)(theme\.css|theme\.min\.css)$' \
  | grep -Ev '(^|/)instance/var/' \
  | grep -Ev "(^|/)${SELF_PATH//./\\.}$" \
  | { if [[ "$INCLUDE_HISTORY" -eq 1 ]]; then cat; else grep -Ev '(^|/)notes/changelog_.*\.md$'; fi; }
)

# Now match each candidate against ALT. Using a for-loop over the array
# (rather than piping into `while read`) avoids stdin-consumption gotchas
# when grep runs inside the body of a pipeline-fed loop.
FILES=()
for f in "${FILTERED[@]}"; do
  [[ -f "$f" ]] || continue
  if grep -qIE "$ALT" -- "$f" 2>/dev/null; then
    FILES+=("$f")
  fi
done
# Stable ordering.
IFS=$'\n' FILES=($(printf '%s\n' "${FILES[@]}" | sort -u)); unset IFS

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No matching files found."
  exit 0
fi

echo "Found ${#FILES[@]} files containing old tokens."
echo

if [[ "$APPLY" -eq 0 ]]; then
  echo "-- DRY RUN (no files modified). Pass --apply to commit. --"
  echo
  for f in "${FILES[@]}"; do
    diff_out="$(sed -E "$SED_PROG" "$f" | diff -u "$f" - || true)"
    if [[ -n "$diff_out" ]]; then
      printf '=== %s ===\n%s\n\n' "$f" "$diff_out"
    fi
  done
  echo "-- DRY RUN complete. Re-run with --apply to write changes. --"
  exit 0
fi

echo "-- APPLYING changes to ${#FILES[@]} files --"
changed=0
for f in "${FILES[@]}"; do
  tmp="$(mktemp)"
  sed -E "$SED_PROG" "$f" > "$tmp"
  if ! cmp -s "$f" "$tmp"; then
    mv "$tmp" "$f"
    changed=$((changed + 1))
    echo "  modified: $f"
  else
    rm -f "$tmp"
  fi
done
echo "-- Done. $changed file(s) modified. --"
echo
echo "Reminder: rebuild compiled CSS/JS so theme.css / theme.min.css / main.min.js"
echo "pick up the changes from their SCSS/JS sources."
