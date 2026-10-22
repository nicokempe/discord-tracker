# Changelog


## 2026.10.1

[compare changes](https://github.com/nicokempe/discord-tracker/compare/2026.10.0...2026.10.1)

### 🩹 Fixes

- **release:** Restore single-run publishing and recover incomplete releases ([6982da7](https://github.com/nicokempe/discord-tracker/commit/6982da7))
- **release:** Restore single-run publishing and recover incomplete releases ([#256](https://github.com/nicokempe/discord-tracker/pull/256))
- Preserve Node process signal handlers at startup ([a3f0c36](https://github.com/nicokempe/discord-tracker/commit/a3f0c36))
- Preserve Node process signal handlers at startup ([#257](https://github.com/nicokempe/discord-tracker/pull/257))

## 2026.10.0

[compare changes](https://github.com/nicokempe/discord-tracker/compare/514fc7247860ef08a66960aa0bb32376320d319e...2026.10.0)

### 🚀 Enhancements

- **health:** Add Discord readiness checks and refresh dependencies ([ffa3bb5](https://github.com/nicokempe/discord-tracker/commit/ffa3bb5))
- **health:** Add gateway readiness checks and refresh dependencies ([#252](https://github.com/nicokempe/discord-tracker/pull/252))

### 🩹 Fixes

- **health:** Inspect every Discord shard during reconnects ([bed9f6c](https://github.com/nicokempe/discord-tracker/commit/bed9f6c))
- **release:** Prepare releases through protected-branch pull requests ([5166dc1](https://github.com/nicokempe/discord-tracker/commit/5166dc1))
- **release:** Respect protected main through release pull requests ([#254](https://github.com/nicokempe/discord-tracker/pull/254))

### 📖 Documentation

- **readme:** Replace banner with new design ([404c100](https://github.com/nicokempe/discord-tracker/commit/404c100))

### 🏡 Chore

- **actions:** Bump actions/setup-node from 4 to 5 ([f51e6dc](https://github.com/nicokempe/discord-tracker/commit/f51e6dc))
- **release:** V2025.8.2 ([c58424c](https://github.com/nicokempe/discord-tracker/commit/c58424c))
- **actions:** Bump actions/setup-node from 4 to 5 ([#209](https://github.com/nicokempe/discord-tracker/pull/209))
- **pnpm:** Update dependencies and bump version to v2026.5.0 ([33d4312](https://github.com/nicokempe/discord-tracker/commit/33d4312))
- **ci, docker:** Update actions, CodeQL, and Docker Node base images to latest versions ([66b2434](https://github.com/nicokempe/discord-tracker/commit/66b2434))
- **ci:** Update Node.js setup action to v6.4.0 in CodeQL workflow ([18a7107](https://github.com/nicokempe/discord-tracker/commit/18a7107))

### 🤖 CI

- **release:** Automate calendar releases and signed containers ([9ea9fc2](https://github.com/nicokempe/discord-tracker/commit/9ea9fc2))
- **release:** Automate calendar releases and signed containers ([#253](https://github.com/nicokempe/discord-tracker/pull/253))

## v2025.8.2

[compare changes](https://undefined/undefined/compare/v2025.08.2...v2025.8.2)

### 🚀 Enhancements

- **bot:** Add channel and user id validation (aa2a8c2)

### 🩹 Fixes

- **docker:** Update config directory initialization (3ab1818)

### 💅 Refactors

- **presence:** Clarify variable names and add tsdocs (8060f64)
- Clarify variable names and add tsdocs (#211)
- **events:** Replace deprecated ready event with clientReady handler (1cad025)

### 📖 Documentation

- **readme:** Add config directory hint to the readme (5169b28)
- **pr:** Add pr template (e01cab3)

### 🏡 Chore

- **actions:** Bump docker/build-push-action from 5.0.0 to 6.18.0 (1207a91)
- **actions:** Bump docker/setup-buildx-action from 3.0.0 to 3.11.1 (2386840)
- **actions:** Bump sigstore/cosign-installer from 3.5.0 to 3.9.2 (bcdd218)
- **actions:** Bump docker/metadata-action from 5.0.0 to 5.8.0 (ff312b5)
- **config:** Remove config from bot (ec5f5dd)
- **git:** Ignore config/users.json (2b77778)
- **pnpm:** Bump @types/node from 24.2.0 to 24.2.1 (0f06dc8)
- **pnpm:** Bump @types/node from 24.2.0 to 24.2.1 (#202)
- **actions:** Bump docker/setup-buildx-action from 3.0.0 to 3.11.1 (#193)
- **actions:** Bump docker/metadata-action from 5.0.0 to 5.8.0 (#199)
- **actions:** Bump sigstore/cosign-installer from 3.5.0 to 3.9.2 (#194)
- **actions:** Bump docker/build-push-action from 5.0.0 to 6.18.0 (#192)
- **actions:** Bump actions/checkout from 4 to 5 (01dbff1)
- **pnpm:** Bump @types/node from 24.2.1 to 24.3.0 (a37965c)
- **pnpm:** Bump @types/node from 24.2.1 to 24.3.0 (#204)
- **actions:** Bump actions/checkout from 4 to 5 (#203)
- **pnpm:** Update packages (c18c7a4)

### 🤖 CI

- **dependabot:** Add unified update labels for updates (a705f94)

### ❤️ Contributors

- Nico Kempe ([@nicokempe](https://github.com/nicokempe))

## v2025.08.2

[compare changes](https://undefined/undefined/compare/v2024.9.1...v2025.08.2)

### 💅 Refactors

- Remove commands and add missing packages (c00a16b)
- **fanclub:** ⚠️  Rebrand isFanClub to broadcast (7a8c3ce)

### 📖 Documentation

- **readme:** Update users.json documentation and fix Git link (b2d3232)
- **env:** Update .env.example content (65043e8)
- **readme:** Remove deprecated env variable (9369d35)
- **readme:** Update functionality descriptions based on recent changes (360f6ec)

### 🌊 Types

- **bot:** Add explicit type annotations (0b72a4e)

### 🏡 Chore

- **pnpm:** Update packages (3e2a3e3)
- **pnpm:** Update packages (59611c9)
- **pnpm:** Update version and fix the main entry point (b474987)
- **package:** Prepare package.json for changelogen (ef510c6)
- **dx:** Add .editorconfig (4097b0c)

### 🤖 CI

- **dependabot:** Update configuration (3592557)
- **codeql:** Bump nodejs from 22 to 24 and actions/setup-node from 3 to 4 (6f32c38)
- **package:** Install changelogen for release process (401cd2a)

#### ⚠️ Breaking Changes

- **fanclub:** ⚠️  Rebrand isFanClub to broadcast (7a8c3ce)

### ❤️ Contributors

- Nico Kempe ([@nicokempe](https://github.com/nicokempe))

