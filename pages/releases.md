# Releases

openLitfass is released in versions. A version is a Git tag; the tag, the
milestone, the GitHub release and the container image all carry the same
number.

```
GitHub Project "openLitfass roadmap"   (board + roadmap view, grouped by milestone)
  └─ issues ──► milestone v0.5.0 ──► git tag v0.5.0 ──► release.yml: GitHub release, milestone closed
                                                   └──► image.yml:   ghcr.io/…/openlitfass:0.5.0, :0.5
```

- Release notes: [GitHub releases](https://github.com/schreibtischhelden/openlitfass/releases)
- Roadmap: [openLitfass roadmap](https://github.com/orgs/schreibtischhelden/projects/5)

For operators, [Updating](?page=updating) explains the image tags and how to
move to a new version. The rest of this page describes how maintainers
release.

## Versions

[Semantic Versioning](https://semver.org/) with a `v` prefix on tags:
`v0.4.0`, `v1.0.0`.

- **Major:** an instance has to change something.
- **Minor:** new features that existing instances can ignore.
- **Patch:** fixes only.

Before `v1.0.0`, a minor version may also contain breaking changes; they are
listed under *Breaking changes*. Pre-releases use a suffix (`v0.5.0-rc.1`):
they get a GitHub release marked as pre-release, do not close the milestone
and do not move the `:0.5` image tag.

## Roadmap

The GitHub Project *openLitfass roadmap* contains the issues of the core.

| Field | Values | Purpose |
|---|---|---|
| Status | `Ideas`, `Planned`, `In Progress`, `Done` | board columns |
| Milestone | `v0.5.0`, … | which release an item goes into |
| Labels | see below | release-note sections |

New issues start in `Ideas`; an idea becomes a plan with a milestone and the
status `Planned`. Closed issues move to `Done`. Issues of instance
repositories cannot be added (a project only accepts repositories of the same
owner); instance work is tracked in the instance.

## Labels

| Label | Release-note section |
|---|---|
| `breaking` | Breaking changes |
| `enhancement` | New features |
| `bug` | Fixes |
| `documentation` | Documentation |
| `skip-changelog` | left out |

Pull requests without a label end up under "Other changes".

## Release notes

The *Release* workflow assembles the notes from four parts:

1. **Highlights:** the message of the annotated tag, without its first line;
   a few hand-written points for users and operators.
2. **Roadmap items:** the closed issues of the milestone, with their labels.
3. **Pull requests:** GitHub's generated notes, sorted by label
   (`.github/release.yml`), with a full-changelog link.
4. **Commits:** every commit since the previous tag, collapsed.

## Releasing a version

1. Check the milestone: closed issues belong to it; move open ones to the
   next milestone.
2. Make sure `main` is green (*CI* workflow).
3. Write the highlights into a file: the first line is the title, then a
   blank line and the bullet points.

   ```text
   openLitfass v0.5.0

   - Places show their opening hours.
   - Inbox: day lists in `holidays.json`.
   - Fixed: …
   ```

   Put paths and placeholders in backticks; GitHub drops text in angle
   brackets such as `<instance>` as an HTML tag. Do not start a line with
   `#`; Git removes such lines from the tag message.

4. Tag and push:

   ```sh
   git tag -s v0.5.0 -F notes.txt
   git push origin v0.5.0
   ```

5. The *Release* workflow creates the GitHub release and closes the
   milestone; the *Image* workflow publishes `:0.5.0` and `:0.5`.
6. Create the next milestone.

A tag without a matching milestone still gets a release, with a warning and
without roadmap items. A lightweight tag (without `-a` or `-s`) gives a
release without highlights.
