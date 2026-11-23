# FAQ

## Does openLitfass need a database or a server?

No. The result is a static website: HTML, CSS, JavaScript and JSON files.
It can be served by GitHub Pages, any web server or the image's own `serve`
command. Fetching runs on a schedule, either in GitHub Actions or inside the
container.

## Do I need to write code?

No, for almost all sources. RSS, JSON, iCalendar, HTML pages and WordPress
"Weekly Class Schedule" calendars are configured with a JSON file. Only
formats with logins, POST requests or authentication need a small Go source
in the core ([Development](?page=development#a-source-with-custom-go-code)).

## Why is every source a file of its own?

A change to a source touches one file: clean diffs, no merge conflicts, and
the source's health status lives next to its configuration.

## How often are events updated?

Every six hours by default: the cron schedule of `update-events.yml`, or
`OL_FETCH_INTERVAL` for the container. Pushes that change content trigger an
extra run.

## Can visitors submit events?

Not directly; there is no form and no account. `submitUrl` in
`instance.json` links to a place where people can send an event (an email
address or a form elsewhere). Someone then adds it to the
[inbox](?page=inbox).

## Does openLitfass track visitors?

No. There are no cookies, no analytics and no third-party requests, except
map tiles from OpenStreetMap after a click on "Karte anzeigen". Saved events
and the light/dark choice stay in the visitor's browser.

## Can the interface be in another language?

Not yet. The interface texts are German. `language` in `instance.json` only
sets the `lang` attribute of the page.

## Can I use openLitfass for something other than a neighbourhood?

Yes: a village, a club, a festival or event days with many talks and
workshops. Categories, places and texts are up to the instance.

## Can I copy events from another calendar's website?

Technically, an HTML source can read most pages. Check the website's terms
and ask the organiser; many are glad to be listed and can point you to a
feed. Every event links back to its source.

## Where are events stored?

In `data/events.json` of the instance. With GitHub Actions, every change is
committed, so the history of the calendar is in Git.

## How do I remove a single wrong event?

Fix it at the source if you can. Otherwise exclude it in the source file
with `exclude`, for example by its title
([Filters](?page=sources#filters)).

## Can I run several calendars on one server?

Yes: one container per instance, each with its own directory and port,
behind one reverse proxy.

## Why are cancelled events still shown?

So that people who planned to go find out. They are clearly marked
([Cancelled events](?page=sources#cancelled-events)).

## Which licence does openLitfass use?

The MIT Licence. The category icons come from Tabler Icons, also MIT. The
content of an instance (texts, sources, logo) belongs to its operators.
