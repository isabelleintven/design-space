#!/bin/sh
# Bouwt de app en publiceert hem op GitHub Pages (gh-pages-branch).
#   branch main      → https://isabelleintven.github.io/design-space/
#   branch developer → https://isabelleintven.github.io/design-space/dev/  (preview met eigen opslag)
set -e
cd "$(dirname "$0")/.."
BRANCH=$(git branch --show-current)
case "$BRANCH" in
  main) TARGET="" ; URL="https://isabelleintven.github.io/design-space/" ;;
  developer) TARGET="dev" ; URL="https://isabelleintven.github.io/design-space/dev/" ;;
  *) echo "Publiceren kan alleen vanaf main of developer (nu: $BRANCH)." ; exit 1 ;;
esac
if [ -n "$(git status --porcelain)" ]; then
  echo "Let op: er zijn niet-gecommitte wijzigingen; die gaan wel mee in deze publicatie."
fi

REMOTE=$(git remote get-url origin)
npm run build

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --branch gh-pages "$REMOTE" "$TMP"

if [ -z "$TARGET" ]; then
  # hoofdsite vervangen, de dev-preview laten staan
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git ! -name dev -exec rm -rf {} +
  cp -R dist/. "$TMP/"
else
  rm -rf "$TMP/$TARGET"
  mkdir -p "$TMP/$TARGET"
  cp -R dist/. "$TMP/$TARGET/"
fi
touch "$TMP/.nojekyll"

cd "$TMP"
git add -A
if git diff --cached --quiet; then
  echo "Niets veranderd."
else
  git commit -q -m "Publicatie $BRANCH $(date '+%Y-%m-%d %H:%M')"
  git push -q origin gh-pages
fi
echo "Gepubliceerd: $URL"
