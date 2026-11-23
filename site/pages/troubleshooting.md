# Troubleshooting

Start with three places: the **log** of the run (`docker logs`, or the
*Actions* tab), the **`status`** in the affected source file, and the
generated **`data/events.json`**.

## A source delivers no events

Look at its `status`:

- **`lastError` is set:** the message says what failed.
  - `unexpected status 404` or `403`: the URL has changed or the server
    blocks automated requests. Open the URL in the browser; look for the new
    feed address ([Finding sources](?page=source-discovery)).
  - `context deadline exceeded`: the server did not answer within 20
    seconds. If it persists, the source may be down.
  - parse errors: the response is not what the type expects, for example an
    HTML error page instead of JSON.
  - for `html` sources, `itemSelector "…" matched nothing`: the page was
    probably redesigned. Check the selector against the current page.
- **No error, but no events:**
  - All events may be filtered out: check `daysAhead`, `categories`,
    `include` and `exclude`.
  - The dates may be wrong, for example the publication date of an RSS post
    instead of the event date, so everything looks past. Past events are
    always dropped.
  - The mapping may not find the title or date: check `path` against the raw
    data ([Testing a mapping](?page=field-mapping#testing-a-mapping)).
- **No `status` at all:** the file was not loaded. Its name ends in
  `.example.json`, it has `"disabled": true`, or its JSON is invalid (the log
  says so).

## Times are shifted by one or two hours

The source writes times with a wrong or missing time zone. Compare the raw
value with the website:

- for `rss`, `json` and `html`, adjust `format`: a layout with an offset
  (`Z07:00`) uses it, a layout without one reads the time as the instance's
  local time ([Times](?page=field-mapping#times));
- check `timezone` in `instance.json`;
- for `ical`, check whether the export has `TZID` or `X-WR-TIMEZONE`.

## The same event appears twice

Two sources deliver it with different titles or start times, so they are
not merged ([Merging](?page=sources#the-same-event-from-several-sources)).
Options: drop it from one source with `exclude`, or fix the title in the
source. Events within one source are never merged.

## A category shows the fallback icon

The category is not in `categories.json`. The log warns about it. Map it
with `categoryMap` in the source, or add it to `categories.json`
([Categories](?page=categories#new-categories-appear-on-their-own)).

## An inbox event does not appear

- The log names invalid files: invalid JSON, missing `title`, unreadable
  `date` or `repeat`. Invalid files are not deleted.
- The date is in the past: the file was deleted by the run (see the commit
  "update events data").
- The file name ends in `.example.json`.

## Notes in a source file disappeared

When the status is written back, the file is re-serialised and keys that
openLitfass does not know are removed. Keep notes in a separate file.

## Changes to the front end do not appear

The service worker caches the app. Reload once more, or close and reopen the
installed app. When developing, unregister the service worker and clear the
site data in the browser's developer tools.

## The container cannot write to the instance

Errors like `permission denied` on `data/` or `sources/`: the image runs as
user `65532`. Start it with `--user "$(id -u):$(id -g)"` or change the
owner of the directory ([File permissions](?page=setup#file-permissions)).

## /healthz returns 503

The first build is not online yet. Right after start, `serve` builds from
the existing data within seconds; if it stays at 503, the log shows why the
build fails (for example an invalid `places.json` or `categories.json`).

## The workflow fails

- **Push rejected:** someone pushed in the meantime. The next run resolves
  it; or pull and push again.
- **Image cannot be pulled:** check the tag in `IMAGE`.
- **`fetch` stops with "load category registry":** `categories.json` is
  invalid; the message names the problem.

## Still stuck?

Open an issue in the
[core repository](https://github.com/schreibtischhelden/openlitfass/issues)
with the log lines, the source file (without secrets) and what you expected.
