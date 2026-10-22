import { deepEqual, equal, match, doesNotMatch, notEqual } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { test, type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { calculateNextReleaseVersion } from './version-policy.mts'
import { workflowScript } from './workflow-test-helpers.mts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Isolated Git history and release outputs for an integration test. */
interface ReleaseFixture {
  readonly directory: string
  readonly repository: string
  readonly baselineCommit: string
  readonly initialChangelog: string
}

/** Executes Git in a fixture and requires a successful exit. */
function git(fixture: Pick<ReleaseFixture, 'repository'>, ...argumentsList: string[]): string {
  const result = spawnSync('git', argumentsList, {
    cwd: fixture.repository,
    encoding: 'utf8',
  })
  equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

/** Creates a real repository with legacy tags and the installed Changelogen CLI. */
function createFixture(context: TestContext): ReleaseFixture {
  const directory = mkdtempSync(resolve(tmpdir(), 'discord-tracker-release-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const repository = resolve(directory, 'repository')
  cpSync(resolve(projectRoot, 'scripts/release'), resolve(repository, 'scripts/release'), { recursive: true })
  cpSync(resolve(projectRoot, 'changelog.config.json'), resolve(repository, 'changelog.config.json'))
  symlinkSync(resolve(projectRoot, 'node_modules'), resolve(repository, 'node_modules'), 'dir')
  writeFileSync(resolve(repository, '.gitignore'), 'node_modules/\n')
  writeFileSync(resolve(repository, 'package.json'), JSON.stringify({
    name: 'discord-tracker',
    version: '2000.1.0',
    repository: 'https://github.com/nicokempe/discord-tracker.git',
  }, null, 2) + '\n')
  const initialChangelog = '# Changelog\n\n## v2000.01.0\n\nHistorical notes.\n'
  writeFileSync(resolve(repository, 'CHANGELOG.md'), initialChangelog)
  const fixture = { directory, repository, initialChangelog }
  git(fixture, 'init', '--initial-branch=main')
  git(fixture, 'config', 'user.name', 'Release test')
  git(fixture, 'config', 'user.email', 'release-test@example.com')
  git(fixture, 'config', 'commit.gpgsign', 'false')
  git(fixture, 'config', 'tag.gpgsign', 'false')
  git(fixture, 'add', '.')
  git(fixture, 'commit', '-m', 'chore: migration baseline')
  const baselineCommit = git(fixture, 'rev-parse', 'HEAD')
  git(fixture, 'tag', 'v2000.01.0')
  writeFileSync(resolve(repository, 'scripts/release/baseline.json'), JSON.stringify({
    version: '2000.1.0',
    commit: baselineCommit,
  }) + '\n')
  git(fixture, 'add', 'scripts/release/baseline.json')
  git(fixture, 'commit', '-m', 'feat: automate calendar releases')
  return { ...fixture, baselineCommit }
}

/** Runs the actual release command without publishing any Git refs or packages. */
function prepare(fixture: ReleaseFixture, outputName: string, extraArguments: string[] = []): {
  readonly status: number | null
  readonly stderr: string
  readonly outputsPath: string
  readonly notesPath: string
} {
  const outputsPath = resolve(fixture.directory, `${outputName}.outputs`)
  const notesPath = resolve(fixture.directory, `${outputName}.notes.md`)
  const result = spawnSync(process.execPath, [
    'scripts/release/prepare-release.mts',
    '--github-output', outputsPath,
    '--notes-file', notesPath,
    ...extraArguments,
  ], { cwd: fixture.repository, encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr, outputsPath, notesPath }
}

/** Reads a package version written by release preparation. */
function readVersion(fixture: ReleaseFixture): string {
  const manifest = JSON.parse(readFileSync(resolve(fixture.repository, 'package.json'), 'utf8')) as { version: string }
  return manifest.version
}

/** Commits prepared files and annotates the same version, as the workflow does. */
function commitRelease(fixture: ReleaseFixture): string {
  const version = readVersion(fixture)
  git(fixture, 'add', 'package.json', 'CHANGELOG.md')
  git(fixture, 'commit', '-m', `chore(release): ${version}`)
  git(fixture, 'tag', '--annotate', version, '--message', version)
  return version
}

test('prepares the first calendar release with valid links and preserves historical notes', (context) => {
  const fixture = createFixture(context)
  const headBefore = git(fixture, 'rev-parse', 'HEAD')
  const result = prepare(fixture, 'first')
  equal(result.status, 0, result.stderr)
  const expectedVersion = calculateNextReleaseVersion([], '2000.1.0').version
  equal(readVersion(fixture), expectedVersion)
  const notes = readFileSync(result.notesPath, 'utf8')
  match(notes, /Automate calendar releases/i)
  match(notes, new RegExp(`https://github.com/nicokempe/discord-tracker/compare/${fixture.baselineCommit}\\.\\.\\.${expectedVersion}`))
  doesNotMatch(notes, /undefined|Historical notes/)
  const changelog = readFileSync(resolve(fixture.repository, 'CHANGELOG.md'), 'utf8')
  match(changelog, new RegExp(`^## ${expectedVersion.replaceAll('.', '\\.')}\\s*$`, 'm'))
  equal(changelog.endsWith(fixture.initialChangelog.replace('# Changelog\n', '')), true)
  match(readFileSync(result.outputsPath, 'utf8'), /should_commit=true/)
  equal(git(fixture, 'rev-parse', 'HEAD'), headBefore)
  equal(git(fixture, 'tag', '--list'), 'v2000.01.0')
})

test('resumes an existing release at HEAD without changing files or allocating a new version', (context) => {
  const fixture = createFixture(context)
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const version = commitRelease(fixture)
  const headBefore = git(fixture, 'rev-parse', 'HEAD')
  const resumed = prepare(fixture, 'resumed')
  equal(resumed.status, 0, resumed.stderr)
  equal(readVersion(fixture), version)
  equal(readFileSync(resumed.notesPath, 'utf8'), readFileSync(first.notesPath, 'utf8'))
  match(readFileSync(resumed.outputsPath, 'utf8'), /should_commit=false/)
  equal(git(fixture, 'rev-parse', 'HEAD'), headBefore)
  equal(git(fixture, 'status', '--porcelain'), '')
})

test('releases only changes after the previous calendar tag and increments the month counter', (context) => {
  const fixture = createFixture(context)
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const previousVersion = commitRelease(fixture)
  git(fixture, 'commit', '--allow-empty', '-m', 'fix: recover Discord connections')
  const next = prepare(fixture, 'next')
  equal(next.status, 0, next.stderr)
  const expectedVersion = calculateNextReleaseVersion([previousVersion], previousVersion).version
  equal(readVersion(fixture), expectedVersion)
  notEqual(expectedVersion, previousVersion)
  const notes = readFileSync(next.notesPath, 'utf8')
  match(notes, /Recover Discord connections/i)
  doesNotMatch(notes, /Automate calendar releases/i)
  match(readFileSync(next.outputsPath, 'utf8'), new RegExp(`previous_reference=${previousVersion}`))
})

test('recovers an incomplete tag after main advances using the original source and notes', (context) => {
  const fixture = createFixture(context)
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const version = commitRelease(fixture)
  const releaseSha = git(fixture, 'rev-parse', 'HEAD')
  const changelogPath = resolve(fixture.repository, 'CHANGELOG.md')
  writeFileSync(changelogPath, readFileSync(changelogPath, 'utf8').replace(/Automate calendar releases/i, 'Unreleased later notes'))
  git(fixture, 'add', 'CHANGELOG.md')
  git(fixture, 'commit', '-m', 'fix(release): repair publication workflow')
  const mainSha = git(fixture, 'rev-parse', 'HEAD')
  const resumed = prepare(fixture, 'recovered', ['--resume-version', version])
  equal(resumed.status, 0, resumed.stderr)
  match(readFileSync(resumed.outputsPath, 'utf8'), /should_commit=false/)
  match(readFileSync(resumed.outputsPath, 'utf8'), new RegExp(`source_sha=${releaseSha}`))
  equal(readFileSync(resumed.notesPath, 'utf8'), readFileSync(first.notesPath, 'utf8'))
  equal(git(fixture, 'rev-parse', 'HEAD'), mainSha)
  equal(git(fixture, 'status', '--porcelain'), '')
})

test('pushes release files and the annotated tag together and tolerates a publication retry', (context) => {
  const fixture = createFixture(context)
  const remote = resolve(fixture.directory, 'origin.git')
  git(fixture, 'init', '--bare', remote)
  git(fixture, 'remote', 'add', 'origin', remote)
  git(fixture, 'push', 'origin', 'HEAD:refs/heads/main')
  const baseSha = git(fixture, 'rev-parse', 'HEAD')
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const version = readVersion(fixture)
  function runStep(name: string, environment: Record<string, string>): void {
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', workflowScript(name)], {
      cwd: fixture.repository, env: { ...process.env, ...environment }, encoding: 'utf8',
    })
    equal(result.status, 0, result.stdout + result.stderr)
  }
  runStep('Create the local release commit and tag', { VERSION: version })
  const releaseSha = git(fixture, 'rev-parse', 'HEAD')
  const environment = { VERSION: version, RELEASE_SHA: releaseSha, BASE_SHA: baseSha, SHOULD_COMMIT: 'true' }
  runStep('Publish the release commit and tag atomically', environment)
  equal(git(fixture, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], releaseSha)
  equal(git(fixture, 'ls-remote', 'origin', `refs/tags/${version}^{}`).split(/\s+/)[0], releaseSha)
  runStep('Publish the release commit and tag atomically', {
    ...environment, BASE_SHA: releaseSha, SHOULD_COMMIT: 'false',
  })
})

test('does not publish either Git ref when main advances during validation', (context) => {
  const fixture = createFixture(context)
  const remote = resolve(fixture.directory, 'origin.git')
  git(fixture, 'init', '--bare', remote)
  git(fixture, 'remote', 'add', 'origin', remote)
  git(fixture, 'push', 'origin', 'HEAD:refs/heads/main')
  const baseSha = git(fixture, 'rev-parse', 'HEAD')
  const prepared = prepare(fixture, 'first')
  equal(prepared.status, 0, prepared.stderr)
  const version = commitRelease(fixture)
  const releaseSha = git(fixture, 'rev-parse', 'HEAD')
  git(fixture, 'push', 'origin', 'HEAD:refs/heads/main')
  const result = spawnSync('bash', ['-euo', 'pipefail', '-c', workflowScript('Publish the release commit and tag atomically')], {
    cwd: fixture.repository,
    env: { ...process.env, BASE_SHA: baseSha, VERSION: version, RELEASE_SHA: releaseSha, SHOULD_COMMIT: 'true' },
    encoding: 'utf8',
  })
  notEqual(result.status, 0)
  match(result.stdout, /main changed during validation/)
  equal(git(fixture, 'ls-remote', 'origin', `refs/tags/${version}`), '')
})

test('rejects an unexpected package allocation before modifying the changelog', (context) => {
  const fixture = createFixture(context)
  const packagePath = resolve(fixture.repository, 'package.json')
  const packageContents = readFileSync(packagePath, 'utf8').replace('2000.1.0', '2000.1.9')
  writeFileSync(packagePath, packageContents)
  const result = prepare(fixture, 'invalid')
  equal(result.status, 1)
  match(result.stderr, /does not match the latest release allocation/)
  equal(readFileSync(packagePath, 'utf8'), packageContents)
  equal(readFileSync(resolve(fixture.repository, 'CHANGELOG.md'), 'utf8'), fixture.initialChangelog)
})

test('rejects an unreachable migration boundary', (context) => {
  const fixture = createFixture(context)
  writeFileSync(resolve(fixture.repository, 'scripts/release/baseline.json'), JSON.stringify({
    version: '2000.1.0', commit: '0'.repeat(40),
  }))
  const result = prepare(fixture, 'invalid-baseline')
  equal(result.status, 1)
  match(result.stderr, /is not an ancestor/)
  deepEqual(git(fixture, 'tag', '--list'), 'v2000.01.0')
})
