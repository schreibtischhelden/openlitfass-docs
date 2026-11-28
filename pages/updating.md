# Updating

An instance contains no code, so updating openLitfass means using a newer
container image. The instance directory stays as it is, unless the release
notes say otherwise.

## Choosing an image tag

The image tag decides how closely an instance follows the core:

| Tag | Gets | For |
|---|---|---|
| `:latest` | every commit on `main` | trying new features early |
| `:0.4` | every patch release of 0.4 | most instances (recommended) |
| `:0.4.0` | exactly this release | fully reproducible runs |
| `:sha-<commit>` | exactly one build of `main` | pinning an unreleased state |

Set the tag in `IMAGE` in `update-events.yml`, or in the `docker run` command
or Compose file.

## Updating to a new release

1. Read the release notes of every version between yours and the new one:
   [releases](https://github.com/schreibtischhelden/openlitfass/releases).
   Changes that require action in an instance are listed under *Breaking
   changes*.
2. Make those changes in the instance, if any.
3. Change the image tag, for example from `:0.3` to `:0.4`.
4. GitHub Actions: commit and push; the next run uses the new image. Run the
   workflow by hand to check right away. Container: pull and restart:

   ```sh
   docker pull ghcr.io/schreibtischhelden/openlitfass:0.4
   docker stop my-calendar && docker rm my-calendar
   docker run -d --name my-calendar … ghcr.io/schreibtischhelden/openlitfass:0.4
   ```

   With Compose: `docker compose pull && docker compose up -d`.
5. Check `data/events.json`, the source status and the site.

The version in use is reported by the metric `openlitfass_info{version}`.

## What versions mean

openLitfass uses [Semantic Versioning](https://semver.org/):

- **Major** (`2.0.0`): an instance has to change something, for example a
  renamed field in `instance.json` or a changed event schema.
- **Minor** (`0.5.0`): new features that existing instances can ignore.
- **Patch** (`0.4.1`): fixes only.

Before `1.0.0`, a minor version may also contain breaking changes; they are
always listed under *Breaking changes* in the release notes.

## Visitors after an update

The service worker of the front end is stamped with a new build ID on every
build, so browsers pick up a new front end on their next visit. Visitors
with the installed app may need to close and reopen it once.

## Security fixes

Security fixes go into `main` and the next release. Instances on `:latest`
receive them with the next run; instances on a pinned tag should move to the
newest release. See the
[security policy](https://github.com/schreibtischhelden/openlitfass/security/policy).
