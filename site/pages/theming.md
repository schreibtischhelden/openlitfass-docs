# Theming

Every instance uses the same front end from the core. It gets its own look
from the files in its `site/` directory, which `build-site` lays over the
core's `web/` directory: a file in `site/` replaces the core file with the
same path, and any other file is added.

```
site/
  css/theme.css        colour tokens
  logo.svg             logo in the header and source of the favicon
  icon-192.png         optional: PWA and touch icon
  icon-512.png         optional: PWA icon
  impressum.html       legal notice (if imprintUrl points here)
  datenschutz.html     privacy policy (if privacyUrl points here)
  …                    any other files: fonts, images, robots.txt
```

## Colours

`web/css/tokens.css` in the core defines the colours as CSS custom
properties ("tokens"). The rest of the stylesheet uses only these names, so
an instance changes its colours by overriding them in `site/css/theme.css`:

```css
:root {
  --color-primary-50: #E3E7E8;
  --color-primary-200: #9EABAE;
  --color-primary-500: #17383D;
  --color-primary-700: #112A2E;
  --color-primary-900: #0A1B1E;
  --color-neutral-50: #F3ECDD;
  --color-accent-500: #B5502F;
}
```

| Token | Used for |
|---|---|
| `--color-primary-50` … `-900` | header, buttons, active elements; the dark mode is built from the dark shades |
| `--color-neutral-0` … `-900` | page and card backgrounds, text |
| `--color-accent-500` | price, active filters, highlights, the logo accent |
| `--color-erfolg-*`, `--color-warnung-*`, `--color-fehler-*`, `--color-info-*` | success ("Läuft"), warning, error ("Abgesagt"), information; each with `-100`, `-500` and `-text-on-500` |
| `--bg-page`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--border-color`, `--accent-primary`, `--accent-primary-text`, `--focus-ring`, `--focus-ring-text` | the light and dark theme, derived from the scales above |

Overriding the scales is usually enough; the theme tokens follow. Check the
contrast of text colours against their backgrounds (WCAG AA: 4.5:1). The
theme of [weissens.ee](https://github.com/weissensee/weissens.ee/blob/main/site/css/theme.css)
is a complete example.

### Dark mode

Visitors can switch between light and dark mode; the choice is set as
`data-theme="dark"` or `data-theme="light"` on `<html>`. Rules for dark mode
in `theme.css` must therefore cover both the system setting and the switch:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg-page: #0A1B1E; }
}
[data-theme="dark"] { --bg-page: #0A1B1E; }
```

With only the media query, the system setting would win even when a visitor
has chosen light mode.

## Logo

`site/logo.svg` replaces the core's logo in the header. It is **inlined**
into the page, so:

- use `stroke="currentColor"` or `fill="currentColor"` for the parts that
  should take the header's text colour;
- give accent parts the class `logo-mark__accent`; they are filled with
  `--color-accent-500`;
- keep a `viewBox` (for example `0 0 24 24`) and no fixed colours for the
  main shape.

`build-site` derives `favicon.svg` from the logo: the logo in white on a
rounded square in `themeColor` from `instance.json`, with a fixed accent
colour.

## Icons

For an installable app and a sharp home-screen icon, add
`site/icon-192.png` and `site/icon-512.png` (square PNGs). They are linked
only if present; `build-site` writes `manifest.webmanifest` with `name`,
`shortName` and `themeColor` from `instance.json`.

## Web fonts

The core uses the system font stack, so no font is downloaded. To use your
own font, put the font files into `site/` (for example `site/fonts/`) and
declare them in `theme.css` with `@font-face`. Host fonts yourself rather
than loading them from a third-party service, which would receive every
visitor's IP address.

## Legal pages

The example instance contains templates for a legal notice
(`site/impressum.html`) and a privacy policy (`site/datenschutz.html`).
Adapt them and point `imprintUrl` and `privacyUrl` in `instance.json` to
them, or link existing pages with absolute URLs.

The privacy policy should mention:

- the host of the site and its server logs;
- the map tiles from `tile.openstreetmap.org`, which are loaded only after a
  click on "Karte anzeigen" and receive the visitor's IP address;
- that saved events and the light/dark choice are stored only in the
  browser.

openLitfass itself sets no cookies and uses no tracking.

## Texts

The interface texts (filter labels, buttons, empty states) are German and
come from the core (`STR` at the top of `web/js/app.js`). Instances cannot
change them yet; translations and instance-specific texts are not supported.
The instance controls `name`, `title`, `description` and `about` in
[instance.json](?page=configuration#instancejson).
