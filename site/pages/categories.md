# Categories

Every event has exactly one **category**, which decides its icon and where
it appears in the category filter. The instance defines its categories in
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
- Each event still has exactly one category.

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
  An event can combine them freely, and they have filters of their own.

Keeping the axes apart keeps the menu short and avoids events that would
belong to two categories.
