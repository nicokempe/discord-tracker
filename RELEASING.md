# Releasing

Open **Actions → Release → Run workflow**, choose `main`, and start one run.
As in `DashioDevs/discord-bot`, the workflow handles the whole release:

1. Calculate a Europe/Berlin calendar version, `YYYY.M.N`, and generate
   Conventional Commit notes with the lockfile-pinned Changelogen dependency.
   Update `package.json` and `CHANGELOG.md` together.
2. Check release tooling, application types, tests and compiled output. Build
   AMD64 and ARM64 images locally, scan both with Trivy and generate CycloneDX
   SBOMs. Install the checksum-pinned Cosign binary with bounded retries before
   publishing anything.
3. Push the release commit to `main` and its annotated version tag atomically,
   after checking that `main` has not changed during validation.
4. Publish the scanned platform images and multi-platform manifest to GHCR,
   sign its digest using Cosign/GitHub OIDC, and promote that exact digest to
   `latest` and `main`.
5. Create or update the matching published GitHub Release. Its body is the exact
   version section from the committed changelog; it is marked as the latest
   release only after signing and image promotion succeed.

There is no release-preparation pull request or second invocation to publish the
same version. Ordinary pull requests and pushes to `main` run **Validate**.
This project distributes a GHCR container, not an npm package. Runners use
Node.js 24.22.1 and pnpm 12.15.0.

The first release in a Berlin-local month ends in `.0`; later releases increment
its highest allocated number. Versions have neither a `v` prefix nor zero-padded
months. Do not edit package versions or generated changelog entries manually.
Historical tags and notes are retained. `baseline.json` records `v2025.9.1` as the
history boundary and `2026.5.0` as the original allocation.

## Repository settings

The workflow requires `contents: write`, `packages: write` and `id-token: write`,
which it declares itself. It uses `GITHUB_TOKEN`; no personal token or permission
to create release PRs is needed. The GHCR package must grant this repository's
Actions workflows write access.

`main` must permit the Actions token to push the generated release commit.
Branch protection or rulesets requiring pull requests, status checks on that
new commit, or signed Git commits can reject it with `GH006`. This workflow
validates the generated files before pushing, but those checks do not create
GitHub status checks for the newly generated commit. Container signing also
does not sign the Git commit. Keep these restrictions disabled for `main`, as
configured for this workflow, or provide an explicit supported bypass for the
workflow identity. Changing Actions' default token permissions alone does not
bypass branch protection.

## Images and scan artifacts

Images use `ghcr.io/nicokempe/discord-tracker`:

| Tag | Purpose |
| --- | --- |
| `YYYY.M.N` | Calendar release matching the package version, Git tag and GitHub Release |
| `sha-<12-character release commit>` | Commit-specific multi-platform image |
| `latest` | Most recently promoted signed release |
| `main` | Compatibility alias following signed releases |
| `sha-<commit>-amd64` / `sha-<commit>-arm64` | Scanned platform images referenced by the manifest |

Use an image digest to select exact contents. To pull the latest release:

```bash
docker pull ghcr.io/nicokempe/discord-tracker:latest
```

Trivy reports and SBOMs for both platforms are retained as workflow artifacts
for 90 days. As in the reference bot workflow, vulnerability findings are
reported without failing publication; scanner errors do fail it.

## Retries and incomplete releases

Concurrent manual runs are serialized. If `main` changes while validation is
running, publication stops before pushing a new release commit or tag.

If the current package version already has a reachable Git tag but no published
GitHub Release, the next run automatically resumes that release, even if `main`
has advanced. It uses the original tagged source, package version and committed
notes. This recovers the incomplete `2026.10.0` publication after the workflow
fix is merged, without allocating `2026.10.1` or retagging `2026.10.0`.

When the versioned GHCR manifest already exists, the workflow reuses its digest,
verifies both platform images' source, version and commit labels, and scans those
same images. It completes signing, alias promotion and GitHub Release creation
without rebuilding or replacing the published version. Registry connection or
permission errors stop the run rather than being treated as an absent image.
If no versioned image was pushed, it builds and scans the original tagged source.

Once the latest release is complete, a run with new commits on `main` prepares
the next version normally. A rerun while `main` is still at the existing release
tag refreshes its publication and notes without allocating another version.

After changing the workflow itself, start a **new** run from `main`. GitHub's
**Re-run jobs** on an older run keeps that run's old workflow definition.

Run `pnpm run release:check` locally for strict release-script type checking and
policy/integration tests. `pnpm run release:prepare --github-output <path>
--notes-file <path>` prepares local files without committing, tagging or
publishing them. The optional `--resume-version YYYY.M.N` reads the latest
reachable release's notes and source SHA from its tag without changing files.
