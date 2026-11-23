# Development

This page is for people who work on the core:
[schreibtischhelden/openlitfass](https://github.com/schreibtischhelden/openlitfass).

## Repository layout

```
openlitfass/
  backend/
    cmd/fetch/            entry point: fetch sources, write JSON
    cmd/build-site/       entry point: assemble the static site
    cmd/serve/            entry point: fetch, build and serve in a loop
    internal/app/         shared logic of the commands (environment, serve, metrics, static pages)
    internal/instance/    loads <instance>/instance.json, knows the paths
    internal/model/       event schema, instance time zone (model.Local)
    internal/config/      loads <instance>/sources/*.json, writes the status back
    internal/mapping/     dot paths and the field-mapping engine
    internal/htmlsel/     small CSS selector engine for html sources
    internal/sources/     Source interface, RSS/JSON/iCal/HTML/wcs fetchers, inbox,
                          timeouts, panic recovery, filters
    internal/categories/  category registry and icons
    internal/places/      places.json
    internal/writer/      validation, merging, sorting, stable IDs, JSON output
  web/                    front end: index.html, js/, css/, templates/, sw.js
  example-instance/       template instance, also used by the CI smoke test
  pages/                  project website openlitfass.org
  scripts/check.sh        all checks, as run by CI
  Containerfile
```

The front end is plain JavaScript, HTML and CSS with no framework, no npm
and no build step. The back end depends only on the Go standard library and
`golang.org/x/net`. New dependencies need a good reason.

## Running locally

With Go installed:

```sh
cd backend
go run ./cmd/fetch ../example-instance
go run ./cmd/build-site -web ../web ../example-instance      # → example-instance/public/
go run ./cmd/serve -web ../web -interval 0 ../example-instance   # → http://localhost:8080
```

Without Go, with Docker or Podman only (build context: repository root):

```sh
docker build -t openlitfass -f Containerfile .
docker run --rm -v "$PWD/example-instance:/instance" -p 8080:8080 -e OL_FETCH_INTERVAL=0 openlitfass
```

`fetch` changes the instance directory (status fields, deleted inbox
files). Check `git status` of the instance before committing, and leave such
changes out unless they are wanted. Against the example instance, `fetch`
writes nothing, because it has only templates.

To try changes against a real instance, mount it instead of
`example-instance`, for example a clone of
[weissens.ee](https://github.com/weissensee/weissens.ee).

> **Note:** after changing front-end files, the service worker may keep
> serving the old `app.js`. Unregister it and clear the site data in the
> browser's developer tools, then reload.

## Checks before pushing

`scripts/check.sh` runs every check in Docker (no local Go needed) and is
exactly what CI runs: a green local run means a green CI run. It works from
any directory, in Git Bash on Windows as well.

```sh
scripts/check.sh              # everything, in this order:
scripts/check.sh fmt          # gofmt
scripts/check.sh vet          # go vet
scripts/check.sh lint         # golangci-lint, configured in .golangci.yml
scripts/check.sh test         # go test -race
scripts/check.sh smoke        # build-site against example-instance/
scripts/check.sh vuln         # govulncheck

scripts/check.sh workflows    # actionlint and zizmor on all workflows
scripts/check.sh image        # build the image, Trivy scan of it and of the Containerfile
```

`workflows` and `image` are not part of the default run. The Go version
follows `backend/go.mod`; the other tool versions are pinned at the top of
the script.

`.golangci.yml` enables, besides the standard linters, `gosec`, `bodyclose`,
`noctx`, `errorlint`, `revive`, `unconvert`, `gocritic`, `perfsprint` and
`prealloc`. An intentional finding is silenced on its line with
`//nolint:<linter> // <reason>`; the reason is required.

Run the fast checks before every push:

```sh
printf '#!/bin/sh\nexec scripts/check.sh fmt vet lint test\n' > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Tests

Go tests live next to the code (`*_test.go`); fixtures such as a real `.ics`
export or a saved HTML page go into `testdata/`. Write tests in the
arrange, act, assert pattern and cover new behaviour, including the error
paths. There are no automated front-end tests; check front-end changes in
the browser.

### Verified against real sources

Beyond the automated checks, the source types have been verified against
real data:

- `json`: Brotfabrik (WordPress "The Events Calendar", four pages, 192 events
  in 30 days), with pagination, a template address, `categoryMap` and HTML
  cleaning.
- `ical`: an Events Manager export (Freilichtbühne Weißensee), kept as a test
  fixture, plus tests for time zones, all-day events, `RRULE`, `EXDATE` and
  `RECURRENCE-ID`.
- `wcs`: Familienzentrum Weißensee, 95 events, with status field and
  `sources.json`; an inbox event included in the same run.
- `rss`: KuBiZ Raoul Wallenberg in weissens.ee.
- `html`: a fixture modelled on a Joomla JEvents list: selector engine,
  German month names, all-day events, cancellation markers in titles.
- `build-site` against the example instance and weissens.ee: complete site
  including manifest, `site.json` and stamped service worker.

## Benchmarks

Benchmarks cover the expensive paths: HTML extraction, iCalendar parsing of
a real export and of recurring series, and building a site with 500 events.

```sh
scripts/check.sh bench                         # against origin/main
BENCH_BASE=v0.4.0 scripts/check.sh bench       # against any ref
BENCH_COUNT=20 BENCH_THRESHOLD=10 scripts/check.sh bench
```

It runs every benchmark several times on the base and the working tree,
prints the `benchstat` comparison and warns about time regressions above the
threshold (default 15 %). It never fails; timings on shared machines vary.
Results stay in `.bench/`. On a pull request, the label `benchmark` runs the
same comparison in CI.

## A source with custom Go code

For formats that no source type covers (logins, POST requests,
authentication):

1. Copy `internal/sources/example.go` as a template.
2. Implement the `Source` interface: `Name()` and
   `Fetch(ctx) ([]model.Event, error)`.
3. Register it at the end of `All()` in `internal/sources/source.go` with
   `append(all, harden(withCommonFilters(...)))`, so it gets the same
   timeout, panic recovery, filters and status tracking as the built-in
   types.
4. Use `model.LocalParts(t)` for times, and always set `Price` explicitly:
   the zero value would show as "null €".

Prefer extending a generic type (a new mapping option, a selector feature)
over a source for a single website: the core contains no location-specific
code.

## Continuous integration

| Workflow | Runs | Does |
|---|---|---|
| `ci.yml` | every push and pull request | `scripts/check.sh` |
| `security.yml` | pull requests touching code, image or workflows; weekly | actionlint, zizmor, Trivy, govulncheck |
| `codeql.yml` | pushes to `main`, pull requests, weekly | CodeQL for Go, JavaScript and workflows |
| `scorecard.yml` | weekly | OpenSSF Scorecard |
| `bench.yml` | pull requests with the label `benchmark` | benchmark comparison |
| `image.yml` | pushes to `main` that change code; `v*` tags | Trivy gate, then multi-arch image to ghcr.io |
| `release.yml` | `v*` tags | GitHub release ([Releases](?page=releases)) |
| `pages.yml` | pushes to `main` that change `pages/` | project website |

- Every workflow grants the `GITHUB_TOKEN` only `contents: read`; write
  permissions are set on the single job that needs them.
- Every action is pinned to a commit SHA with its version as a comment.
  Dependabot proposes updates weekly for Go modules, base images and
  actions, after a seven-day cooldown.

### Container image

`image.yml` builds `linux/amd64` and `linux/arm64` and pushes to
`ghcr.io/schreibtischhelden/openlitfass`:

| Tag | When |
|---|---|
| `latest` | every build of `main` |
| `sha-<short>` | every build |
| `1.2.3`, `1.2` | Git tag `v1.2.3` |

The Go stage cross-compiles on the build machine's architecture, which is
much faster than emulation. The runtime image is Alpine with `git` and
`nodejs` (for CI use), runs as `65532:65532` and has a `HEALTHCHECK`.

## Contributing

1. Open an issue first, or comment on an existing one.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Commit messages and pull-request titles follow
   [Conventional Commits](https://www.conventionalcommits.org/):
   `type(scope): description`, for example
   `fix(web): keep the date bar on today after midnight`. Common scopes:
   `sources`, `inbox`, `places`, `categories`, `config`, `backend`, `web`,
   `pages`, `image`, `example`, `ci`, `deps`.
4. Run `scripts/check.sh`.
5. Open a pull request with `Closes #<issue>` and a label (`bug`,
   `enhancement`, `documentation`, `breaking`); the label decides the section
   in the release notes.

Documentation, comments, commits and issues are written in British English;
the interface texts stay German.

## The project website

`pages/` contains the website [openlitfass.org](https://openlitfass.org), a
single static page. `pages.yml` copies it (plus `web/logo.svg`) into the
branch `pages` on every push to `main` that changes it; GitHub Pages serves
that branch with the custom domain from `PAGES_DOMAIN`. DNS works as
described in [Publishing on GitHub Pages](?page=github-pages#2-dns).

## This documentation

The documentation lives in
[schreibtischhelden/openlitfass-docs](https://github.com/schreibtischhelden/openlitfass-docs):
Markdown files in `site/`, rendered in the browser by
[markdown-pages.js](https://github.com/schreibtischhelden/markdown-pages.js).
On every push to `main`, a workflow copies `site/` into a checkout of
markdown-pages.js and publishes the result to the branch `pages`.

- A page is `site/pages/<name>.md`, reachable as `?page=<name>`; the
  navigation is `site/header.md`. Links between pages use `?page=<name>#<heading-id>`.
- `scripts/preview.sh` builds the same site locally and serves it at
  <http://localhost:8000> (Docker).
- Update the documentation in the same pull request cycle as the feature:
  open a pull request in openlitfass-docs alongside the one in the core.
