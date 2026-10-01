#!/bin/sh
# Bouwt de app en publiceert dist/ op de gh-pages-branch (GitHub Pages).
set -e
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Publicatie $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Gepubliceerd: https://isabelleintven.github.io/design-space/"
