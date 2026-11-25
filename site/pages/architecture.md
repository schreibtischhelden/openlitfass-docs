# How it works

This page explains what happens inside openLitfass. You do not need it to run
an instance, but it helps when something behaves unexpectedly or when you
want to contribute.

## Overview

```
sources/*.json ─┐
inbox/*.json   ─┤  fetch  ──►  data/events.json      ─┐
categories.json─┘              data/categories.json   │
                               data/sources.json      ├─  build-site  ──►  public/  ──►  web server
                               sources/*.json status  │
web/ (core) + site/ (instance) + instance.json ───────┘
places.json ──────────────────────────────────────────┘
```

Three Go programs work on an instance directory:

- **`fetch`** reads all sources and the inbox, normalises, filters and
  merges the events, and writes the JSON files in `data/`.
- **`build-site`** assembles the static site from the core front end
  (`web/`), the instance's `site/` and `data/`. It renders `index.html` with
  the values from `instance.json`, inlines the logo, derives the favicon,
  writes `data/site.json` and `manifest.webmanifest`, stamps the service
  worker with a build ID, resolves places, and optionally writes static pages
  and the sitemap.
- **`serve`** runs both on an interval and serves the result.

The front end (`web/js/app.js`) loads the JSON files with `fetch()`; there is
no API server. Apart from `golang.org/x/net/html` for HTML parsing, the back
end uses only the Go standard library.

## A fetch run

1. Load and check `categories.json`; stop if it is invalid.
2. Load every source file in `sources/` (alphabetical order) and the inbox.
   A file with invalid JSON is skipped.
3. Fetch every source with its own timeout (20 seconds) and map its items to
   events.
4. Apply the common filters: `categoryMap`, `categories`, `include`,
   `exclude`, `daysAhead`, `place`; drop past events.
5. Write each source's `status` back into its file.
6. Validate: drop events without a title or with an implausible date.
7. Merge the same event from several sources; assign stable IDs; sort by
   date and time.
8. Write `data/events.json`, `data/categories.json` and `data/sources.json`,
   unless the result is empty.

Repeated runs with unchanged data produce byte-identical files, so the Git
diff of a run shows only real changes.

## Fault tolerance

Every source is wrapped in the same layers:

- **Timeout** per source (20 seconds, at most 180 with `timeoutSeconds`), so
  a hanging server does not use up the time of the others. The whole run has an outer limit of five minutes.
- **Panic recovery:** a crash inside a source, for example caused by
  unexpected data, becomes an error of that source.
- **Common filters** as described above.
- **Status tracking:** success or failure is written back to the source file.

On top of that:

- a broken source file is skipped, the others still load;
- invalid events are dropped with a warning;
- a source that fails keeps its events from the previous run;
- **empty data is never written:** while no source is active, or if all
  sources fail, the existing `data/events.json` stays untouched.

## Event IDs

Event IDs are derived from the date, start time and normalised title: a
readable beginning of the title plus a hash, for example
`tanztee-fuer-alle-3f9a1b2c`. They do not depend on the source, so an event
keeps its ID when a second source starts listing it; shared links and saved
stars keep working. Identical keys within one source get `-2`, `-3`. If the
organiser changes the title, date or start time, the ID changes.

Inbox events use the file name as their ID; occurrences of recurring inbox
events use `<file name>@<date>`.

## Why inbox files are deleted late

`fetch` rebuilds `data/events.json` from scratch on every run from what the
sources deliver; it does not read the previous file. An inbox file deleted
right after its first run would make its event disappear on the next run.
The file therefore stays until the event's date has passed, which is exactly
when the event would drop out anyway.

## The site build

`build-site` writes into a fresh directory. `serve` builds into a new
directory under `.openlitfass-serve/` for every run and switches it live only
once it is complete, so a failed build leaves the previous version online.
`serve` sets cache headers: browsers revalidate HTML pages, `data/`, the
service worker and the manifest on every request (`no-cache`), and may keep
all other files for an hour.

## The front end

The front end is plain HTML, CSS and JavaScript without a framework and
without a build step. It reads:

| File | Content |
|---|---|
| `data/events.json` | the events |
| `data/categories.json` | categories, icons and groups |
| `data/sources.json` | labels and websites of the sources |
| `data/places.json` | places (optional) |
| `data/site.json` | the values from `instance.json` |

The service worker (`sw.js`) precaches the app and keeps the most recently
loaded data available offline.

Formats of these files: [Data formats](?page=data-formats).
