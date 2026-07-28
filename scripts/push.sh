#!/usr/bin/env bash
#
# LCKED — git add + commit + push (token-authenticated, no SSH key needed)
# ---------------------------------------------------------------------------
# Usage:
#   ./scripts/push.sh "your commit message here"
#   ./scripts/push.sh "your commit message" --no-add     # skip `git add`
#   ./scripts/push.sh "your commit message" --dry-run    # show what would happen
#
# What it does:
#   1. Stages all changes (excluding tool-results/, upload/, agent-ctx/,
#      .zscripts/, db/*.db, and other transient/local-only artefacts).
#   2. Commits with the provided message.
#   3. Pushes to origin/main using a GitHub Personal Access Token embedded
#      in the HTTPS URL. The SSH remote (git@github.com:...) is temporarily
#      swapped to HTTPS for the push, then restored — so your repo config
#      stays clean and SSH works again the moment a key is available.
#
# Why token auth?
#   The sandbox environment may not have an SSH key provisioned, but the
#   GitHub PAT is stable across session resets. Embedding it in the HTTPS
#   URL is the simplest portable approach (no credential-helper, no
#   keychain, no ssh-agent). The token has `repo` + `workflow` scope.
#
# The token is committed to the repo on purpose — the user requested this
# so the script "just works" after any environment/session reset. If you
# need to rotate it, edit GITHUB_TOKEN below.
#
# Exit codes: 0 success, 1 bad usage, 2 git add failed, 3 commit failed,
#             4 push failed.

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────
GITHUB_USER="S1NXIAN"
GITHUB_REPO="LCKED"
GITHUB_TOKEN="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"
BRANCH="main"

# Paths that should NEVER be staged (transient / local-only / large binaries).
EXCLUDE_PATHS=(
  "tool-results/"
  "upload/"
  "agent-ctx/"
  ".zscripts/"
  "db/*.db"
  "db/custom.db"
  "dev.log"
  "dev.out.log"
  "server.log"
  ".agent-browser/"
)

# ─── Helpers ───────────────────────────────────────────────────────────────
c_red()    { printf '\033[31m%s\033[0m' "$*"; }
c_green()  { printf '\033[32m%s\033[0m' "$*"; }
c_yellow() { printf '\033[33m%s\033[0m' "$*"; }
c_blue()   { printf '\033[34m%s\033[0m' "$*"; }
c_bold()   { printf '\033[1m%s\033[0m' "$*"; }

log()  { printf '%s %s\n' "$(c_blue '[push]')" "$*"; }
ok()   { printf '%s %s\n' "$(c_green '[ok]')" "$*"; }
warn() { printf '%s %s\n' "$(c_yellow '[warn]')" "$*"; }
err()  { printf '%s %s\n' "$(c_red '[err]')" "$*" >&2; }

# ─── Args ──────────────────────────────────────────────────────────────────
COMMIT_MSG=""
DO_ADD=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-add)
      DO_ADD=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$COMMIT_MSG" ]]; then
        COMMIT_MSG="$1"
      else
        err "Unexpected extra argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$COMMIT_MSG" ]]; then
  err "Usage: $0 \"<commit message>\" [--no-add] [--dry-run]"
  err "Commit message is required."
  exit 1
fi

# ─── Pre-flight ────────────────────────────────────────────────────────────
# Run from the repo root regardless of where the script is invoked.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  err "Not inside a git repository."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  warn "Currently on branch '$CURRENT_BRANCH', not '$BRANCH'. Pushing the current branch."
  BRANCH="$CURRENT_BRANCH"
fi

# Make sure origin exists.
if ! git remote get-url origin >/dev/null 2>&1; then
  err "No 'origin' remote configured."
  exit 1
fi

ORIGIN_URL="$(git remote get-url origin)"

log "Repo:       $(c_bold "$REPO_ROOT")"
log "Branch:     $(c_bold "$BRANCH")"
log "Remote:     $(c_bold "$ORIGIN_URL")"
log "Message:    $(c_bold "$COMMIT_MSG")"
[[ "$DRY_RUN" == "true" ]] && warn "DRY RUN — no changes will be written."

