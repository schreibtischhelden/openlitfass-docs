# openLitfass documentation

Source of the documentation at <https://docs.openlitfass.org> for
[openLitfass](https://github.com/schreibtischhelden/openlitfass), the
self-hosted static events calendar.

This repository holds only the content. The pages are Markdown, rendered in
the browser by
[markdown-pages.js](https://github.com/schreibtischhelden/markdown-pages.js).

## Layout

```
site/
  README.md            start page
  pages/<name>.md      one file per page, reachable as ?page=<name>
  header.md            sidebar: logo, search, navigation
  footer.md            footer
  index.html           page shell
  404.html             page for unknown addresses
  assets/              docs.css, docs.js (navigation, search, contents), images
scripts/
  assemble.sh          renderer + site/ → finished site
  preview.sh           local preview at http://localhost:8000 (Docker)
.github/workflows/pages.yml
```

## Editing

- Write in British English; keep German interface texts as they appear.
- Link between pages with `?page=<name>`, to a section with
  `?page=<name>#<heading-id>` (lower case, spaces as hyphens, punctuation
  removed).
- A new page also needs an entry in `site/header.md`; the search covers
  exactly the pages listed there.
- Images go into `site/assets/img/`.

## Preview

```sh
scripts/preview.sh
```

clones markdown-pages.js into `.renderer/` once (delete the folder to update
it), assembles the site into `.preview/` and serves it with nginx in Docker.
After editing, `scripts/preview.sh assemble` refreshes `.preview/` while the
server keeps running.

## Publishing

On every push to `main` that changes `site/` or the workflow,
`.github/workflows/pages.yml` checks out markdown-pages.js as it is at that
moment, copies `site/` into it and force-pushes the result as a single commit
to the branch `pages`, with `CNAME` `docs.openlitfass.org`. GitHub Pages
serves that branch. Changes in markdown-pages.js take effect with the next
push here; they do not trigger a build themselves (run the workflow by hand
if needed).

## Licence

[MIT](LICENSE). markdown-pages.js is published with its own licence, which is
copied into the built site as `LICENSE-markdown-pages.txt`.
