# Event inbox

The inbox is the manual counterpart to the sources: for events that arrive
through no feed, such as a flyer, a phone call or a tip from the
neighbourhood. Put **one JSON file per event** into the instance's `inbox/`
directory and commit it. No URL and no mapping are needed.

## A single event

```json
{
  "title": "Flohmarkt am Antonplatz",
  "date": "2026-12-05",
  "startTime": "10:00",
  "endTime": "16:00",
  "category": "Markt",
  "description": "Trödel, Bücher und Kuchen.",
  "location": { "name": "Antonplatz", "address": "Antonplatz, 13086 Berlin" },
  "organizer": "Kiezinitiative",
  "url": "https://example.org/flohmarkt"
}
```

Template: `inbox/beispiel-event.example.json` in the example instance. Files
ending in `.example.json` are not read.

| Field | Meaning |
|---|---|
| `title` | required |
| `date` | required (unless `repeat` is set), `YYYY-MM-DD` |
| `startTime`, `endTime` | `HH:MM`; without `startTime` the event is all-day |
| `description`, `category`, `organizer`, `url` | as for any event |
| `location` | `{ "name": …, "address": … }` |
| `price` | `{ "free": true }`, `{ "free": false, "amount": 8 }`; **if omitted, the event is free**; `{ "free": false }` alone means unknown |
| `ticketRequired`, `registrationRequired`, `familyFriendly`, `cancelled` | optional, default `false` |
| `place` | `id` or ref of a place in `places.json` ([Places](?page=places)) |
| `repeat` | for recurring events, see below |

Dates and times are wall-clock time in the instance's time zone; nothing is
converted.

> **Warning:** do not set `price` to `null`; the front end would show
> "null €".

The **file name** (without `.json`) is the event's stable ID. Do not rename a
file when you edit it, or the next run treats it as a new event (and shared
links and saved stars break).

## Recurring events

For opening hours, weekly classes and similar, use `repeat` instead of
`date`. All other fields apply to every occurrence.

```json
{
  "title": "Kinderbauernhof geöffnet",
  "description": "Montag bis Freitag 9–16:30 Uhr, außer an Feiertagen.",
  "startTime": "09:00",
  "endTime": "16:30",
  "location": { "name": "Kinderbauernhof", "address": "Musterweg 2, 12345 Berlin" },
  "repeat": {
    "weekdays": ["mo", "di", "mi", "do", "fr"],
    "from": "10-01",
    "until": "03-31",
    "except": ["feiertage", "12-24", "12-31"],
    "daysAhead": 60
  }
}
```

| Field | Meaning |
|---|---|
| `weekdays` | `mo di mi do fr sa so` (also `mon`, `tue`, …); requires `from` |
| `from`, `until` | the period in which `weekdays` apply, see below |
| `dates` | additional days, also without `weekdays` |
| `except` | days on which the event does not take place |
| `daysAhead` | how far ahead occurrences are generated (default 60) |

`from` and `until` are either:

- **full dates** (`"2026-10-01"`): a fixed period; `until` is optional,
  without it the series is open-ended; or
- **month and day** (`"10-01"` to `"03-31"`): a season that recurs every
  year, also across the turn of the year. Both must use this form.

Use separate files for different times (summer and winter, weekdays and
weekends).

### Days in dates and except

| Entry | Meaning |
|---|---|
| `"2027-05-06"` | once, on that date |
| `"12-25"` | every year on 25 December |
| `"*-01"` | every month on the 1st |
| `"easter"`, `"easter+1"`, `"easter-2"` | relative to Western Easter Sunday: Easter Monday, Good Friday |
| `"easter+39"`, `"easter+49"`, `"easter+50"`, `"easter+60"` | Ascension Day, Whit Sunday, Whit Monday, Corpus Christi |
| `"feiertage"` | the name of a day list from `holidays.json` |

Easter is the only date openLitfass computes. Which public holidays apply is
up to the instance.

### Day lists (holidays.json)

The optional `holidays.json` defines named day lists that every inbox file
can use, so public holidays, school holidays or other recurring days are
maintained in one place. A list contains days as above or the names of other
lists:

```json
{
  "ostern": ["easter-2", "easter", "easter+1"],
  "pfingsten": ["easter+39", "easter+49", "easter+50"],
  "feiertage": ["01-01", "03-08", "05-01", "10-03", "12-25", "12-26", "ostern", "pfingsten"]
}
```

`holidays.example.json` in the example instance contains the public holidays
of Berlin; copy it to `holidays.json` and adapt it. List names must not look
like a day (`easter`, `12-25`). Write the wording for visitors, such as
"außer an Feiertagen", into the `description` yourself.

If `holidays.json` is invalid (bad JSON, an unknown entry, a list that
contains itself), the whole inbox fails for that run and keeps its events
from the previous run; the log names the problem.

### IDs of occurrences

Each occurrence gets its own ID, `<file name>@<date>`.

## Life cycle of an inbox file

1. Add the file, commit and push. The workflow runs on pushes to `inbox/`
   and includes the event from then on.
2. The file stays in place and is read on every run, so the event remains
   visible. `fetch` rebuilds `data/events.json` from scratch each time; a file
   deleted right away would make the event disappear on the next run.
3. Once the event's date has passed, `fetch` deletes the file and the
   workflow commits the deletion.

For recurring events, the file is deleted once `until`, or the last date in
`dates`, has passed. Files without `until`, with a season, or with yearly,
monthly or Easter-based days never expire; delete them yourself when they
are no longer needed.

## Invalid files

A file with invalid JSON, without `title`, with an unreadable `date` or an
invalid `repeat` is skipped and **not** deleted, so nothing is lost. The run
logs an error with the file name. Fix the file and commit it again.
