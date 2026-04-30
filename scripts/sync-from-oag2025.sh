#!/usr/bin/env bash
# sync-from-oag2025.sh — read-only enumerator for the one-shot oag2025 → aon2026 sync.
#
# Walks ../diazotheme.oag2025 (or path given as first arg), copies it minus excluded
# paths, applies oag2025 → aon2026 rename normalization, then emits a markdown worklist
# of files that differ from the current aon2026 working tree.
#
# Does not modify the aon2026 working tree. Refuses to overwrite an existing log
# unless FORCE=1.
#
# Usage:
#   bash scripts/sync-from-oag2025.sh [upstream-path] [upstream-branch]
#
# Defaults: upstream-path=../diazotheme.oag2025, upstream-branch=devel
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

UP="${1:-../diazotheme.oag2025}"
BRANCH="${2:-devel}"

if [[ ! -d "$UP/.git" ]]; then
  echo "fatal: $UP is not a git repo" >&2
  exit 1
fi
SHA="$(git -C "$UP" rev-parse "$BRANCH")"

EXCLUDE="$SCRIPT_DIR/sync-from-oag2025.exclude"
SNAP=".oag2025-sync-cache/normalized"
LOG="docs/sync/$(date -I)-oag2025-sync-log.md"

if [[ -e "$LOG" && "${FORCE:-0}" != "1" ]]; then
  echo "fatal: $LOG already exists; commit or delete it, or run with FORCE=1" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG")"
rm -rf "$SNAP"
mkdir -p "$SNAP"

# 1. Copy upstream tree minus excluded paths.
rsync -a --exclude-from="$EXCLUDE" "$UP/" "$SNAP/"

# 2. Rename file paths (depth-first; handles nested dirs correctly).
find "$SNAP" -depth -name '*oag2025*' -execdir bash -c '
  for f in "$@"; do mv "$f" "${f//oag2025/aon2026}"; done
' _ {} +

# 3. Rename file contents (longest match first to avoid partial substitution).
grep -rlIZ -e diazotheme.oag2025 -e '++theme++oag2025' \
              -e OAG2025 -e Oag2025 -e oag2025 "$SNAP" 2>/dev/null \
  | xargs -0 -r sed -i \
      -e 's|diazotheme\.oag2025|diazotheme.aon2026|g' \
      -e 's|++theme++oag2025|++theme++aon2026|g' \
      -e 's/OAG2025/AON2026/g' \
      -e 's/Oag2025/Aon2026/g' \
      -e 's/oag2025/aon2026/g'

# 4. Emit worklist.
{
  printf -- '---\n'
  printf 'date: %s\n' "$(date -I)"
  printf 'upstream-sha: %s\n' "$SHA"
  printf 'upstream-branch: %s\n' "$BRANCH"
  printf -- '---\n\n'
  printf '# OAG2025 sync log — pinned to oag2025@%s\n\n' "${SHA:0:7}"
  printf 'Inspect each row: `diff -u %s/<path> <path>`\n' "$SNAP"
  printf 'New files (only in upstream): `cat %s/<path>`\n\n' "$SNAP"
  printf '## Files differing from snapshot\n\n'
  # `diff -rq` exits 1 when files differ (expected); ignore pipeline exit.
  { diff -rq "$SNAP/" . 2>&1 || true; } \
    | grep -E "^Files .* differ\$|^Only in $SNAP" \
    | sed -E \
        -e "s|^Files $SNAP/(.+) and \\./(.+) differ\$|- [ ] \1 — differs|" \
        -e "s|^Only in $SNAP/?: (.+)\$|- [ ] \1 — new (only in upstream)|" \
        -e "s|^Only in $SNAP/(.+): (.+)\$|- [ ] \1/\2 — new (only in upstream)|" \
    | sort
} > "$LOG"

# Count rows for summary.
ROWS=$(grep -cE '^- \[ \]' "$LOG" || true)

echo "Wrote $LOG ($ROWS candidates)"
echo "Pinned: oag2025@$SHA ($BRANCH)"
echo "Snapshot at $SNAP/"
