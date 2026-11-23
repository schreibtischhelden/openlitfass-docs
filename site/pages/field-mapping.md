# Field mapping

`rss`, `json` and `html` sources describe in a `mapping` object how one item
of the source becomes an event. `ical` and `wcs` sources need no mapping.

```json
"mapping": {
  "title": { "path": "name" },
  "start": { "path": "startDateTime", "format": "RFC3339" },
  "locationAddress": { "template": "{venue.address}, {venue.zip} {venue.city}" },
  "price": { "amountPath": "cost", "unknownIfMissing": true }
}
```

## Rules

Each entry in `mapping` is a rule with these fields:

| Field | Meaning |
|---|---|
| `path` | where the value comes from: dot path into the JSON item (`location.title`, `tags.0`), RSS tag name, or `extract` name |
| `template` | instead of `path`: combine several values, `"{street}, {zip} {city}"` |
| `regex` | extract part of the value |
| `format` | `start` and `end` only: time layout for parsing |
| `default` | used when `path` or `template` yields nothing |
| `equals` | attribute rules only: texts that count as true |

### Paths

- **JSON:** dot path into one item; numbers index arrays (`tags.0` is the
  first tag). `itemsPath` in the source file selects the array of items.
- **RSS:** the lower-case tag name of a child of `<item>`, without namespace
  (`content:encoded` → `encoded`).
- **HTML:** a name defined in `extract`, or `section` with
  `sectionSelector`.

### Templates

`template` replaces every `{dot.path}` with its value and tidies separators
next to empty values: if the street is missing,
`"{street}, {zip} {city}"` gives "13086 Berlin", not ", 13086 Berlin".
`{a|b}` takes the first non-empty value, for example `{beginn|einlass}`.

### Extracting with regex

`regex` is applied to the value from `path` or `template` (Go syntax) and
yields:

1. the group named `value`, if there is one: `"Beginn (?P<value>\\d{2}:\\d{2})"`;
2. otherwise **all non-empty groups**, joined with spaces;
3. without groups, the whole match;
4. without a match, nothing, and `default` applies.

Rule 2 makes alternatives possible: `(\d+)\s*€|Eintritt (frei)` gives "27"
or "frei". It also combines parts from different fields, for example the
date from the title and the time from the text:

```json
"start": {
  "template": "{title} | {encoded}",
  "regex": "(?s)(\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}).*?[|](?:.*?(\\d{1,2}(?::\\d{2})?)\\s*Uhr)?",
  "format": "2.1.06 15:04|2.1.06 15|2.1.06"
}
```

For "21.11.26 Jazz … | &lt;h4&gt;20 Uhr, Aula&lt;/h4&gt;…" this yields
"21.11.26 20"; without a time, the event is all-day. `[|]` instead of `\|`
saves one level of escaping in JSON. The same rules apply to `regex` in the
`extract` block of HTML sources.

## Target fields

All target fields are optional, but an event needs at least a title and a
date.

| Field | Content |
|---|---|
| `sourceId` | stable ID within the source, for example the RSS `guid` |
| `title` | title |
| `description` | description; paragraphs are kept, truncated at 1,200 characters |
| `category` | category, translated with `categoryMap` ([Categories](?page=categories)) |
| `organizer` | organiser |
| `url` | link to the event |
| `locationName`, `locationAddress` | venue and address |
| `placeRef` | place reference for sources with several venues ([Places](?page=places)) |
| `start`, `end` | timestamps with `format` (recommended) |
| `date`, `startTime`, `endTime` | alternatively the parts, already as `YYYY-MM-DD` and `HH:MM` |
| `price` | [price object](#price) |
| `ticketRequired`, `registrationRequired`, `familyFriendly`, `cancelled` | [attribute rules](#attributes) |

**Text is always cleaned:** HTML tags are removed, entities decoded
(`&#8211;` → `–`), soft hyphens and zero-width characters removed and
whitespace collapsed.

## Times

The recommended way is `start` (and optionally `end`) with a `format`. The
timestamp is parsed and converted into the instance's time zone
(`instance.json` → `timezone`); `date`, `startTime` and `endTime` are derived
from it. This works for timestamps with an explicit offset and for "naive"
local times.

`format` is a Go reference layout or one of the aliases:

| Alias | Layout | Typical source |
|---|---|---|
| `RFC3339` | `2006-01-02T15:04:05Z07:00` | JSON APIs |
| `RFC1123Z` | `Mon, 02 Jan 2006 15:04:05 -0700` | RSS `pubDate` |
| `RFC1123` | `Mon, 02 Jan 2006 15:04:05 MST` | RSS |

A Go layout writes the reference time *Mon Jan 2 15:04:05 2006* in the form
the source uses: `02.01.2006 15:04` for "21.11.2026 20:00",
`2 Jan 2006` for "21 Nov 2026".

- **Several layouts** are separated with `|` and tried in order:
  `"2 Jan 2006 15:04|2 Jan 2006"`. If only a layout without a time matches,
  the event is all-day.
- **German month names** and abbreviations ("Nov.", "März", "Dezember") are
  understood in layouts with month names.
- **Without a year** (`"2.1. 15:04"` for "Fr | 20.11."), the nearest year is
  used: the current year, unless the date is more than a month in the past,
  then the next year.

If a source already delivers `date` (`YYYY-MM-DD`), `startTime` and `endTime`
(`HH:MM`) separately in exactly this form, map them directly; they are taken
over without conversion.

## Price

`price` is an object of its own:

| Field | Meaning |
|---|---|
| `amountPath` | path to the amount in euros, also as text; `0` or missing = free |
| `amountRegex` | extract the amount from free text at `amountPath` |
| `freePath` | path to an explicit Boolean; takes precedence |
| `unknownIfMissing` | `true`: a missing amount means "price unknown" instead of free |

Free text, for example "Eintritt frei" or "12,50 €":

```json
"price": {
  "amountPath": "costs",
  "amountRegex": "(?i)eintritt\\W{0,3}(frei)|(\\d+(?:,\\d+)?)\\s*€",
  "unknownIfMissing": true
}
```

"frei" counts as free; no match counts as missing. Use `unknownIfMissing` for
sources that leave the price out when they do not know it; otherwise those
events would show as free.

## Attributes

`ticketRequired`, `registrationRequired`, `familyFriendly` and `cancelled`
read the value at `path` as a Boolean. With `equals`, they are true when the
value matches one of the texts instead (case-insensitive, separated by `|`):

```json
"cancelled": { "path": "status", "equals": "cancelled|canceled" },
"registrationRequired": { "path": "meta.anmeldung" }
```

If `path` is missing or does not resolve, the attribute is `false`.
Cancellations are also detected from markers in the title, see
[Cancelled events](?page=sources#cancelled-events).

## Testing a mapping

1. Look at the raw data first:

   ```sh
   curl -sL "https://example.org/api/events" | python3 -m json.tool | head -50
   ```

2. Run `fetch` against the instance (see
   [Development](?page=development#running-locally)) and check the source's
   `status` and its events in `data/events.json`.
3. Compare a few events with the website: date, time, price and venue.
