#!/bin/sh
# Local preview at http://localhost:8000: clones markdown-pages.js into
# .renderer/ (once; delete the folder to update it), assembles the site into
# .preview/ and serves it with a static web server in Docker.
#
#   scripts/preview.sh            assemble and serve
#   scripts/preview.sh assemble   assemble only (after editing site/)
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if [ ! -d .renderer ]; then
  git clone -q --depth 1 https://github.com/schreibtischhelden/markdown-pages.js .renderer
fi
scripts/assemble.sh .renderer .preview

if [ "${1:-}" = assemble ]; then
  exit 0
fi

# pwd -W gives a Windows path in Git Bash; MSYS_NO_PATHCONV keeps it intact.
dir=$(pwd -W 2>/dev/null || pwd)/.preview
MSYS_NO_PATHCONV=1 docker run --rm --name ol-docs -p 8000:80 \
  -v "$dir:/usr/share/nginx/html:ro" nginx:1.29-alpine
