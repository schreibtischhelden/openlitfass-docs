#!/bin/sh
# Assembles the documentation site: the renderer from a checkout of
# markdown-pages.js plus the content of site/. Used by the Pages workflow
# and by scripts/preview.sh, so the preview matches the published site.
#
#   scripts/assemble.sh <markdown-pages.js checkout> <output directory>
set -eu

renderer=${1:?usage: assemble.sh <renderer checkout> <output dir>}
out=${2:?usage: assemble.sh <renderer checkout> <output dir>}
root=$(cd "$(dirname "$0")/.." && pwd)

if [ ! -f "$renderer/markdown-pages.js" ]; then
  echo "assemble.sh: $renderer/markdown-pages.js not found" >&2
  exit 1
fi

# Empty the directory instead of replacing it, so a running preview server
# that has it mounted keeps seeing the new files.
mkdir -p "$out"
find "$out" -mindepth 1 -delete
# Only the renderer and its licence; its sample pages, assets and README
# would otherwise show up next to ours.
cp "$renderer/markdown-pages.js" "$out/"
cp "$renderer/LICENSE" "$out/LICENSE-markdown-pages.txt"
cp -r "$root/site/." "$out/"
echo "assembled $(find "$out" -type f | wc -l | tr -d ' ') files in $out"
