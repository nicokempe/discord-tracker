#!/usr/bin/env bash
set -euo pipefail

# The workflow pins both values; keeping them explicit also permits offline tests.
: "${COSIGN_VERSION:?COSIGN_VERSION is required}"
: "${COSIGN_SHA256:?COSIGN_SHA256 is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_PATH:?GITHUB_PATH is required}"
[[ "$COSIGN_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ "$COSIGN_SHA256" =~ ^[0-9a-f]{64}$ ]]

install_directory="$(mktemp -d "${RUNNER_TEMP}/cosign.XXXXXX")"
binary_path="${install_directory}/cosign"
curl --fail --silent --show-error --location \
  --retry 5 --retry-all-errors --retry-delay 2 --retry-max-time 300 \
  --connect-timeout 15 --max-time 180 \
  "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
  --output "$binary_path"
printf '%s  %s\n' "$COSIGN_SHA256" "$binary_path" | sha256sum --check --status
chmod 0755 "$binary_path"
"$binary_path" version
printf '%s\n' "$install_directory" >> "$GITHUB_PATH"
