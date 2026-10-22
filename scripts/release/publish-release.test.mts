import { deepEqual, equal, match, rejects } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test, type TestContext } from 'node:test'
import { workflowScript } from './workflow-test-helpers.mts'

const version = '2026.10.0'
const digest = `sha256:${'a'.repeat(64)}`
const revision = 'b'.repeat(40)
const notes = 'Release notes with [compare changes](https://github.com/nicokempe/discord-tracker/compare/old...2026.10.0).\n'
const context = { repo: { owner: 'nicokempe', repo: 'discord-tracker' } }
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...parameters: string[]) => (...args: unknown[]) => Promise<void>

/** Executes the shipped github-script blocks against a minimal API double. */
async function githubStep(step: string, status: number, released = false, tagged = true) {
  const outputs: Record<string, string> = {}
  const mutations: Array<{ method: string, parameters: Record<string, unknown> }> = []
  const api = {
    async getReleaseByTag() {
      if (status !== 200) throw Object.assign(new Error(`GitHub ${status}`), { status })
      return { data: { id: 42, draft: !released, prerelease: false } }
    },
    async createRelease(parameters: Record<string, unknown>) { mutations.push({ method: 'create', parameters }) },
    async updateRelease(parameters: Record<string, unknown>) { mutations.push({ method: 'update', parameters }) },
  }
  const requireMock = (module: string) => module === 'node:fs'
    ? { readFileSync: (path: string) => path === 'package.json' ? JSON.stringify({ version }) : notes }
    : { execFileSync: () => tagged ? version : '' }
  const script = new AsyncFunction('require', 'github', 'context', 'core', 'process', workflowScript(step, 'script'))
  await script(requireMock, { rest: { repos: api } }, context, {
    setOutput: (key: string, value: string) => { outputs[key] = value }, notice: () => {},
  }, { env: { VERSION: version, RELEASE_NOTES_PATH: '/release-notes.md' } })
  return { outputs, mutations }
}

test('automatically resumes an existing tag with no published GitHub Release', async () => {
  const result = await githubStep('Find an incomplete release', 404)
  deepEqual(result.outputs, { version })
  deepEqual(result.mutations, [])
})

test('leaves completed releases and untagged package versions to normal preparation', async () => {
  deepEqual((await githubStep('Find an incomplete release', 200, true)).outputs, {})
  deepEqual((await githubStep('Find an incomplete release', 404, false, false)).outputs, {})
})

test('does not treat GitHub permission errors as missing releases', async () => {
  await rejects(githubStep('Find an incomplete release', 403), /GitHub 403/)
  await rejects(githubStep('Create or update GitHub Release', 403), /GitHub 403/)
})

test('creates a visible GitHub Release with the exact committed notes and updates it on retry', async () => {
  const created = (await githubStep('Create or update GitHub Release', 404)).mutations
  equal(created.length, 1)
  deepEqual(created[0], { method: 'create', parameters: {
    ...context.repo, tag_name: version, name: version, body: notes,
    draft: false, prerelease: false, make_latest: 'true',
  } })
  const updated = (await githubStep('Create or update GitHub Release', 200, true)).mutations
  deepEqual(updated[0], { method: 'update', parameters: { ...created[0]?.parameters, release_id: 42 } })
})

