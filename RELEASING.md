# Releasing

Releases are manual and respect the pull-request requirement on `main`.
Open **Actions → Release → Run workflow**, choose `main`, and start a new run:

1. **Prepare:** the workflow calculates a Europe/Berlin calendar version,
   `YYYY.M.N`, generates Conventional Commit release notes with the lockfile-pinned
   Changelogen dependency, and validates release tooling, application types,
   tests and compiled output. It pushes only a managed `release/<version>` branch
   and opens or updates a pull request for `package.json`, `CHANGELOG.md` and
   `scripts/release/pending.json`. Nothing is tagged or published in this phase.
2. **Review:** approve workflow runs if GitHub requests approval, let the PR
   checks pass, then review and merge the release PR using the normal branch
   rules. Merge, squash and rebase merges are supported.
3. **Publish:** start a new **Release** run on `main`. It recognizes the merged
   preparation, builds and scans AMD64 and ARM64 images, and generates CycloneDX
   SBOMs. Only after these succeed does it push an annotated version tag on the
   reviewed `main` commit. It publishes the exact scanned images, signs the
   combined manifest digest with Cosign/GitHub OIDC, promotes it to `latest` and
   `main`, and creates or updates the matching GitHub Release.

The workflow never pushes a release commit to `main` or bypasses branch
protection. Pull requests and ordinary pushes to `main` run **Validate** without
publishing packages. This project distributes a GHCR container, not an npm
package. Runners use Node.js 24.22.1 and pnpm 12.15.0.

If code changes after release preparation, the next run refreshes the notes in
another release PR using the same unpublished version. Merge that refresh before
publishing. The pending metadata records the source commit represented by the
notes; changes outside the three release files require another review.
Managed `release/<version>` branches are updated with a Git lease when retried;
make application changes through ordinary PRs rather than editing those branches.

The first release in a Berlin-local month ends in `.0`; later releases increment
its highest allocated number. Versions have neither a `v` prefix nor zero-padded
months. Do not edit package versions or generated changelog entries manually.
Existing legacy tags and changelog sections are retained. `baseline.json` records
`v2025.9.1` as the history boundary and `2026.5.0` as the existing allocation.

Images use `ghcr.io/nicokempe/discord-tracker`:

| Tag | Purpose |
| --- | --- |
| `YYYY.M.N` | Calendar release matching the package version, Git tag and GitHub Release |
| `sha-<12-character main commit>` | Commit-specific multi-platform image |
| `latest` | Most recently promoted signed release |
| `main` | Compatibility alias following signed releases |
| `sha-<commit>-amd64` / `sha-<commit>-arm64` | Scanned platform images referenced by the manifest |

Use an image digest to select exact image contents. To pull the latest release:

```bash
docker pull ghcr.io/nicokempe/discord-tracker:latest
```

Trivy reports and SBOMs for both platforms are retained as workflow artifacts
for 90 days. As in the reference `DashioDevs/discord-bot` workflow, vulnerability
findings are reported without failing publication; scanner errors do fail it.

Preparation requires `contents: write` and `pull-requests: write`. Publishing
requires `contents: write`, `packages: write` and `id-token: write`. No
`GHCR_PAT` secret or branch-protection exception is required. The existing GHCR
package must grant this repository's Actions workflows write access.

For automatic release PR creation, enable **Settings → Actions → General →
Workflow permissions → Allow GitHub Actions to create and approve pull
requests**. The workflow does not approve PRs. If GitHub denies PR creation, the
job summary instead links to the prepared branch so you can open its PR manually;
publication remains paused. Bot-created PR workflows may require **Approve
workflows to run** before their checks start.

Failed publication runs can be rerun while the version tag remains at the tip of
`main`; they reuse the version and committed notes. Concurrent manual runs are
serialized. If `main` changes while images are building, publication stops before
pushing a new tag. Start a new run to refresh its release preparation.

After changing the workflow itself, start a **new** workflow run. Re-running an
older failed run uses that run's old workflow definition, including its original
publishing behavior.

Run `pnpm run release:check` locally for strict release-script type checking and
policy/integration tests, including a remote that rejects direct pushes to
`main`. `pnpm run release:prepare --github-output <path> --notes-file <path>`
prepares local files without committing, tagging or publishing them.
