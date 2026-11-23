# Static pages and SEO

The calendar itself is a JavaScript app: it loads `data/events.json` and
renders the list in the browser. Search engines, link previews in messengers
and visitors without JavaScript see little of that. Two optional features
fix this. Both are **off by default**.

| Variable | Flag | Generates |
|---|---|---|
| `OL_STATIC_PAGES=true` | `-static-pages` | `termine/`, `orte/`, today's events in the HTML of `/` |
| `OL_SITEMAP_GENERATOR=true` | `-sitemap` | `sitemap.xml`, `robots.txt` (only with `baseUrl`) |

Both together give full SEO support; the sitemap alone contains only the
start page. Canonical and Open Graph tags in `index.html` are always present.

## Enabling

As a container:

```sh
docker run -d … -e OL_STATIC_PAGES=true -e OL_SITEMAP_GENERATOR=true ghcr.io/schreibtischhelden/openlitfass:0.4
```

In the GitHub Actions workflow, pass the variables to `build-site`:

```yaml
env:
  OL_STATIC_PAGES: "true"
  OL_SITEMAP_GENERATOR: "true"
# …
      - name: Build site
        run: docker run --rm -v "$PWD:/instance" -w /instance --user "$(id -u):$(id -g)" -e OL_STATIC_PAGES -e OL_SITEMAP_GENERATOR "$IMAGE" build-site -out public .
```

Set `baseUrl` in `instance.json`; sitemaps and canonical URLs need absolute
addresses.

## What static pages contain

- **`termine/index.html`:** all upcoming events, grouped by day.
- **`termine/<id>.html`:** one page per event with title, description, Open
  Graph tags and a schema.org `Event` as JSON-LD, including the cancelled
  status. Its share button shares this address, so messengers show a
  preview.
- **`orte/index.html`** and **`orte/<id>.html`:** the places, with a
  schema.org `Place` and their upcoming events (only with `places.json`).
- **`index.html`** (`/`) already contains today's events in its HTML, or, if
  there are none today, those of the next day with events, plus a link to
  `termine/`. The app replaces this list once it has loaded.

Past events no longer get a page. "Today" refers to the time of the last
build: `serve` rebuilds after every fetch, so after midnight the start page
is updated with the next fetch.

## Sitemap and robots.txt

- `sitemap.xml` lists the start page, and with static pages also `termine/`,
  every event page and the place pages.
- It is plain sitemaps.org XML without a stylesheet, so every browser shows
  it as an XML tree. The human-readable list is `termine/`.
- `robots.txt` points to the sitemap. A custom `site/robots.txt` takes
  precedence.

## Templates

The static pages are rendered from Go `html/template` files in the core's
`web/templates/`. They are not deployed with the site.
