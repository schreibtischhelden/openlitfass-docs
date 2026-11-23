# Data formats

`fetch` and `build-site` write JSON files that the front end reads. They are
also useful for anything else that wants the events of an instance: they are
public files of the built site, for example `https://weissens.ee/data/events.json`.

## events.json

```json
{
  "generatedAt": "2026-07-05T15:40:00Z",
  "events": [
    {
      "id": "flohmarkt-am-antonplatz-3f9a1b2c",
      "title": "Flohmarkt am Antonplatz",
      "description": "…",
      "category": "Markt",
      "date": "2026-07-07",
      "startTime": "10:00",
      "endTime": "16:00",
      "location": { "name": "Antonplatz", "address": "Antonplatz, 13086 Berlin" },
      "price": { "free": true, "amount": null },
      "organizer": "Kiezinitiative",
      "url": "https://example.org/flohmarkt",
      "source": "kiezkalender",
      "sources": ["kiezkalender"],
      "ticketRequired": false,
      "registrationRequired": false,
      "familyFriendly": false,
      "cancelled": false,
      "place": "osm:way/123456"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `generatedAt` | time of the run; ignored by the front end |
| `id` | stable ID ([Event IDs](?page=architecture#event-ids)) |
| `title`, `description` | text; the description keeps its paragraphs |
| `category` | a category name ([Categories](?page=categories)) |
| `date` | `YYYY-MM-DD`, in the instance's time zone |
| `startTime`, `endTime` | `HH:MM`, in the instance's time zone; empty start time = all-day |
| `location` | `name`, `address`, optionally `lat` and `lng` |
| `price` | `free` and `amount` in euros; `free: false` with `amount: null` = unknown |
| `organizer`, `url` | optional |
| `source` | the source whose version is shown |
| `sources` | all contributing sources, the shown one first |
| `ticketRequired`, `registrationRequired`, `familyFriendly`, `cancelled` | always set |
| `place` | optional place reference from the source |

Events are sorted by date and start time. Past events are not included.

In the built site, `build-site` adds **`placeId`**, the resolved place
([Places](?page=places#which-place-an-event-belongs-to)). The file in the
instance's `data/` does not contain it.

## categories.json

```json
{
  "generatedAt": "2026-07-15T08:00:00Z",
  "categories": [
    { "name": "Kultur", "icon": ["M12 21a9 9 0 0 1 0 -18…", "…"] },
    { "name": "Kino", "group": "Kultur", "icon": ["…"] }
  ]
}
```

All categories of the instance's registry in its order, followed by unknown
categories found in the current events. `icon` holds SVG path data for a
24 × 24 box. Written from the same final event list as `events.json`, so the
two never diverge.

## sources.json

```json
{
  "generatedAt": "2026-11-23T20:37:46Z",
  "sources": [
    {
      "name": "brotfabrik",
      "label": "Brotfabrik",
      "homepage": "https://brotfabrik-berlin.de",
      "lastSuccess": "2026-11-23T20:37:32Z"
    }
  ]
}
```

The public part of the source files, for the "Quelle: …" line and the list of
sources on the About page. Feed URLs and errors are not included.

## places.json

The checked content of the instance's `places.json`, with `types` and
`places` as described in [Places](?page=places#placesjson). Written by
`build-site`, only if the instance has places.

## site.json

The content of `instance.json`, for the front end. Written by `build-site`.

## iCalendar download

"In Kalender" in the event details creates an `.ics` file in the browser,
with `STATUS:CANCELLED` for cancelled events. There is no subscribable feed
yet.
