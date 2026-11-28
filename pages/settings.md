# Settings on the device

Visitors can choose a few things for themselves: the colour scheme, and
whether content from other servers loads. These choices stay in their
browser. This page describes what is stored, how the stored format is
versioned, and how to change it without breaking older entries. It is also
the decision record for this design.

## Decision

- **No cookies, no server-side state.** openLitfass sends nothing to third
  parties without the visitor's action, and it does not need consent for
  anything. Preferences the visitor sets themselves are kept in the browser's
  `localStorage` only; they never reach the server.
- **Nothing is written by default.** A visitor who changes nothing leaves no
  entry. The first write happens when someone changes a setting, saves an
  event, or when an entry of an older version is moved.
- **One versioned key for settings.** All preferences are in a single JSON
  object, so they can be migrated together.
- **Settings follow the openLitfass version.** The stored version is the
  release in which the format last changed, not the release that is running.

## What is stored

| Key | Content | Written when |
|---|---|---|
| `openlitfass:settings` | the settings below | a setting is changed, or an old entry is moved |
| `openlitfass:saved:<path>` | IDs of saved events ("Gemerkt") | an event is saved |
| Cache Storage `openlitfass-<build>` | offline copy of the app (service worker) | the app is loaded over HTTPS |

The settings page (`/#einstellungen`) lists every `openlitfass:*` entry with
its size and deletes single entries or everything, including the offline
copy.

## The settings object

```json
{ "v": "0.6.0", "rev": 0, "theme": "system", "maps": "click", "images": "click" }
```

| Field | Values | Default | Meaning |
|---|---|---|---|
| `v` | SemVer | – | openLitfass version in which the format last changed |
| `rev` | integer | `0` | change within that version (see below) |
| `theme` | `system`, `light`, `dark` | `system` | colour scheme; `system` follows `prefers-color-scheme` |
| `maps` | `click`, `auto`, `off` | `click` | map tiles from openstreetmap.org: after a click, always, never |
| `images` | `click`, `auto`, `off` | `click` | [event images](?page=sources#event-images) from the source: after a click, always, never |

An unknown or invalid value reads as the default; the stored value is left
alone.

## Versioning

`v` is the openLitfass version that introduced the current format, written
as a constant (`SCHEMA`) in `web/js/settings.js`. It is not the running
version: local builds report `dev`, and most releases do not change the
format at all.

`rev` counts changes within one version, for example when the format changes
twice before a release. It starts at `0` for each new version.

States are compared by `v` (SemVer) first, then by `rev`.

## Migrations

`web/js/settings.js` holds an ordered list of steps:

```js
var MIGRATIONS = [
  { v: "0.6.0", rev: 0, migrate: function (s, store) { /* … */ } }
];
```

On every page load, every step newer than the stored state runs in order;
afterwards the object carries the current `v` and `rev` and is written back.
A step changes the object `s` and may read and remove old keys through
`store`.

| Step | Change |
|---|---|
| `0.6.0` / `0` | first versioned format; moves `openlitfass:theme` (`light`/`dark`, up to 0.5) into `theme` and removes the old key |

Rules for every step and for the loader:

- **Never drop unknown fields.** A newer version may know them; an older one
  passes them on unchanged.
- **Broken JSON reads as defaults.** The entry is overwritten only when the
  visitor changes a setting.
- **No write-back after a downgrade.** If the stored state is newer than the
  code (a visitor opened an older instance or an old cached copy), the
  settings are read as far as they are known and nothing is written; the
  settings page shows a note and disables the controls.
- **Every access is wrapped in `try`/`catch`.** Private modes and blocked
  storage must not break the page; the defaults apply then.
- **Writes only where needed.** Without a stored entry, the loader writes only
  if a step moved old data.

## Changing the format

1. Add the field to `FIELDS` with its values and default, or change it.
2. Add a step to `MIGRATIONS` with the version of the coming release (the
   open milestone) and the next `rev` for that version, and set `SCHEMA` to
   the same state.
3. Describe the step in the table above.
4. Check in the browser: an entry of the previous format, an empty storage, a
   broken entry and an entry from a newer version.

The colour scheme is also read by a small inline script in the `<head>` of
`web/index.html` and `web/templates/layout.html`, so the page does not flash
before `settings.js` has loaded. Keep it in step when `theme` changes.
