# Releasing

Releases are manual, matching the calendar release process used by
`DashioDevs/discord-bot`. Open **Actions → Release → Run workflow**, choose `main`,
and start the run. Pull requests and pushes to `main` run **Validate** without
publishing packages. This project distributes a container on GHCR; it does not
publish an npm package.

The release workflow uses GitHub-hosted Ubuntu runners, Node.js 24.22.1 and
pnpm 12.15.0. It:

1. Checks out the latest `main` with all tags and Git history.
2. Calculates a Europe/Berlin calendar version, `YYYY.M.N`. The first release in
   a month ends in `.0`; later releases increment the highest allocated number.
   Versions have neither a `v` prefix nor zero-padded months.
3. Generates a Conventional Commit changelog using the lockfile-pinned
   Changelogen dependency, updates `package.json`, and validates release tooling,
   application types, tests and compiled output.
4. Creates a local release commit and annotated tag. Both AMD64 and ARM64 images
   receive that commit's revision label. Trivy scans both images and generates
   CycloneDX SBOMs before anything is published. Reports and SBOMs are retained
   as workflow artifacts for 90 days. As in the reference workflow, vulnerability
   findings are reported without failing the release; scanner errors do fail it.
5. Rejects changes to `main` during validation, then atomically pushes the
   release commit and tag. It pushes the exact images that were scanned and
   combines them into a multi-platform manifest.
6. Signs the manifest digest using Cosign and GitHub OIDC, then promotes that
   signed manifest to `latest` and `main`. It creates or updates a GitHub Release
   whose notes match the new changelog section.

Published images use `ghcr.io/nicokempe/discord-tracker`:

| Tag | Purpose |
| --- | --- |
| `YYYY.M.N` | One calendar release, matching `package.json` and the Git tag |
| `sha-<12-character release commit>` | Commit-specific multi-platform image |
| `latest` | Most recently completed, signed release |
| `main` | Compatibility alias for existing deployments; follows completed releases |
| `sha-<commit>-amd64` / `sha-<commit>-arm64` | Scanned platform images used by the manifest |

Use the image digest when a deployment must select exact image contents. To pull
the latest completed release:

```bash
docker pull ghcr.io/nicokempe/discord-tracker:latest
```

Do not edit package versions or automated changelog entries manually. Existing
`v`-prefixed tags remain intact. `scripts/release/baseline.json` records the
last legacy tag (`v2025.9.1`) as the changelog boundary and `2026.5.0` as the
existing package allocation, so the first automated release includes subsequent
unreleased work without repeating older release notes.

Failed runs can be rerun while the release tag remains at the tip of `main`:
the preparer resumes that version and reuses its changelog. Before the commit/tag
push, failures leave remote refs unchanged. After that push, retries resume
publishing the same version. If new commits have since landed on `main`, the
workflow prepares the next version instead. Concurrent releases are serialized.

The workflow uses `GITHUB_TOKEN` with `contents: write` and `packages: write`, plus
`id-token: write` for signing. No `GHCR_PAT` secret is required. The existing GHCR
package must be linked to this repository and allow its Actions workflows write
access; otherwise grant that access in the package settings. Branch rules must
also permit the workflow's release commit and annotated tag.

Run `pnpm run release:check` locally to type-check release scripts and exercise
calendar versions, real changelog generation, legacy-tag migration and retries
in temporary Git repositories. `pnpm run release:prepare --github-output <path>
--notes-file <path>` prepares local files without pushing or publishing; the
manual workflow handles commits, tags, containers and GitHub Releases.
