#!/bin/bash
# ======================================================
# 🚀  FunMap Auto Deployment (GitHub → CPanel)
# Mirrors GitHub repo → public_html (with deletion logic)
# ======================================================

REPO=/home/funmapco/repositories/github
LIVE=/home/funmapco/public_html
LOCK=/tmp/deploy.lock

# Prevent overlapping runs
[ -f $LOCK ] && exit 0
touch $LOCK
trap 'rm -f $LOCK' EXIT

set -e  # Abort on error

echo "Syncing from GitHub repo to Live CPanel..."

# Update repo first
cd "$REPO"
git fetch origin main
git reset --hard origin/main

echo "Scanning for changed and deleted files..."

# Copy updated and new files
find "$REPO" -type f \
  ! -path '*/\.*' \
  ! -name '.gitignore' \
  ! -path '*/.github/*' \
  ! -path '*/backups/*' \
  -print0 > /tmp/deploylist.txt

while IFS= read -r -d '' file; do
  rel=${file#$REPO/}
  dest=$LIVE/$rel
  mkdir -p "$(dirname "$dest")"
  cp -u "$file" "$dest"
done < /tmp/deploylist.txt
rm -f /tmp/deploylist.txt

# Handle deletions (safe, controlled)
cd "$LIVE"
git --work-tree="$LIVE" --git-dir="$REPO/.git" diff --name-only --diff-filter=D origin/main > /tmp/deletions.txt || true
while IFS= read -r deleted; do
  if [ -n "$deleted" ] && [ -f "$LIVE/$deleted" ]; then
    echo "Deleting: $deleted"
    rm -f "$LIVE/$deleted"
  fi
done < /tmp/deletions.txt
rm -f /tmp/deletions.txt

echo "GitHub → CPanel sync complete at $(date '+%Y-%m-%d_%H-%M-%S')"