/** Runs real shell publication steps with Docker calls recorded instead of publishing. */
function dockerStep(testContext: TestContext, step: string, mode: string, existingDigest = '') {
  const directory = mkdtempSync(resolve(tmpdir(), 'release-publish-test-'))
  testContext.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(resolve(directory, 'bin'))
  writeFileSync(resolve(directory, 'bin/docker'), [
    '#!/usr/bin/env bash', 'set -euo pipefail',
    'printf "%s\\n" "$*" >> "$RUNNER_TEMP/docker.calls"',
    'if [[ "$DOCKER_MODE" == network-error ]]; then echo "connection reset by peer" >&2; exit 1; fi',
    'if [[ "$DOCKER_MODE" == missing ]]; then echo "manifest unknown" >&2; exit 1; fi',
    'if [[ "$DOCKER_MODE" == not-found ]]; then echo "ERROR: $IMAGE:$VERSION: not found" >&2; exit 1; fi',
    'if [[ "$*" == "buildx imagetools inspect "*" --raw" ]]; then',
    '  printf \'{"manifests":[{"digest":"sha256:%s","platform":{"os":"linux","architecture":"amd64"}},{"digest":"sha256:%s","platform":{"os":"linux","architecture":"arm64"}}]}\\n\' "$AMD64_DIGEST" "$ARM64_DIGEST"',
    'elif [[ "$*" == "image inspect "* ]]; then',
    '  architecture=amd64',
    '  if [[ "$*" == *"$ARM64_DIGEST" ]]; then architecture=arm64; fi',
    '  if [[ "$DOCKER_MODE" == wrong-source ]]; then RELEASE_SHA=incorrect; fi',
    '  printf \'[{"Architecture":"%s","Os":"linux","Config":{"Labels":{"org.opencontainers.image.revision":"%s","org.opencontainers.image.version":"%s","org.opencontainers.image.source":"https://github.com/%s"}}}]\\n\' "$architecture" "$RELEASE_SHA" "$VERSION" "$GITHUB_REPOSITORY"',
    'elif [[ "$*" == "buildx imagetools inspect "* ]]; then printf "%s\\n" "$TEST_DIGEST"; fi', '',
  ].join('\n'), { mode: 0o755 })
  const outputPath = resolve(directory, 'outputs')
  const result = spawnSync('bash', ['-euo', 'pipefail', '-c', workflowScript(step)], {
    env: {
      ...process.env, PATH: `${directory}/bin:${process.env.PATH ?? ''}`,
      RUNNER_TEMP: directory, GITHUB_OUTPUT: outputPath, DOCKER_MODE: mode, TEST_DIGEST: digest,
      IMAGE: 'ghcr.io/nicokempe/discord-tracker', VERSION: version, RELEASE_SHA: revision,
      SHORT_SHA: revision.slice(0, 12), GITHUB_REPOSITORY: 'nicokempe/discord-tracker',
      SHOULD_COMMIT: mode === 'collision' ? 'true' : 'false',
      IMAGE_DIGEST: digest, EXISTING_DIGEST: existingDigest,
      AMD64_DIGEST: '1'.repeat(64), ARM64_DIGEST: '2'.repeat(64),
    }, encoding: 'utf8',
  })
  return {
    result,
    outputs: existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '',
    calls: existsSync(resolve(directory, 'docker.calls')) ? readFileSync(resolve(directory, 'docker.calls'), 'utf8') : '',
  }
}

test('reuses a published digest and distinguishes absent images from registry failures', testContext => {
  const found = dockerStep(testContext, 'Find an already published release image', 'existing')
  equal(found.result.status, 0, found.result.stderr)
  equal(found.outputs, `digest=${digest}\n`)
  const missing = dockerStep(testContext, 'Find an already published release image', 'missing')
  equal(missing.result.status, 0, missing.result.stderr)
  equal(missing.outputs, '')
  const notFound = dockerStep(testContext, 'Find an already published release image', 'not-found')
  equal(notFound.result.status, 0, notFound.result.stderr)
  const unavailable = dockerStep(testContext, 'Find an already published release image', 'network-error')
  equal(unavailable.result.status, 1)
  const collision = dockerStep(testContext, 'Find an already published release image', 'collision')
  equal(collision.result.status, 1)
  match(collision.result.stdout, /already has a registry image/)
})

test('checks both original platform revisions before reusing registry contents', testContext => {
  const pulled = dockerStep(testContext, 'Pull and validate the existing release images', 'existing')
  equal(pulled.result.status, 0, pulled.result.stdout + pulled.result.stderr)
  match(pulled.calls, /pull --platform linux\/amd64/)
  match(pulled.calls, /pull --platform linux\/arm64/)
  const mismatch = dockerStep(testContext, 'Pull and validate the existing release images', 'wrong-source')
  equal(mismatch.result.status, 1)
})

test('resuming a pushed manifest publishes no replacement images or version tags', testContext => {
  const resumed = dockerStep(testContext, 'Publish scanned images or reuse the existing manifest', 'existing', digest)
  equal(resumed.result.status, 0, resumed.result.stderr)
  equal(resumed.outputs, `digest=${digest}\n`)
  equal(resumed.calls, '')
})
