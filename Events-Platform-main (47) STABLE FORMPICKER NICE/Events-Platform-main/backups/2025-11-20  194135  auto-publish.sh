#!/bin/bash

# ======================================================
# 🍌 FunMap Manual Deployment (Banana-Skin Protected)
# Bidirectional sync for GitHub ↔ cPanel
# Daily rotating logs in /home/funmapco/logs/
# ======================================================

# --- Self-clean wrapper (Windows CRLF fix) ---
if grep -q $'\r' "$0" 2>/dev/null; then
  echo "Cleaning Windows carriage returns..."
  tmpfile=$(mktemp)
  tr -d '\r' < "$0" > "$tmpfile" && mv "$tmpfile" "$0"
  chmod +x "$0"
  exec bash "$0" "$@"
fi

REPO=/home/funmapco/repositories/github
LIVE=/home/funmapco/public_html
LOGDIR=/home/funmapco/logs
LOCK=/tmp/mirror.lock

mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/deploy-$(date +%Y-%m-%d).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# Function to check if a file matches .syncignore patterns
should_ignore() {
  local file="$1"
  local syncignore="$REPO/.syncignore"
  
  if [ ! -f "$syncignore" ]; then
    return 1  # Don't ignore if .syncignore doesn't exist
  fi
  
  # Check each pattern in .syncignore
  while IFS= read -r pattern; do
    # Skip comments and empty lines
    [[ "$pattern" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${pattern// }" ]] && continue
    
    # Remove leading/trailing whitespace
    pattern=$(echo "$pattern" | xargs)
    
    # Handle .* pattern (all hidden files)
    if [ "$pattern" = ".*" ]; then
      if [[ "$file" =~ ^\. ]] || [[ "$file" =~ /\. ]]; then
        return 0  # Hidden file - should ignore
      fi
      continue
    fi
    
    # Check if file matches pattern (exact match or path match)
    case "$file" in
      $pattern|*/$pattern|$pattern/*)
        return 0  # Match found - should ignore
        ;;
    esac
  done < "$syncignore"
  
  return 1  # No match - don't ignore
}

[ -f "$LOCK" ] && exit 0
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT
set -e

# ======================================================
# 1️⃣ cPanel → GitHub (Manual Push)
# ======================================================
if [ "$1" = "push" ]; then
  log "Syncing from cPanel → GitHub..."
  find "$LIVE" -type f \
    ! -path '*/.*' \
    ! -path '*/backups/*' \
    ! -name '.htaccess' \
    ! -name 'deploy.php' \
    ! -name 'webhook-test.txt' \
    ! -name 'error_log' \
    ! -name 'deploy.log' \
    ! -name 'cron.log' \
    -print0 > /tmp/filelist.txt

  while IFS= read -r -d '' file; do
    rel=${file#$LIVE/}
    dest=$REPO/$rel
    mkdir -p "$(dirname "$dest")"
    cp -u "$file" "$dest"
  done < /tmp/filelist.txt
  rm -f /tmp/filelist.txt

  cd "$REPO"
  if [ -n "$(git status --porcelain)" ]; then
    log "Committing and pushing updates..."
    git add .
    git commit -m "Manual-sync_$(date +%Y-%m-%d_%H-%M-%S)"
    git push origin main
    log "GitHub updated successfully."
  else
    log "No file changes to commit."
  fi
  log "cPanel → GitHub sync complete."
  exit 0
fi

# ======================================================
# 2️⃣ GitHub → cPanel (Webhook Pull)
# ======================================================
if [ "$1" = "pull" ]; then
  log "Syncing from GitHub → cPanel..."
  cd "$REPO"
  git fetch origin main
  git reset --hard origin/main

  log "Copying changed and new files..."
  find "$REPO" -type f \
    ! -path '*/.*' \
    ! -path '*/.github/*' \
    ! -path '*/backups/*' \
    ! -name '.gitignore' \
    ! -name 'webhook-test.txt' \
    -print0 > /tmp/deploylist.txt

  while IFS= read -r -d '' file; do
    rel=${file#$REPO/}
    dest=$LIVE/$rel
    mkdir -p "$(dirname "$dest")"
    cp -u "$file" "$dest"
  done < /tmp/deploylist.txt
  rm -f /tmp/deploylist.txt

  log "Checking for deletions (respecting .syncignore)..."
  cd "$REPO"
  git diff --name-only --diff-filter=D HEAD@{1} HEAD > /tmp/deletions.txt 2>/dev/null || true
  deleted_count=0
  ignored_count=0
  
  while IFS= read -r deleted; do
    if [ -n "$deleted" ] && [ -f "$LIVE/$deleted" ]; then
      if should_ignore "$deleted"; then
        log "Ignoring deletion (protected by .syncignore): $deleted"
        ignored_count=$((ignored_count + 1))
      else
        log "Deleting: $deleted"
        rm -f "$LIVE/$deleted"
        deleted_count=$((deleted_count + 1))
      fi
    fi
  done < /tmp/deletions.txt
  rm -f /tmp/deletions.txt
  
  log "Deletion check complete: $deleted_count deleted, $ignored_count protected by .syncignore"

  log "GitHub → cPanel sync complete."
  exit 0
fi

# ======================================================
# Default message if called without arguments
# ======================================================
log "Usage:"
log "  $0 push   # Manual cPanel → GitHub sync"
log "  $0 pull   # GitHub → cPanel webhook sync"

