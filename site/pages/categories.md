# Categories

Every event has one **main category**, which decides its icon and where it
appears in the category filter. Sources that list several categories per
event keep all of them in the event's `categories` list
([below](#several-categories-per-event)). The instance defines its categories in
`categories.json`; sources translate their own names into them with
`categoryMap`. The [config UI](https://config.openlitfass.org/?page=categories)
edits `categories.json` with a form.

## categories.json

```json
{
  "fallback": "Unkategorisiert",
  "categories": [
    { "name": "Kultur", "icon": ["M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8…", "M7.5 10.5a1 1 0 1 0 2 0…"] },
    { "name": "Kino", "group": "Kultur", "icon": ["…"] },
    { "name": "Sport", "icon": ["…"] },
    { "name": "Unkategorisiert", "icon": ["…"] }
  ]
}
```

| Field | Meaning |
|---|---|
| `fallback` | required: the category for events without one; must be one of the listed categories |
| `categories[].name` | the category name, as it appears in events and in the front end |
| `categories[].icon` | SVG path data (the `d` attributes of the icon's paths), drawn in a 24 × 24 box with a stroke |
| `categories[].group` | optional: another category this one belongs to |
| `categories[].familyFriendly` | optional: every event with this category is family-friendly ([attributes](#attributes-from-categories)) |

- The **order** of the entries is the order in the filter panel.
- The icons in the example instance are taken unchanged from
  [Tabler Icons](https://tabler.io/icons) (MIT Licence). To add one, open
  the icon's SVG and copy the `d` attribute of every `<path>` into `icon`;
  leave out the invisible first path (`M0 0h24v24H0z`).
- Changes take effect with the next run; no front-end change is needed.

## Mapping source categories

Sources rarely use your category names. `categoryMap` in the source file
translates them, case-insensitively:

```json
"categoryMap": { "Konzert": "Kultur", "Lesung": "Kultur", "Flohmarkt": "Markt" }
```

A source without a category gets the `default` of its mapping rule, or
otherwise the fallback category.

## Several categories per event

Some sources list several categories per event in one value, for example
"Ausstellung, Führungen & Touren". `categorySeparator` splits that value:

```json
"categorySeparator": ", ",
"categoryMap": { "Führungen & Touren": "Führungen", "Konzert": "Musik" }
```

- The event gets every category in its `categories` list, translated with
  `categoryMap`, in the source's order and without duplicates.
- The **main category** (`category`) is the first one that `categoryMap`
  knows, otherwise the first one in the list.
- Choose the separator carefully: with `", "`, "Tanz,Party & Disco" stays one
  category.
- Without `categorySeparator`, the value stays whole and the list holds just
  that one category.

## Filtering by category

`categoryFilter` works on the **source's own names**, before `categoryMap`,
compared case-insensitively:

```json
"categoryFilter": {
  "deny": ["Ausstellung"],
  "allow": ["Führungen & Touren"],
  "exclude": ["Kinder"]
}
```

| Field | Acts on | Meaning |
|---|---|---|
| `deny` | the event | drop events with any of these categories; `""` stands for an event without categories |
| `allow` | the event | keep an event that `deny` would drop if it has any of these categories; on its own it filters nothing |
| `include` | the list | keep only these categories on the event |
| `exclude` | the list | remove these categories from the event; the event stays |

With the example above:

| Categories from the source | Result |
|---|---|
| Ausstellung | dropped |
| Ausstellung, Führungen & Touren | kept, `allow` wins over `deny` |
| Konzert | kept |
| Kinder, Theater | kept with the category Theater only |
| *(none)* | kept, unless `deny` contains `""` |

`deny` and `allow` run first; a dropped event is not processed further. An
event whose categories `include`/`exclude` remove completely stays, without
category.

## Attributes from categories

A category can switch on the attribute `familyFriendly`:

- **for the whole instance** with `"familyFriendly": true` on the category in
  `categories.json`; it applies to the main category and to every category
  in the list, after `categoryMap`;
- **for one source** with `categoryAttributes`, keyed by the source's own
  names (case-insensitive, before `include`/`exclude`):

```json
"categoryAttributes": { "Kinder": { "familyFriendly": true } }
```

Attributes are only ever switched on, never off.

## Order of processing

1. Split the category value (`categorySeparator`).
2. `categoryFilter.deny` / `allow`: drop the event or go on.
3. `categoryAttributes` of the source.
4. `categoryFilter.include` / `exclude`: which categories the event keeps.
5. `categoryMap`, then the main category.
6. `categoryRules` (see [below](#splitting-a-coarse-category)).
7. The `categories` allowlist and the `include`/`exclude` rules on fields.
8. After all sources: `familyFriendly` from `categories.json`.

`categories` and `include`/`exclude` rules on the field `category` are
**deprecated**: they still work but are logged. Use `categoryFilter`
instead; they will be removed in a later release.

## Splitting a coarse category

Some sources file very different events under one category, for example
workshops, flea markets and guided tours all under "Extra". `categoryMap`
translates a category only one to one. `categoryRules` sets the category by
regular expression instead:

```json
"categoryMap": { "Extra": "Unkategorisiert", "Bühne": "Kultur" },
"categoryRules": [
  { "field": "title", "regex": "(?i)workshop|bastel|aquarell", "category": "Mitmachen" },
  { "field": "title", "regex": "(?i)(advents|weihnachts|floh)markt\\b", "category": "Markt" },
  { "field": "title", "regex": "(?i)\\b(stadt|abend)?führung(en)?\\b|rundgang", "category": "Führungen" }
]
```

- The rules are checked in order; the **first match** sets the category.
  Without a match the category stays as it is.
- Fields are the same as for `include`/`exclude`: `title`, `location`,
  `organizer`, `category`, `description`. A `category` rule sees the main
  category after `categoryMap`.
- `categoryRules` set the main category after `categoryMap` and before the
  `categories` allowlist and `include`/`exclude`, so the filters see the
  final category ([order of processing](#order-of-processing)).
- Rules with an unknown field, an invalid regular expression or an empty
  `category` are logged and skipped.
- Use word boundaries (`\b`, written `\\b` in JSON) to avoid false matches:
  "Aufführung" must not match "Führung".
- Go's regular expressions have no lookahead. To protect a category from
  later rules, put a rule first that maps it to itself, for example
  `{ "field": "category", "regex": "^Umland$", "category": "Umland" }`.

## New categories appear on their own

`fetch` writes `data/categories.json` from the registry and the events of the
current run. All registry entries are always written, even without events,
so the menu stays stable. If events carry a category that the registry does
not know (a new source, a forgotten `categoryMap` entry, a typo), it is
**appended** in alphabetical order with the fallback icon and logged as a
warning. The run does not fail, and the category is visible instead of
hiding under the fallback. Give it an icon by adding it to `categories.json`,
or map it to an existing category in the source.

## Category groups

A category can name another category as its `group`, one level deep: for
example cinema, theatre, music and art in the group *Kultur*.

- In the filter panel, the members appear framed behind their group.
- Selecting the group selects all its members; selecting a member while the
  group is active narrows the selection to that member.
- The filter panel uses the event's main category.

`fetch` checks `categories.json` before fetching and stops with an error if it
is invalid: a missing fallback, a group that is not another listed category,
or a group that is itself in a group.

## Categories versus attributes

The categories use a single axis: the **subject area**. In the example
instance these are *Kultur, Sport, Kulinarik, Natur, Markt* and
*Unkategorisiert*.

- **Formats** such as concert or workshop belong to a subject (a concert is
  culture) and go into the title or description, not into a category.
- **Audiences and conditions** are attributes, not categories:
  `familyFriendly`, `ticketRequired`, `registrationRequired` and the price.
  An event can combine them freely, and they have filters of their own. A
  source category such as "Kinder" can still set an attribute
  ([attributes from categories](#attributes-from-categories)).

Keeping the axes apart keeps the menu short and avoids events that would
belong to two categories.
