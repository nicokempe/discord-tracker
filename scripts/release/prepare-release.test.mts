import { deepEqual, equal, match, doesNotMatch, notEqual } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { test, type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { calculateNextReleaseVersion } from './version-policy.mts'

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

/** Runs an actual workflow shell step against the isolated Git remote. */
function runWorkflowStep(fixture: ReleaseFixture, stepName: string, environment: Record<string, string>): void {
  const workflow = readFileSync(resolve(projectRoot, '.github/workflows/release.yml'), 'utf8').split('\n')
  const stepStart = workflow.indexOf(`      - name: ${stepName}`)
  notEqual(stepStart, -1, `Workflow step not found: ${stepName}`)
  const followingStep = workflow.findIndex((line, index) => index > stepStart && line.startsWith('      - name: '))
  const stepLines = workflow.slice(stepStart, followingStep === -1 ? undefined : followingStep)
  const runStart = stepLines.findIndex(line => line.trim() === 'run: |')
  notEqual(runStart, -1, `Shell block not found: ${stepName}`)
  const script = stepLines.slice(runStart + 1).map(line => line.slice(10)).join('\n')
  const result = spawnSync('bash', ['-e', '-u', '-o', 'pipefail', '-c', script], {
    cwd: fixture.repository,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
  })
  equal(result.status, 0, result.stdout + result.stderr)
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
function prepare(fixture: ReleaseFixture, outputName: string): {
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
  ], { cwd: fixture.repository, encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr, outputsPath, notesPath }
}

/** Reads a package version written by release preparation. */
function readVersion(fixture: ReleaseFixture): string {
  const manifest = JSON.parse(readFileSync(resolve(fixture.repository, 'package.json'), 'utf8')) as { version: string }
  return manifest.version
}

/** Commits the reviewed files without creating a release tag. */
function commitPreparedRelease(fixture: ReleaseFixture): string {
  const version = readVersion(fixture)
  git(fixture, 'add', 'package.json', 'CHANGELOG.md', 'scripts/release/pending.json')
  git(fixture, 'commit', '-m', `chore(release): ${version}`)
  return version
}

/** Models publication after the release preparation has been merged. */
function commitRelease(fixture: ReleaseFixture): string {
  const version = commitPreparedRelease(fixture)
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
  match(readFileSync(result.outputsPath, 'utf8'), /ready_to_publish=false/)
  match(readFileSync(result.outputsPath, 'utf8'), /should_tag=false/)
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
  match(readFileSync(resumed.outputsPath, 'utf8'), /should_tag=false/)
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

test('publishes a merged preparation without a second version bump or file changes', (context) => {
  const fixture = createFixture(context)
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const version = commitPreparedRelease(fixture)
  const reviewed = prepare(fixture, 'reviewed')
  equal(reviewed.status, 0, reviewed.stderr)
  equal(readVersion(fixture), version)
  match(readFileSync(reviewed.outputsPath, 'utf8'), /ready_to_publish=true/)
  match(readFileSync(reviewed.outputsPath, 'utf8'), /should_commit=false/)
  match(readFileSync(reviewed.outputsPath, 'utf8'), /should_tag=true/)
  equal(readFileSync(reviewed.notesPath, 'utf8'), readFileSync(first.notesPath, 'utf8'))
  equal(git(fixture, 'status', '--porcelain'), '')
  equal(git(fixture, 'tag', '--list'), 'v2000.01.0')
})

for (const changeKind of ['source', 'dependencies']) {
  test(`refreshes prepared notes after ${changeKind} changes without consuming another version`, (context) => {
    const fixture = createFixture(context)
    const first = prepare(fixture, 'first')
    equal(first.status, 0, first.stderr)
    const version = commitPreparedRelease(fixture)
    if (changeKind === 'source') {
      writeFileSync(resolve(fixture.repository, 'feature.txt'), 'Additional reviewed work.\n')
      git(fixture, 'add', 'feature.txt')
    } else {
      const packagePath = resolve(fixture.repository, 'package.json')
      const packageObject = JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, unknown>
      packageObject.dependencies = { 'discord.js': '14.27.0' }
      writeFileSync(packagePath, `${JSON.stringify(packageObject, null, 2)}\n`)
      git(fixture, 'add', 'package.json')
    }
    git(fixture, 'commit', '-m', 'feat: include subsequent activity updates')
    const refreshed = prepare(fixture, 'refreshed')
    equal(refreshed.status, 0, refreshed.stderr)
    equal(readVersion(fixture), version)
    match(readFileSync(refreshed.outputsPath, 'utf8'), /ready_to_publish=false/)
    match(readFileSync(refreshed.outputsPath, 'utf8'), /should_commit=true/)
    match(readFileSync(refreshed.notesPath, 'utf8'), /Include subsequent activity updates/i)
    const changelog = readFileSync(resolve(fixture.repository, 'CHANGELOG.md'), 'utf8')
    equal(changelog.split(`## ${version}\n`).length, 2)
    commitPreparedRelease(fixture)
    const reviewed = prepare(fixture, 'reviewed')
    equal(reviewed.status, 0, reviewed.stderr)
    match(readFileSync(reviewed.outputsPath, 'utf8'), /ready_to_publish=true/)
  })
}

test('stages a release branch and publishes only a tag when direct main pushes are rejected', (context) => {
  const fixture = createFixture(context)
  const protectedRemote = resolve(fixture.directory, 'protected.git')
  git(fixture, 'init', '--bare', protectedRemote)
  git(fixture, 'remote', 'add', 'origin', protectedRemote)
  git(fixture, 'push', 'origin', 'HEAD:refs/heads/main')
  const originalMain = git(fixture, 'rev-parse', 'HEAD')
  writeFileSync(resolve(protectedRemote, 'hooks/pre-receive'), [
    '#!/bin/sh',
    'while read previous next reference; do',
    '  if [ "$reference" = refs/heads/main ]; then',
    '    echo "Protected main requires a pull request." >&2',
    '    exit 1',
    '  fi',
    'done',
    '',
  ].join('\n'), { mode: 0o755 })
  const first = prepare(fixture, 'first')
  equal(first.status, 0, first.stderr)
  const version = readVersion(fixture)
  runWorkflowStep(fixture, 'Push release preparation to its managed branch', {
    VERSION: version,
    BASE_SHA: originalMain,
    GITHUB_OUTPUT: resolve(fixture.directory, 'branch.outputs'),
  })
  const preparedCommit = git(fixture, 'rev-parse', 'HEAD')
  equal(git(fixture, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], originalMain)
  equal(git(fixture, 'ls-remote', 'origin', `refs/tags/${version}`), '')
  const rejected = spawnSync('git', ['push', 'origin', 'HEAD:refs/heads/main'], {
    cwd: fixture.repository, encoding: 'utf8',
  })
  notEqual(rejected.status, 0)
  match(rejected.stderr, /Protected main requires a pull request/)
  // Model GitHub merging the approved PR on the server, retaining its push restriction.
  git(fixture, '--git-dir', protectedRemote, 'update-ref', 'refs/heads/main', preparedCommit, originalMain)
  const reviewed = prepare(fixture, 'reviewed')
  equal(reviewed.status, 0, reviewed.stderr)
  match(readFileSync(reviewed.outputsPath, 'utf8'), /should_tag=true/)
  const publicationEnvironment = { VERSION: version, BASE_SHA: preparedCommit }
  runWorkflowStep(fixture, 'Publish the release tag on the reviewed main commit', publicationEnvironment)
  // Re-running only the failed publication job must also tolerate its existing tag.
  runWorkflowStep(fixture, 'Publish the release tag on the reviewed main commit', publicationEnvironment)
  equal(git(fixture, 'ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], preparedCommit)
  equal(git(fixture, 'ls-remote', 'origin', `refs/tags/${version}^{}`).split(/\s+/)[0], preparedCommit)
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