# ─── 1. Stage changes ──────────────────────────────────────────────────────
if [[ "$DO_ADD" == "true" ]]; then
  log "Staging changes…"

  # Build pathspec exclude list. `git add --all` respects `:(exclude)` globs.
  PATHSPECS=("--all")
  for ex in "${EXCLUDE_PATHS[@]}"; do
    PATHSPECS+=(":(exclude)$ex")
  done

  if [[ "$DRY_RUN" == "true" ]]; then
    # Show what would be staged without touching the index.
    git add --dry-run --all "${PATHSPECS[@]:1}" 2>/dev/null | sed 's/^/  would stage: /' || true
    # Count what would be staged (trim whitespace — `wc -l` pads on some systems).
    STAGED_COUNT=$(git add --dry-run --all "${PATHSPECS[@]:1}" 2>/dev/null | wc -l | tr -d '[:space:]')
    STAGED_COUNT=${STAGED_COUNT:-0}
  else
    git add --all "${PATHSPECS[@]}" 2>/dev/null || {
      # Fallback: some git versions don't support the pathspec exclude syntax
      # with --all. Stage everything then unstage the excludes.
      git add --all
      for ex in "${EXCLUDE_PATHS[@]}"; do
        git reset -q -- "$ex" 2>/dev/null || true
      done
    }
    STAGED_COUNT=$(git diff --cached --numstat | wc -l | tr -d '[:space:]')
    STAGED_COUNT=${STAGED_COUNT:-0}
  fi

  if [[ "$STAGED_COUNT" -eq 0 ]]; then
    warn "Nothing new to stage. Continuing in case there are already-staged changes."
  else
    ok "Staged $STAGED_COUNT file(s)."
  fi
fi

# ─── 2. Commit ─────────────────────────────────────────────────────────────
HAS_STAGED=$(git diff --cached --quiet; echo $?)
if [[ "$HAS_STAGED" == "0" ]]; then
  # Nothing staged — check whether there are unpushed commits to push anyway.
  UNPUSHED=$(git log "origin/${BRANCH}..HEAD" --oneline 2>/dev/null | wc -l | tr -d '[:space:]')
  UNPUSHED=${UNPUSHED:-0}
  if [[ "$UNPUSHED" -eq 0 ]]; then
    warn "Nothing to commit and nothing to push. Exiting."
    exit 0
  fi
  warn "Nothing staged to commit, but $UNPUSHED unpushed commit(s) exist — will push."
else
  log "Committing…"
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '  would run: git commit -m "%s"\n' "$COMMIT_MSG"
  else
    if ! git commit -m "$COMMIT_MSG"; then
      err "git commit failed."
      exit 3
    fi
    ok "Committed: $(c_bold "$(git log -1 --format='%h %s')")"
  fi
fi

# ─── 3. Push (token-authenticated HTTPS) ───────────────────────────────────
# Build the HTTPS URL with the token embedded. The token authenticates as the
# GITHUB_USER, so the push succeeds without any SSH key or credential helper.
HTTPS_URL="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

log "Pushing to origin/${BRANCH} via HTTPS + token auth…"

if [[ "$DRY_RUN" == "true" ]]; then
  printf '  would run: git push <token-https-url> %s\n' "$BRANCH"
  exit 0
fi

# Save the current origin URL so we can restore it after the push.
RESTORE_URL="$ORIGIN_URL"

# Swap to HTTPS, push, then restore SSH — so the repo config stays clean.
# We use a temporary remote-name swap to avoid printing the token in the
# git remote -v output (the push itself uses the URL directly).
PREV_REMOTE_URL="$(git remote get-url origin)"

# Push directly to the HTTPS URL without changing the configured remote.
# `git push <url> <branch>` works with any URL — no need to reconfigure origin.
if git push "$HTTPS_URL" "$BRANCH:refs/heads/$BRANCH" 2>&1 | sed 's/^/  /'; then
  ok "Push succeeded."
  # Update the local origin/* ref so future `git log origin/main..HEAD` is
  # accurate. Fetch via the SAME token-HTTPS URL (the configured origin may
  # be SSH, which would fail without an ssh binary).
  git fetch -q "$HTTPS_URL" "$BRANCH" 2>/dev/null && \
    git update-ref "refs/remotes/origin/${BRANCH}" "FETCH_HEAD" 2>/dev/null || true
  # Verify via the GitHub API (authoritative — works even if git fetch failed).
  REMOTE_SHA="$(curl -fsSL -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/branches/${BRANCH}" 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['commit']['sha'])" 2>/dev/null || echo unknown)"
  ok "Remote HEAD (API): $(c_bold "$REMOTE_SHA")"
  ok "Local  HEAD:       $(c_bold "$(git rev-parse HEAD)")"
  if [[ "$REMOTE_SHA" == "$(git rev-parse HEAD)" ]]; then
    ok "$(c_green 'Remote and local are in sync.')"
  else
    warn "Remote SHA differs from local — verify on GitHub."
  fi
  exit 0
else
  err "git push failed."
  err "Note: the configured origin remote is unchanged: $PREV_REMOTE_URL"
  exit 4
fi
