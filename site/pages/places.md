# Places

An optional `places.json` in the instance adds a tab **"Orte"** (places) next
to "Termine" (events): sights, parks, venues, meeting points, markets, the
things in a neighbourhood that have no date. Each place lists the upcoming
events held there. Without `places.json`, the tab is hidden. The
[config UI](https://config.openlitfass.org/?page=places) edits `places.json`
with a form.

## places.json

```json
{
  "types": [
    { "name": "Kultur & Bühne", "icon": ["M…"] },
    { "name": "Park", "icon": ["M…"] }
  ],
  "places": [
    {
      "id": "theater-im-delphi",
      "name": "Theater im Delphi",
      "type": "Kultur & Bühne",
      "description": "Theater in einem ehemaligen Stummfilmkino.",
      "address": "Gustav-Adolf-Straße 2, 13086 Berlin",
      "lat": 52.5519,
      "lon": 13.4312,
      "url": "https://theater-im-delphi.de",
      "openingHours": "Kasse eine Stunde vor Vorstellungsbeginn",
      "season": "",
      "match": ["Delphi"],
      "refs": ["osm:way/123456"]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `types` | the place types, with icons as in [categories.json](?page=categories#categoriesjson); their order is the order of the type chips |
| `id` | required; lower-case letters, digits and hyphens; part of the URL |
| `name` | required |
| `type` | required; one of the `types` |
| `description`, `address`, `url` | shown on the place page |
| `lat`, `lon` | coordinates for the map link and the map snippet |
| `openingHours`, `season` | free text |
| `match` | terms that link events by their location; default: the name |
| `refs` | further identifiers of the place, see below |

`build-site` checks the file and writes `data/places.json`. A broken
`places.json` stops the build with an error that names the problem.

## The place page

The *Orte* view lists the places by type, with type chips as a filter. Each
place page shows the description, the address with a map link
(OpenStreetMap, at `lat`/`lon` if given), the map snippet, opening hours,
season, website, a share button and the **upcoming events held there**.

## Which place an event belongs to

`build-site` decides this for every event and writes the result as `placeId`
into the built site. The event details then link to the place ("Mehr über
diesen Ort"), and the place lists the event. In this order:

1. **Explicit reference** from the source: the event's own reference
   (mapping rule `placeRef`, or `"place"` in an inbox file), otherwise
   `"place"` in the source file. A reference is a place's `id` or one of its
   `refs`.
2. **Match terms:** the first place (in file order) one of whose `match`
   terms occurs in the event's location name or address, ignoring case and
   accents (ß = ss).
3. Otherwise the event has no place.

Choose match terms that are specific enough: `"Antonplatz"` would also catch
every event at "Antonplatz 1". When two places share an address (a workshop
inside a community centre), use explicit references instead.

A reference that no place has is logged as a warning, and the event falls
back to the match terms.

## References (refs)

`refs` are further identifiers of a place, typically its entry in another
directory:

- `osm:way/20130679` (OpenStreetMap)
- `vow:5809` (offene-werkstaetten.org)
- `geoportal:…`

The prefix is a convention; openLitfass does not interpret it. Refs are
compared exactly and must be unique: a ref used by two places, or equal to a
place's `id`, is an error.

Refs let sources with many venues point to the right place:

```json
"mapping": {
  "placeRef": { "template": "brotfabrik:{venue.id}" }
}
```

and give a future import a stable key against duplicates.

## Static place pages

With [static pages](?page=seo) enabled, `build-site` also writes
`orte/index.html` and `orte/<id>.html` (with a schema.org `Place` and the
upcoming events) and adds them to the sitemap.
