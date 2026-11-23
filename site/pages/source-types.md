# Source types

Every source file has a `type`. Prefer them in this order: a source with a
standard format (`ical`) needs no mapping and breaks least; `rss` and `json`
need a [field mapping](?page=field-mapping); `html` reads the page layout and
breaks when the layout changes. Templates for every type are in the example
instance's `sources/` directory.

## iCalendar

For calendar exports from Google Calendar, Nextcloud, Outlook and most
WordPress event plugins (Events Manager `/events.ics`, The Events Calendar
`?ical=1`, …). No mapping is needed; the fields are defined by the standard.

```json
{
  "type": "ical",
  "url": "https://example.org/events.ics",
  "daysAhead": 120,
  "organizer": "Beispiel-Bühne",
  "locationDefault": "Beispiel-Bühne, Musterstraße 5, 12345 Berlin",
  "categoryMap": { "Konzert": "Kultur" },
  "familyFriendly": false
}
```

| iCalendar | Event field |
|---|---|
| `SUMMARY` | `title` |
| `DESCRIPTION` | `description` (cleaned, truncated) |
| `URL` | `url` |
| first value of `CATEGORIES` | `category` (translate with `categoryMap`) |
| `ORGANIZER;CN=…` | `organizer`, otherwise `organizer` from the file |
| `X-APPLE-STRUCTURED-LOCATION` (`X-TITLE`, `X-ADDRESS`) | location name and address |
| otherwise `LOCATION` | location name, otherwise `locationDefault` |
| `UID` (plus the date for recurrences) | stable ID |
| `STATUS:CANCELLED` | `cancelled` |
| – | price unknown (iCalendar has no price) |

**Times:** UTC (`…Z`), `TZID=…` and "floating" times without a zone (then the
calendar's `X-WR-TIMEZONE`, otherwise the instance's time zone); all-day
events (`VALUE=DATE`); `DURATION` instead of `DTEND`. If the end equals the
start (Events Manager does this when no end time is set), the end time is
left empty. Unknown zone names, such as Windows names, fall back to the
instance's time zone.

**Recurrences (`RRULE`):** `DAILY`, `WEEKLY` (also with `BYDAY=TU,TH`),
`MONTHLY` (same day of the month) and `YEARLY`, each with `INTERVAL`, `COUNT`
and `UNTIL`; `EXDATE` and modified single occurrences (`RECURRENCE-ID`) are
supported. Recurrences are expanded only within `daysAhead` (default 180
days, at most 500 occurrences). Unsupported rules, such as "every first
Monday" (`MONTHLY` with `BYDAY=1MO`), yield only the first occurrence and a
log line.

## RSS

For RSS feeds. `path` in the mapping is the lower-case tag name, without
namespace, of a child element of `<item>`: `title`, `link`, `description`,
`pubdate`, `guid`, `category`, and any custom tag of the feed.

```json
{
  "type": "rss",
  "url": "https://example.org/events/feed",
  "mapping": {
    "sourceId": { "path": "guid" },
    "title": { "path": "title" },
    "description": { "path": "description" },
    "url": { "path": "link" },
    "category": { "path": "category", "default": "Kultur" },
    "organizer": { "default": "Beispiel-Kulturzentrum" },
    "locationName": { "default": "Beispiel-Kulturzentrum" },
    "start": { "path": "pubdate", "format": "RFC1123Z" }
  }
}
```

