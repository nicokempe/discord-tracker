import { equal, match } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { test, type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const installer = resolve(dirname(fileURLToPath(import.meta.url)), 'install-cosign.sh')

/** Substitutes only the network transfer; real checksum and executable checks still run. */
function install(context: TestContext, validChecksum: boolean, downloadFails = false) {
  const directory = mkdtempSync(resolve(tmpdir(), 'cosign-installer-test-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const binaries = resolve(directory, 'bin')
  mkdirSync(binaries)
  const binary = '#!/bin/sh\nprintf "test cosign version\\n"\n'
  writeFileSync(resolve(directory, 'binary'), binary)
  writeFileSync(resolve(binaries, 'curl'), [
    '#!/usr/bin/env bash', 'set -euo pipefail',
    'printf "%s\\n" "$@" > "$RUNNER_TEMP/curl.arguments"',
    downloadFails ? 'exit 35' : '',
    'while [[ "$1" != --output ]]; do shift; done',
    'cp "$RUNNER_TEMP/binary" "$2"', '',
  ].join('\n'), { mode: 0o755 })
  const pathFile = resolve(directory, 'github.path')
  const result = spawnSync('bash', [installer], {
    env: {
      ...process.env, PATH: `${binaries}:${process.env.PATH ?? ''}`, RUNNER_TEMP: directory,
      GITHUB_PATH: pathFile, COSIGN_VERSION: 'v3.1.4',
      COSIGN_SHA256: validChecksum ? createHash('sha256').update(binary).digest('hex') : '0'.repeat(64),
    }, encoding: 'utf8',
  })
  return { directory, pathFile, result }
}

test('installs only the checked binary and requests retries for connection resets', context => {
  const { directory, pathFile, result } = install(context, true)
  equal(result.status, 0, result.stdout + result.stderr)
  match(result.stdout, /test cosign version/)
  const argumentsText = readFileSync(resolve(directory, 'curl.arguments'), 'utf8')
  match(argumentsText, /--retry\n5\n--retry-all-errors\n/)
  match(argumentsText, /--retry-max-time\n300\n/)
  match(argumentsText, /v3\.1\.4\/cosign-linux-amd64/)
  equal(existsSync(resolve(readFileSync(pathFile, 'utf8').trim(), 'cosign')), true)
})

test('rejects a checksum mismatch before adding Cosign to PATH', context => {
  const { pathFile, result } = install(context, false)
  equal(result.status, 1)
  equal(existsSync(pathFile), false)
})

test('stops on an exhausted download failure before adding Cosign to PATH', context => {
  const { pathFile, result } = install(context, true, true)
  equal(result.status, 35)
  equal(existsSync(pathFile), false)
})
