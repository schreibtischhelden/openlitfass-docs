# Configuration reference

An instance is configured by files in its directory and, when it runs as a
container, by environment variables. This page lists every setting.

The [config UI](https://config.openlitfass.org) builds the JSON files with
forms in the browser and can import an existing file to change it. It can
also load a whole instance, from its folder, a ZIP or a public git repository
(GitHub, Codeberg, GitLab, Forgejo or Gitea), and give it back as a ZIP.

| File | Purpose | Page |
|---|---|---|
| `instance.json` | name, texts, time zone, links | [below](#instancejson) |
| `sources/*.json` | one file per source | [Sources](?page=sources), [below](#source-files) |
| `inbox/*.json` | single events added by hand | [Event inbox](?page=inbox) |
| `categories.json` | categories and icons | [Categories](?page=categories) |
| `places.json` | optional: venues, parks, sights | [Places](?page=places) |
| `holidays.json` | optional: named day lists | [Event inbox](?page=inbox#day-lists-holidaysjson) |
| `site/` | styling, logo, icons, legal pages | [Theming](?page=theming) |

## instance.json

```json
{
  "name": "weissens.ee",
  "title": "weissens.ee – Events in Weißensee",
  "description": "Der Event-Kalender für Berlin-Weißensee.",
  "baseUrl": "https://weissens.ee",
  "timezone": "Europe/Berlin",
  "language": "de",
  "themeColor": "#17383D",
  "shortName": "weissens.ee",
  "about": "Paragraph 1 …\n\nParagraph 2 …",
  "imprintUrl": "impressum.html",
  "privacyUrl": "datenschutz.html",
  "submitUrl": "mailto:termine@weissens.ee",
  "issuesUrl": "https://github.com/weissensee/weissens.ee/issues"
}
```

| Field | Default | Meaning |
|---|---|---|
| `name` | required | short name; the wordmark in the header |
| `title` | `name` | the page `<title>` |
| `description` | – | `<meta name="description">` and link previews |
| `baseUrl` | – | public address of the site; needed for the sitemap and canonical URLs, and the fallback link (`baseUrl/#<id>`) for events without their own URL |
| `timezone` | `Europe/Berlin` | IANA time zone of all event times |
| `language` | `de` | `<html lang>` |
| `themeColor` | – | browser theme colour and PWA colours; also the background of the generated favicon |
| `shortName` | `name` | name below the app icon when installed (about 12 characters) |
| `about` | – | text of the About page; plain text, blank lines separate paragraphs |
| `imprintUrl` | – | legal notice (*Impressum*); absolute URL or a page in `site/` |
| `privacyUrl` | – | privacy policy; absolute URL or a page in `site/` |
| `submitUrl` | – | where people report a missing event ("Termin melden"): a form or a `mailto:` link |
| `issuesUrl` | – | the instance's own issue tracker for wrong events, missing sources or places |
| `fetchTimeoutMinutes` | `5` | time limit of a whole fetch run; the sources run one after another, so raise it for many or paced (`requestDelaySeconds`) sources |

The About page always links the openLitfass issue tracker for problems with
the software. `issuesUrl` adds the instance's tracker for problems with its
content. If it is a GitHub URL ending in `/issues`, the page links straight to
the issue forms `bug.yml` and `feature.yml`, so add them to the instance's
`.github/ISSUE_TEMPLATE/` (copy them from the core and adapt the wording).

## Source files

Common fields are explained in [Sources](?page=sources#fields-for-every-source),
type-specific ones in [Source types](?page=source-types).

| Field | Types | Meaning |
|---|---|---|
| `type` | all | `rss`, `json`, `ical`, `html`, `wcs` |
| `url` | all | feed, API, page, or site base URL (`wcs`) |
| `preset`, `params` | all | [preset](?page=source-types#presets) and its parameters |
| `name` | all | identifier; default: file name |
| `label` | all | display name |
| `homepage` | all | organiser's website |
| `priority` | all | merge priority, default `0` |
| `disabled` | all | skip the source |
| `daysAhead` | all | time window in days |
| `categorySeparator` | all | split the source's category value into [several categories](?page=categories#several-categories-per-event) |
| `categoryFilter` | all | `{ "deny", "allow", "include", "exclude" }`, by the source's category names ([details](?page=categories#filtering-by-category)) |
| `categoryAttributes` | all | `{ "Kinder": { "familyFriendly": true } }`, attributes by source category |
| `categoryMap` | all | source category → instance category |
| `categoryRules` | all | `[{ "field": …, "regex": …, "category": … }]`, first match wins |
| `categories` | all | deprecated: category allowlist, use `categoryFilter` |
| `include`, `exclude` | all | `[{ "field": …, "regex": … }]`; the field `category` is deprecated |
| `place` | all | place `id` or ref for every event |
| `familyFriendly` | `ical`, `wcs` | every event is family-friendly |
| `organizer` | `ical`, `wcs` | organiser if the source has none |
| `locationDefault` | `ical`, `wcs` | `"Venue, Street 1, 12345 City"` |
| `icalUTCAs` | `ical` | `"+01:00"` or `"local"` for exporters that mark local times as UTC |
| `itemsPath` | `json` | dot path to the array of items |
| `nextPath` | `json` | dot path to the next page's URL |
| `maxPages` | `json` | page limit, default `10` |
| `steps` | all but `wcs` | [requests before the main one](?page=source-types#steps) that collect variables |
| `forEach` | all but `wcs` | repeat the main request per value or batch |
| `maxRequests` | all but `wcs` | request limit for `forEach`, default `20` |
| `timeoutSeconds` | all | time limit of the source, default `20`, at most `180`; per request with `requestDelaySeconds` |
| `requestDelaySeconds` | all but `wcs` | [minimum time between requests](?page=source-types#request-pacing) of a source with `steps` or `forEach` |
| `itemSelector` | `html` | CSS selector of one event |
| `sectionSelector` | `html` | headings that group events |
| `extract` | `html` | named values per event |
| `mapping` | `rss`, `json`, `html` | [field mapping](?page=field-mapping) |
| `wcsTypeIds` | `wcs` | plugin type IDs to request |
| `status` | all | written by the pipeline; do not edit |

## Environment variables

All variables start with `OL_`. Optional features are off by default. Every
variable has a matching command-line flag.

| Variable | Flag | Default | Meaning |
|---|---|---|---|
| `OL_INSTANCE_DIR` | argument | `.` (image: `/instance`) | instance directory |
| `OL_WEB_DIR` | `-web` | `/opt/openlitfass/web` (set in the image) | core front end |
| `OL_FETCH_INTERVAL` | `-interval` | `6h` | `serve`: fetch interval (`30m`, `2h`, …); `0` = only serve |
| `OL_LISTEN_ADDR` | `-addr` | `:8080` | `serve`: listen address |
| `OL_METRICS_ADDR` | `-metrics-addr` | empty | `serve`: separate address for `/metrics`, for example `:9090` |
| `OL_PUBLIC_DIR` | `-public` | `<instance>/.openlitfass-serve` | `serve`: build directory |
| `OL_STATIC_PAGES` | `-static-pages` | `false` | static event and place pages, pre-rendered start page ([SEO](?page=seo)) |
| `OL_SITEMAP_GENERATOR` | `-sitemap` | `false` | `sitemap.xml` and `robots.txt`; needs `baseUrl` ([SEO](?page=seo)) |

Invalid values (`OL_STATIC_PAGES=yes`, `OL_FETCH_INTERVAL=6`) are ignored
with a log line, and the default applies. Booleans accept `true`/`false` and
`1`/`0`; durations need a unit.

## Commands

The image contains three commands. Without arguments it runs
`serve /instance`.

### fetch

```sh
fetch [instance-dir]
```

Fetches all sources and the inbox and writes `data/events.json`,
`data/categories.json` and `data/sources.json`. It also writes the `status` of
each source and deletes expired inbox files. It writes nothing while there is
no active source and no inbox event, and it never replaces existing data with
an empty list.

### build-site

```sh
build-site [-web dir] [-out dir] [-static-pages] [-sitemap] [instance-dir]
```

Builds the static site into `-out` (default `<instance>/public`) from the
core front end, the instance's `site/` and `data/`. It empties the output
directory first, but only if it created it itself (marker file
`.openlitfass-build`).

### serve

```sh
serve [-addr :8080] [-interval 6h] [-metrics-addr addr] [-public dir] [-web dir] [-static-pages] [-sitemap] [instance-dir]
```

Fetches and builds in a loop and serves the site, `/healthz` and `/metrics`.
See [Setup](?page=setup#run-as-a-container) and [Monitoring](?page=monitoring).

### Running the commands in the image

```sh
docker run --rm -v "$PWD:/instance" -w /instance ghcr.io/schreibtischhelden/openlitfass:0.4 fetch .
docker run --rm -v "$PWD:/instance" -w /instance ghcr.io/schreibtischhelden/openlitfass:0.4 build-site -out public .
```
