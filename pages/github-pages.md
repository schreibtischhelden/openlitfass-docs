# Publishing on GitHub Pages

An instance that runs with GitHub Actions can publish its site to GitHub
Pages: free hosting with HTTPS and a custom domain, no server of your own.
weissens.ee works this way; the openLitfass website and this documentation
too.

The pattern: the workflow writes the finished site into a branch `pages`,
as a single commit that replaces the previous one, so the repository does not
collect a history of generated files. GitHub Pages serves that branch.

## 1. Extend the workflow

Add a variable for the domain and a step after "Commit and push if changed"
in `.github/workflows/update-events.yml`:

```yaml
env:
  IMAGE: ghcr.io/schreibtischhelden/openlitfass:0.4
  PAGES_DOMAIN: calendar.example.org   # written as CNAME

# … steps "Fetch events", "Build site", "Commit and push if changed" …

      - name: Publish to branch pages
        run: |
          cd public
          rm -f .openlitfass-build
          touch .nojekyll
          echo "$PAGES_DOMAIN" > CNAME
          git init -q -b pages
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -q -m "Site build ${GITHUB_SHA::7}"
          git push -q --force "https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${GITHUB_REPOSITORY}.git" pages
```

- `.nojekyll` stops GitHub from running Jekyll over the site.
- `CNAME` contains the custom domain. Without a custom domain, leave out the
  `echo` line; the site is then served at
  `https://<owner>.github.io/<repository>/`. Set `baseUrl` in
  `instance.json` to the address the site is served at.
- The workflow needs `permissions: contents: write`, which the template
  already has.

Run the workflow once; it creates the `pages` branch.

## 2. DNS

For an apex domain (`example.org`), create these records at your DNS
provider:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<owner>.github.io.` |

For a subdomain (`calendar.example.org`), a single record is enough:

| Type | Name | Value |
|---|---|---|
| CNAME | `calendar` | `<owner>.github.io.` |

`<owner>` is the user or organisation that owns the repository; the
repository name does **not** belong in the record. Delete parking records of
the registrar for the same names first, and do not create wildcard records
(`*`).

## 3. Verify the domain (recommended)

In the owner's settings (*Settings → Pages → Add a domain*), GitHub provides
a TXT record:

| Type | Name | Value |
|---|---|---|
| TXT | `_github-pages-challenge-<owner>` | value provided by GitHub |

Once verified, nobody else can use the domain for their own Pages site.

## 4. Enable Pages

In the repository: *Settings → Pages*:

1. Source: *Deploy from a branch*, branch `pages`, folder `/ (root)`.
2. The custom domain is taken from the `CNAME` file.
3. Tick *Enforce HTTPS* once GitHub has issued the certificate, usually after
   a few minutes, occasionally up to 24 hours.

## Checking

```sh
dig +short example.org A
dig +short www.example.org CNAME
```

Expected: the four `185.199.10x.153` addresses, and `<owner>.github.io.`.

## Updates

The site is rebuilt and published on every run of the workflow: every six
hours, by hand, and on pushes that change content. A change to the image
(a new openLitfass version) arrives with the next run.
