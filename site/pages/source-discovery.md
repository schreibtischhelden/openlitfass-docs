# Finding sources

This playbook applies to every openLitfass instance. What you have found and
checked for your own area belongs in the instance itself, for example the
[source checklist of weissens.ee](https://github.com/weissensee/weissens.ee/blob/main/docs/sources-checklist.md).

It builds on research into comparable open-source projects, in particular
[judell/community-calendar](https://github.com/judell/community-calendar).

## Principle: comprehensive rather than curated

Better one source too many than one too few. Small, inconspicuous sources
are often the most productive: associations, parishes, schools, sports
clubs, neighbourhood initiatives, repair cafés and local newspapers. When in
doubt, add the source and narrow it down with
[filters](?page=sources#filters) (`categories`, `include`, `daysAhead`)
instead of discarding it.

## 1. Search

Search engines index the raw content of `.ics` files, which makes them
directly discoverable:

```
"BEGIN:VCALENDAR" "<place or neighbourhood>"
```

Further productive searches (replace `<place>`). The German terms are
deliberate; they are what local organisers write:

| Search | Finds |
|---|---|
| `<place> site:meetup.com` | Meetup groups with iCalendar export |
| `<place> "Veranstaltungskalender"` | local aggregators, district office pages |
| `<place> Kiezzeitung OR Nachbarschaftsinitiative` | small, often overlooked sources |
| `<place> Gemeinde OR Kirchengemeinde Veranstaltungen` | parishes |
| `<place> Sportverein Termine` | sports clubs |
| `<place> "Add to Calendar" OR "iCal"` | pages with an iCalendar export |

## 2. Known platforms

If a website runs on one of these platforms, there is usually a feed and no
scraping is needed:

| Platform | Feed | Type |
|---|---|---|
| Meetup | `https://www.meetup.com/{group}/events/ical/` | `ical` |
| Tockify | `https://tockify.com/api/feeds/ics/{calendar}` | `ical` |
| WordPress: The Events Calendar | `https://example.org/events/?ical=1`, or the REST API `/wp-json/tribe/events/v1/events` | `ical` or `json` |
| WordPress: Events Manager | `https://example.org/events.ics` | `ical` |
| WordPress: Modern Events Calendar | `https://example.org/events/?mec-ical-feed=1` | `ical` |
| WordPress: Weekly Class Schedule | no feed; see [wcs](?page=source-types#weekly-class-schedule-wcs) | `wcs` |
| Squarespace | `https://example.com/events?format=json` | `json` |
| Embedded Google Calendar | take the calendar ID from the embed code: `https://calendar.google.com/calendar/ical/{ID}/public/basic.ics` | `ical` |

How to recognise WordPress: page source containing `wp-content`, or
`/wp-json/` answering with JSON.

## 3. No official feed: the Network tab

Open the calendar page, open the browser's developer tools → *Network*,
filter on *Fetch/XHR*, reload the page or switch the view, and look for the
request that loads the events (often `admin-ajax.php` on WordPress or an
`/api/` path). Its response format and parameters tell you whether a `json`
source fits. This is how the `wcs` type was found.

If an iCalendar export is blocked by a firewall, the site's REST API is
sometimes less strictly protected: with *The Events Calendar*, try
`/wp-json/tribe/events/v1/events/` when `?ical=1` is blocked.

Only if nothing of this exists, read the page itself with an
[HTML source](?page=source-types#html).

## 4. Test before connecting

```sh
curl -sL "<feed-url>" -A "Mozilla/5.0" | grep -c "BEGIN:VEVENT"   # iCalendar: number of events
curl -sL "<json-url>" | python3 -m json.tool | head -50            # JSON: look at the structure
```

Check:

- Does the response contain real, current events?
- Are the times correct? Compare a few with the website
  ([Time zones](?page=source-types#time-zones)).
- How often does the content change? This matters for `daysAhead` and the
  schedule of the workflow.

## 5. Document

Record found, checked and rejected sources in the instance's checklist: URL,
type, what you tested, and why a source was rejected. The next person (or
you in a year) will search for the same things.

## 6. Connect

- `ical`, `rss`, `json` or `html`: copy a template into `sources/`
  ([Adding a source](?page=sources#adding-a-source)).
- WordPress with "Weekly Class Schedule": `wcs`.
- None fits (logins, POST requests, authentication): a custom source in Go,
  see [Development](?page=development#a-source-with-custom-go-code).
