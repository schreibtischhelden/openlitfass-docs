# Using the calendar

This page describes the front end that visitors see. It is the same for
every instance; only colours, logo, texts and content differ. The interface
texts are currently German, so German labels are quoted here as they appear.

![The calendar in dark mode](assets/img/weissensee-dark.png)

## Toolbar and periods

Below the header, the toolbar summarises what is shown:
`[‹] [date] [›] … [active filters] [Filter]`.

- The arrows step through the selected period; the date opens the native
  date picker.
- The calendar starts on today and never shows earlier days.
- The date label always shows weekday and date (for example "Sa, 21.11." or
  "21.–27.11."), so its width stays the same while paging.
- Active filters appear as small icons. Tapping one removes that filter.
  The *Filter* button shows how many filters are active and opens the filter
  panel. If space runs out, the icons are hidden first.

## Filters

The filter panel has three groups:

- **Period:** a day, the weekend, or seven days from the selected date. The
  period is part of the URL (`#tag/2026-11-22`, `#wochenende/…`, `#woche/…`),
  so a view can be shared. If the period is empty, "Nächster Termin" (next
  event) jumps to the next day with matching events.
- **Categories** from the instance's `categories.json`. A category can belong
  to a group (for example cinema, theatre and music in *Kultur*). Selecting
  the group selects all its members; selecting a member while the group is
  active narrows the choice to that member. See
  [Categories](?page=categories#category-groups).
- **Attributes:** free entry, family-friendly, ticket required, registration
  required.

Each group has a reset link, and Escape closes the panel.

## The event list

Events are listed by day; the day headings stick below the toolbar.

- **Several days side by side:** as many columns as fit at a minimum of
  260 px each, but no more than the days in the period. On a tablet in
  portrait this is the weekend, in landscape four days, and from about
  1950 px the whole week. The cards then become compact.
- **Today's status:** events in progress are tinted green and labelled
  "Läuft" (in progress); finished events are dimmed. An event without an
  end time counts as in progress for two hours, an all-day event for the
  whole day. The list scrolls to the first event that has not yet finished,
  and the status is refreshed every minute.
- **Cancelled events** stay in the list, marked "Abgesagt" with a
  struck-through title, so that nobody turns up in vain. See
  [Cancelled events](?page=sources#cancelled-events).

## Search

The magnifier icon opens the search. It covers all upcoming events, not just
the selected period, and ignores accents (ß matches ss).

From two characters on, it suggests:

- **Ort:** venues and their individual words (for example "Brotfabrik" and
  "Kino" from "KINO Brotfabrik");
- **Typ:** categories; choosing one sets the category filter;
- **Termin:** event titles,

each with the number of upcoming events. Arrow keys, Enter and Escape work as
expected.

## Event details

Tapping an event opens its details with a shareable URL (`/#<event-id>`):

- description, time, place, price, organiser and source ("Quelle: …"; with
  several sources "Quellen: A, B");
- the event image from the source, if the source provides one
  ([Event images](?page=sources#event-images)): by default a button "Bild
  von … laden" (load image from …), loaded only after a click;
- a map link (OpenStreetMap) and, when coordinates are known, a "Karte
  anzeigen" (show map) button. Map tiles are loaded only after a click, as
  plain images without cookies, no iframe and no map library. Both can be
  set to load always or never in the [settings](?page=settings);
- "In Kalender" downloads the event as an `.ics` file;
- "Teilen" opens the system share sheet on mobile devices (Web Share API,
  only over HTTPS) or copies the link;
- a link to the event's place, if it has one ([Places](?page=places)).

Addresses in descriptions become map links. External links open in a new tab.

> **Note:** the map loads tiles from `tile.openstreetmap.org`, which receives
> the visitor's IP address. Mention this in the instance's privacy policy.

## Saved events

Every card has a star. A filled star means the event is saved ("Gemerkt").
Saved events are stored only in the visitor's browser; no account is needed
and nothing is sent anywhere.

## Places

If the instance has a `places.json`, a tab "Orte" appears next to
"Termine". It lists venues, parks, sights and markets by type, each with
description, address, map, opening hours and the upcoming events held there.
See [Places](?page=places).

## About page

The "Über" (about) page shows the instance's `about` text, the list of
sources with their websites, "Termin melden" (submit an event), links to the
issue trackers, the legal notice and the privacy policy. All of it comes from
[instance.json](?page=configuration#instancejson).

## Light and dark mode

Without a choice, the system setting applies. The moon/sun switch in the
header sets the scheme and remembers it in the browser. If the choice matches
the system setting again, the page follows the system once more. The same
choice is in the settings.

## Settings

"Einstellungen" (settings, in the footer, `/#einstellungen`) holds what a
visitor can choose on their device: colour scheme, and whether maps and event
images from other servers load after a click, always or never. It also lists
everything the calendar has stored in the browser and deletes it. Nothing
leaves the device and no cookies are used. Details: [Settings on the
device](?page=settings).

## Install and offline use

The calendar is a progressive web app (PWA): it can be installed on the home
screen, and the service worker keeps the page and the most recently loaded
events available offline. Installable icons need `site/icon-192.png` and
`site/icon-512.png` in the instance ([Theming](?page=theming#icons)).

## Without JavaScript

With [static pages](?page=seo) enabled, the start page already contains
today's events in its HTML, and `termine/` lists all upcoming events with a
page per event. Visitors without JavaScript and search engines see those.
