# openLitfass documentation

Source of the documentation at <https://docs.openlitfass.org> for
[openLitfass](https://github.com/schreibtischhelden/openlitfass), the
self-hosted static events calendar.

This repository holds only the content. The pages are Markdown, rendered in
the browser by
[markdown-pages.js](https://github.com/schreibtischhelden/markdown-pages.js),
which brings its libraries (Showdown, DOMPurify, highlight.js) along in
`assets/vendor/`; the site loads nothing from other hosts.

## Layout

```
site/
  README.md            start page
  pages/<name>.md      one file per page, reachable as ?page=<name>
  header.md            sidebar: logo, search, navigation
  footer.md            footer
  404.md               shown for an unknown ?page=
  index.html           page shell with the Content Security Policy
  404.html             GitHub Pages' page for unknown paths
  assets/
    setup.js           renderer options and saved theme, before rendering
    docs.js            navigation, search, contents, code highlighting, theme switch
    docs.css           layout and colours
    img/               images
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
- The rendered HTML is sanitised with DOMPurify: `<script>`, `<style>`,
  `<iframe>` and inline event handlers (`onclick`) are removed, and the
  Content Security Policy in `index.html` allows scripts from this site
  only. Put behaviour into `assets/docs.js` and styles into
  `assets/docs.css`.
- The sanitiser also drops heading ids that clash with names of the browser's
  `document` object (for example "Fonts", "Attributes"); such a heading gets
  no anchor. Use a more specific heading.
- Fenced code blocks with a language (` ```json `, ` ```sh `, ` ```yaml `) are
  highlighted; highlight.js is loaded only on pages that have them.

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
moment, takes `markdown-pages.js` and `assets/vendor/` from it, adds `site/`
and force-pushes the result as a single commit to the branch `pages`, with
`CNAME` `docs.openlitfass.org`. GitHub Pages serves that branch. Changes in
markdown-pages.js take effect with the next push here; they do not trigger a
build themselves (run the workflow by hand if needed).

## Licence

[MIT](LICENSE). markdown-pages.js and the libraries in `assets/vendor/` keep
their own licences, which are copied into the built site
(`LICENSE-markdown-pages.txt`, `assets/vendor/*/LICENSE*`).