> **Warning:** many feeds publish the date of the *post* in `pubDate`, not the
> date of the event. Check a few entries against the website; the event date
> is often in the title or the text and can be extracted with a
> [regex](?page=field-mapping#extracting-with-regex).

## JSON

For JSON APIs. `itemsPath` points to the array of events in the response
(for example `"data.items"`); if it is empty, the response itself is the
array. `path` in the mapping is a dot path into one item.

```json
{
  "type": "json",
  "url": "https://example.org/api/events",
  "itemsPath": "data.items",
  "mapping": {
    "sourceId": { "path": "id" },
    "title": { "path": "name" },
    "description": { "path": "text" },
    "url": { "path": "detailUrl" },
    "category": { "path": "tags.0", "default": "Unkategorisiert" },
    "organizer": { "path": "organizer.name" },
    "locationName": { "path": "location.title" },
    "locationAddress": { "path": "location.address" },
    "start": { "path": "startDateTime", "format": "2006-01-02T15:04:05Z07:00" },
    "end": { "path": "endDateTime", "format": "2006-01-02T15:04:05Z07:00" },
    "price": { "amountPath": "price.amount" }
  }
}
```

### Pagination

`nextPath` points to the URL of the next page in the response, for example
`"next_rest_url"` for the WordPress plugin *The Events Calendar*
(`/wp-json/tribe/events/v1/events`). Pages are followed until there is no
next page, `maxPages` (default 10) is reached, or a whole page lies beyond
`daysAhead`. If a later page fails, the events collected so far are kept.

## HTML

For event pages without a feed or API, events are read from the HTML with
CSS selectors in three steps:

1. **`itemSelector`** finds each event container on the page.
2. **`extract`** pulls named values out of each container.
3. **`mapping`** works as for `json`; `path` refers to the names from
   `extract`.

```json
{
  "type": "html",
  "url": "https://example.org/veranstaltungen.html",
  "itemSelector": "#events .event",
  "extract": {
    "day": ".date .day", "month": ".date .month", "year": ".date .year",
    "title": "h2",
    "start": { "selector": "p.time", "regex": "(\\d{1,2}:\\d{2})" },
    "end": { "selector": "p.time", "regex": "-\\s*(\\d{1,2}:\\d{2})" },
    "description": { "selector": "p", "all": true, "skip": 2, "html": true }
  },
  "mapping": {
    "title": { "path": "title" },
    "description": { "path": "description" },
    "start": { "template": "{day} {month} {year} {start}", "format": "2 Jan 2006 15:04|2 Jan 2006" },
    "end": { "template": "{day} {month} {year} {end}", "format": "2 Jan 2006 15:04" }
  }
}
```

An `extract` entry is either a selector (`"title": "h2"`, the text of the
first match) or an object:

| Field | Meaning |
|---|---|
| `selector` | CSS selector relative to the container; empty = the container itself |
| `attr` | an attribute instead of the text, for example `"href"`; relative URLs are resolved |
| `html` | inner HTML instead of text, so that paragraphs of a description are kept |
| `all`, `skip` | join all matches instead of only the first, skipping the first `skip` |
| `regex` | extract part of the value ([rules](?page=field-mapping#extracting-with-regex)) |

**Supported selectors:** `tag`, `*`, `.class`, `#id`, `[attr]`,
`[attr=value]`, `[attr~=word]`, `[attr*=part]`, `:first-of-type`,
`:nth-of-type(n)`, descendant (`a b`) and child (`a > b`). Selector lists
(`,`) and sibling combinators are not supported.

### Headings that group entries

Some pages put a heading before a group of entries instead of around them,
like a cinema programme:

```html
<h3 class="program_date1">Samstag, 21.11.2026</h3>
<div class="program_entry"><a href="/film/x/1">12:45 Film X</a></div>
<div class="program_entry"><a href="/film/y/2">20:15 Film Y</a></div>
<h3 class="program_date1">Sonntag, 22.11.2026</h3>
```

With `"sectionSelector": "h3.program_date1"`, each entry gets the text of the
last heading before it as the value `section`, usable in the mapping like an
`extract` name:

```json
"start": {
  "template": "{section} | {time}",
  "regex": "(\\d{2}\\.\\d{2}\\.\\d{4})[^|]*[|]\\s*(\\d{1,2}:\\d{2})?",
  "format": "02.01.2006 15:04|02.01.2006"
}
```

### When the layout changes

If `itemSelector` finds nothing, the source reports an error in its
[status](?page=sources#health-status) instead of silently returning no
events. Usually the page has been redesigned. HTML sources are inherently
more fragile than feeds: if a site offers a feed or an API, use that.

## Weekly Class Schedule (wcs)

Some neighbourhood centres run WordPress with the "Weekly Class Schedule"
plugin by CurlyThemes. Its weekly table is filled by JavaScript from
`admin-ajax.php?action=wcs_get_events_json`; there is no feed. The `wcs` type
reads that endpoint directly.

```json
{
  "type": "wcs",
  "url": "https://www.familienzentrum-weissensee.de",
  "daysAhead": 30,
  "organizer": "Familienzentrum Weißensee",
  "locationDefault": "Familienzentrum Weißensee, Mahlerstraße 4, 13088 Berlin",
  "wcsTypeIds": [27, 28, 29, 30],
  "familyFriendly": true,
  "categoryMap": {
    "austausch": "Unkategorisiert",
    "bewegung": "Sport",
    "kreatives": "Kultur"
  }
}
```

- **`url`** is the site's base URL, not the Ajax endpoint.
- **`wcsTypeIds` is required in practice.** Without it, the endpoint also
  returns the demo classes that ship with the plugin template ("Advanced
  Aqua Zumba", "Chemistry Lab", …). To find the IDs, open the calendar page
  in the browser, look for the `admin-ajax.php?action=wcs_get_events_json`
  request in the developer tools' Network tab and read its
  `content[wcs_type][]` values.
- **`locationDefault`:** the part before the first comma is the venue name,
  the whole string the address; the room from the plugin is inserted after
  the venue.
- **`categoryMap`** keys can be the plugin's type slugs.
- **`daysAhead`** sets the request window (default 30 days).
- `familyFriendly` applies to every event. The plugin has no ticket or
  registration information, so those attributes are always `false`.
- Hidden occurrences are published as cancelled.

> **Warning:** the plugin returns times with a `+00:00` suffix although they
> are local times. The `wcs` type therefore reads them as the instance's local
> time. This is a verified quirk of this plugin, not a rule: for every new
> source, compare a few times with the website.

## Time zones

Every source needs its own check of how it writes times. Platforms are
careless with time zones: some write UTC, some local time with a wrong
offset, some local time without any offset. Compare a few events with the
times published on the organiser's website before relying on a source. For
`rss`, `json` and `html` sources, see
[Times](?page=field-mapping#times).
