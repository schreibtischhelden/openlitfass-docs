# Sources

A **source** is anything openLitfass fetches events from: an RSS feed, a JSON
API, an iCalendar export, an HTML page or a WordPress calendar. Each source
is **one JSON file** in the instance's `sources/` directory. Adding,
changing or removing a source touches exactly one file: a clean Git diff and
no merge conflicts in a shared list.

## How sources are loaded

On every run, `fetch` reads all `*.json` files in `sources/`, in alphabetical
order, and builds one fetcher per file according to its `type`:

| `type` | For | Details |
|---|---|---|
| `rss` | RSS feeds | [RSS](?page=source-types#rss) |
| `json` | JSON APIs, including paginated ones | [JSON](?page=source-types#json) |
| `ical` | iCalendar exports (`.ics`) | [iCalendar](?page=source-types#icalendar) |
| `html` | web pages without a feed | [HTML](?page=source-types#html) |
| `wcs` | WordPress "Weekly Class Schedule" plugin | [Weekly Class Schedule](?page=source-types#weekly-class-schedule-wcs) |

- Files ending in **`.example.json`** are templates and are not loaded. The
  example instance has one per type.
- The file name without `.json` becomes the **source name**, unless the file
  sets `"name"`. The name identifies the source in logs, metrics and
  `data/events.json`; keep it stable.
- A file with invalid JSON is skipped with a log line; the other sources
  still run.

## Adding a source

1. Find out what the website offers: a feed, an `.ics` export, an API, or
   only HTML. [Finding sources](?page=source-discovery) has search patterns
   and the feed URLs of common platforms.
2. Copy the matching template from the example instance into `sources/`, for
   example `beispiel-ical.example.json` → `freilichtbuehne.json`. Or let the
   [source wizard](https://config.openlitfass.org/?page=source) of the config
   UI build the file, including field mapping and filters.
3. Set `url`, `label` and `homepage`, and for `rss`, `json` and `html` the
   [field mapping](?page=field-mapping).
4. Run `fetch` (or push and let the workflow run) and check the source's
   [status](#health-status) and its events in `data/events.json`.

A complete iCalendar source needs only a few lines:

```json
{
  "type": "ical",
  "url": "https://example.org/events.ics",
  "label": "Freilichtbühne",
  "homepage": "https://example.org",
  "daysAhead": 120,
  "categoryMap": { "Konzert": "Kultur" }
}
```

## Fields for every source

| Field | Default | Meaning |
|---|---|---|
| `type` | required | `rss`, `json`, `ical`, `html` or `wcs` |
| `url` | required | the feed, API or page to fetch (`wcs`: the site's base URL) |
| `name` | file name | stable identifier of the source |
| `label` | `name` | display name, shown as "Quelle: …" and on the About page |
| `homepage` | – | the organiser's website, linked in the list of sources |
| `priority` | `0` | which version wins when sources overlap ([Merging](#the-same-event-from-several-sources)) |
| `disabled` | `false` | `true` skips the source without deleting the file |
| `daysAhead` | – | keep only events up to N days ahead |
| `categoryMap` | – | translate the source's categories to the instance's |
| `categoryRules` | – | set the category by regular expression ([Categories](?page=categories#splitting-a-coarse-category)) |
| `categories` | – | keep only these categories |
| `include`, `exclude` | – | keep or drop events by regular expression |
| `place` | – | link every event to one place of `places.json` |
| `familyFriendly` | `false` | mark every event as family-friendly (`ical`, `wcs`) |
| `organizer` | – | organiser for every event (`wcs`; `ical` if `ORGANIZER` is missing) |
| `locationDefault` | – | venue for events without one (`wcs`, `ical`) |
| `icalUTCAs` | – | `ical` only: read wrong UTC times as `"+01:00"` or `"local"` ([details](?page=source-types#icalendar)) |
| `images` | `false` | keep the event images the source provides ([Event images](#event-images)) |
| `status` | written by the pipeline | [Health status](#health-status); do not edit |

Type-specific fields (`itemsPath`, `nextPath`, `itemSelector`, `extract`,
`mapping`, `wcsTypeIds`, …) are described in [Source types](?page=source-types).
The full list: [Source files](?page=configuration#source-files).

## Filters

Filters apply after fetching and mapping, the same way for every source type.

```json
{
  "daysAhead": 30,
  "categoryMap": { "Kino": "Kultur", "Lesung": "Kultur" },
  "categories": ["Kultur", "Markt"],
  "include": [{ "field": "location", "regex": "(?i)weißensee|1308[68]" }],
  "exclude": [{ "field": "title", "regex": "(?i)geschlossene gesellschaft" }]
}
```

- **`daysAhead`** drops events more than N days in the future (in the
  instance's time zone). Without it, everything the source delivers is kept.
  For `wcs` sources it also sets the window of the request, for paginated
  `json` sources the end of pagination, and for `ical` sources the window in
  which recurrences are expanded.
- **`categoryMap`** translates the source's category names into the
  instance's vocabulary from `categories.json`. Keys are matched
  case-insensitively; unmapped values are kept as they are. See
  [Categories](?page=categories).
- **`categoryRules`** sets the category from the title or another field,
  after `categoryMap`. See
  [Splitting a coarse category](?page=categories#splitting-a-coarse-category).
- **`categories`** is an allowlist, applied after `categoryMap` and
  `categoryRules`.
- **`include`** keeps only events where at least one rule matches;
  **`exclude`** drops events where any rule matches. Fields: `title`,
  `location` (name and address), `organizer`, `category`, `description`.
  Regular expressions use Go syntax; `(?i)` makes them case-insensitive.
  Invalid rules are logged and skipped.
- **Past events are always dropped.** This is not configurable.

The `include` example above takes, from a city-wide calendar, only what
happens in one neighbourhood.

## Linking events to places

`"place": "brotfabrik"` links every event of the source to that place in
`places.json` (by `id` or one of its `refs`). Use it for sources with a single
venue. For sources with several venues, set the reference per event with the
mapping rule `placeRef`. See [Places](?page=places#which-place-an-event-belongs-to).

## The same event from several sources

When the venue publishes an event and an aggregator calendar lists it too,
openLitfass merges them into **one** event.

- **Matching** uses date, start time and the normalised title (lower case,
  umlauts unified, punctuation and notes in square brackets such as
  `[AUSVERKAUFT!]` ignored). The location is not part of the key, because
  every source names venues differently; but two events with different
  postcodes are never merged.
- **The version shown** comes from the source with the highest `priority`.
  Give the venue's own source a higher value (for example `10`) than an
  aggregator (`0` or negative).
- **Empty fields are filled in** from the other sources: description, link,
  address, price, end time, category instead of the fallback, place
  reference. If any source reports a cancellation, the event counts as
  cancelled.
- The details show all contributing sources ("Quellen: A, B").
- Events of one and the same source are never merged with each other.

Matching is exact: rephrased titles ("Kiezchor: Weihnachtskonzert" and
"Weihnachtskonzert des Kiezchors") are not recognised as the same event.

## Cancelled events

Cancelled events are **not** removed. They are published with
`"cancelled": true` and clearly marked, so that people who planned to go find
out. A cancellation is detected from:

| Source | Signal |
|---|---|
| `ical` | `STATUS:CANCELLED`, also for a single occurrence of a series |
| `wcs` | hidden occurrence (`visible: false`) |
| `rss`, `json`, `html` | mapping rule `cancelled`, for example `{"path": "status", "equals": "cancelled\|canceled"}` |
| inbox | `"cancelled": true` |
| all | a marker in the title: `ABGESAGT: …`, `Abgesagt! …`, `+++ Entfällt +++ …`, `[abgesagt] …`, `… (abgesagt)`, `… – ABGESAGT`, `… - fällt aus!`, `… [VERSCHOBEN!]` |

The title is never changed; only the flag is derived from it. A marker needs a
separator, brackets or capital letters at the start, so "Abgesagt – ein
Theaterstück" stays an ordinary title. A postponed event counts as cancelled
on its original date. Notes such as "ausverkauft" (sold out) or
"Zusatztermin" (additional date) are deliberately ignored.

## Event images

Many sources publish an image per event. openLitfass never copies such an
image; it only keeps its URL and references it:

- static event pages name it in `og:image` and `twitter:image`, so link
  previews in messengers show it ([Static pages and SEO](?page=seo));
- the app and the static pages show it only as far as the visitor's
  [image setting](?page=settings) allows: after a click (default), always or
  never.

Images are **off by default**, because their licence varies. Turn them on per
source only where the source allows the use:

```json
{
  "type": "ical",
  "url": "https://example.org/events.ics",
  "images": true
}
```

Where the image comes from: `IMAGE` or `ATTACH` in [iCalendar](?page=source-types#icalendar),
the `image` rule in the [mapping](?page=field-mapping#target-fields) for `rss`,
`json` and `html` (in RSS, for example, `enclosure@url`), and the `image`
field in [inbox files](?page=inbox) (always kept). Only absolute `https`
URLs are kept; anything else is dropped silently. When several sources report
the same event, the image comes from the shown version, otherwise from the
next source that has one.

> **Note:** some messengers (for example WhatsApp and iMessage) build link
> previews on the sharing person's device, which then requests the image from
> the source's server. Mention this in the privacy policy (the example
> instance's `site/datenschutz.html` has a template).

## Health status

Every fetch attempt writes a `status` block back into the source's own file:

```json
"status": {
  "lastAttempt": "2026-07-13T08:00:12Z",
  "lastSuccess": "2026-07-06T08:00:09Z",
  "lastError": "fetch https://example.org/feed.xml: unexpected status 404 Not Found"
}
```

- `lastAttempt`: the last attempt, successful or not.
- `lastSuccess`: the last **successful** fetch. A failure does not update it,
  so it shows how long a source has been broken.
- `lastError`: the error of the last attempt; absent on success.

A source that broke silently (a redesign breaks the mapping, a feed moves)
shows up in `git diff` of the source file, without searching CI logs. The
workflow commits the status together with the data.

> **Note:** when the status is written back, the file is re-serialised: the
> fields appear in a fixed order and **unknown keys are removed**. Keep notes
> about a source in a separate file, not in unknown JSON fields.

To pause a source, set `"disabled": true`: no fetch attempt and no status
update take place until you remove it.

## Fault tolerance

A single broken source never breaks the run:

- each source has its own timeout (20 seconds, `timeoutSeconds` raises it),
  so a hanging server does not use up the time of the others;
- a crash inside a source (a panic caused by unexpected data) becomes a
  logged error of that source;
- a source that fails keeps its events from the previous run;
- events without a title or with an implausible date are dropped with a
  warning;
- if **all** sources fail, `data/events.json` is left untouched instead of
  being overwritten with an empty list.

More in [How it works](?page=architecture#fault-tolerance).

## Sources that need code

Formats that fit none of the types (logins, POST requests, authenticated
APIs) need a small Go implementation in the core. That is the exception; see
[Development](?page=development#a-source-with-custom-go-code).
