# Monitoring

openLitfass reports the state of an instance in three places: the
`status` field of every source file, the `/healthz` endpoint and Prometheus
metrics at `/metrics`. The last two are provided by `serve`, that is, when
the instance runs as a container.

## Source status

Whether a source still works is written into its own file after every
attempt (`lastAttempt`, `lastSuccess`, `lastError`); see
[Health status](?page=sources#health-status). With the GitHub Actions
workflow, the status is committed together with the data, so the history of
a source is in Git:

```sh
git log -p -- sources/brotfabrik.json
```

A quick overview of all sources that failed on their last attempt:

```sh
grep -l '"lastError"' sources/*.json
```

## Health endpoint

`GET /healthz` returns the state of `serve` as JSON:

```json
{
  "instance": "weissens.ee",
  "serving": true,
  "lastFetch": "2026-11-23T20:37:46Z",
  "lastFetchOk": true,
  "events": 412,
  "failedSources": ["kiezkalender"],
  "lastBuild": "2026-11-23T20:37:47Z",
  "nextFetch": "2026-11-24T02:37:46Z"
}
```

| Field | Meaning |
|---|---|
| `serving` | a build is online |
| `lastFetch`, `nextFetch` | time of the last and the next fetch run |
| `lastFetchOk` | the last fetch run succeeded |
| `lastError` | error of the last run, if any |
| `events` | number of published events |
| `failedSources` | sources whose last attempt failed |
| `lastBuild` | time of the last successful build |

It answers `503 Service Unavailable` until the first build is online, then
`200`. The image's `HEALTHCHECK` uses it, so `docker ps` shows whether the
container is healthy. A failing source does not make the instance unhealthy;
it is listed in `failedSources`.

## Prometheus metrics

`/metrics` serves metrics in the Prometheus text format. Serve them on a
separate port that is not public:

```sh
docker run -d … -p 8080:8080 -p 127.0.0.1:9090:9090 -e OL_METRICS_ADDR=:9090 ghcr.io/schreibtischhelden/openlitfass:0.4
```

Without `OL_METRICS_ADDR`, `/metrics` is served on the main port next to the
public site.

| Metric | Type | Meaning |
|---|---|---|
| `openlitfass_info{version,instance}` | gauge | always 1; carries the version and the instance name |
| `openlitfass_up` | gauge | 1 = the site is being served |
| `openlitfass_fetch_interval_seconds` | gauge | configured fetch interval |
| `openlitfass_last_fetch_timestamp_seconds` | gauge | last fetch (Unix time) |
| `openlitfass_next_fetch_timestamp_seconds` | gauge | next fetch (Unix time) |
| `openlitfass_last_build_timestamp_seconds` | gauge | last build (Unix time) |
| `openlitfass_fetch_runs_total{result}` | counter | fetch runs: `ok`, `partial` (some sources failed), `failed`, `nothing`, `error` |
| `openlitfass_builds_total{result}` | counter | builds: `ok`, `failed` |
| `openlitfass_http_requests_total{code}` | counter | requests by status class (`2xx`, `4xx`, …) |
| `openlitfass_fetch_duration_seconds` | gauge | duration of the last fetch run |
| `openlitfass_source_up{source}` | gauge | 1 = the source's last attempt succeeded |
| `openlitfass_source_last_success_timestamp_seconds{source}` | gauge | last success of the source |
| `openlitfass_source_fetch_duration_seconds{source}` | gauge | duration of the source's last fetch |
| `openlitfass_source_fetched_events{source}` | gauge | events from the source in the last run, before merging |
| `openlitfass_source_carried_events{source}` | gauge | events kept from the previous run because the source failed |
| `openlitfass_events` | gauge | published events |
| `openlitfass_events_cancelled` | gauge | published cancelled events |
| `openlitfass_events_merged` | gauge | events merged from several sources |
| `openlitfass_events_by_source{source}` | gauge | published events per source |
| `openlitfass_events_by_category{category}` | gauge | published events per category |

The per-source metrics are taken from the `status` fields, so they are also
correct when a CI workflow does the fetching and `serve` only serves
(`OL_FETCH_INTERVAL=0`).

### Scrape configuration

```yaml
scrape_configs:
  - job_name: openlitfass
    static_configs:
      - targets: ["calendar-host:9090"]
```

### Example alerts

```yaml
groups:
  - name: openlitfass
    rules:
      - alert: OpenLitfassSourceDown
        expr: time() - openlitfass_source_last_success_timestamp_seconds > 86400
        labels: { severity: warning }
        annotations: { summary: "Source {{ $labels.source }} has not succeeded for more than a day" }
      - alert: OpenLitfassNoFetch
        expr: time() - openlitfass_last_fetch_timestamp_seconds > 2 * openlitfass_fetch_interval_seconds and openlitfass_fetch_interval_seconds > 0
        labels: { severity: warning }
        annotations: { summary: "{{ $labels.instance }}: no fetch for two intervals" }
      - alert: OpenLitfassDown
        expr: openlitfass_up == 0
        for: 5m
        labels: { severity: critical }
```

## Logs

All commands log to standard output and standard error: every source with
its number of events or its error, skipped files, unknown categories,
unresolved place references. With Docker:

```sh
docker logs --since 6h my-calendar
```

With GitHub Actions, the log of each run is in the *Actions* tab.
