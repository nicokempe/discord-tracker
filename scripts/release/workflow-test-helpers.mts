import { notEqual } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Extracts an actual workflow block so regression tests exercise the shipped commands. */
export function workflowScript(stepName: string, field: 'run' | 'script' = 'run'): string {
  const lines = readFileSync(resolve(projectRoot, '.github/workflows/release.yml'), 'utf8').split('\n')
  const start = lines.indexOf(`      - name: ${stepName}`)
  notEqual(start, -1, `Workflow step not found: ${stepName}`)
  const next = lines.findIndex((line, index) => index > start && line.startsWith('      - name: '))
  const step = lines.slice(start, next === -1 ? undefined : next)
  const bodyStart = step.findIndex(line => line.trim() === `${field}: |`)
  notEqual(bodyStart, -1, `Workflow block not found: ${stepName}/${field}`)
  const indentation = field === 'run' ? 10 : 12
  const body = step.slice(bodyStart + 1)
  const end = body.findIndex(line => line.trim() !== '' && !line.startsWith(' '.repeat(indentation)))
  return body.slice(0, end === -1 ? undefined : end).map(line => line.slice(indentation)).join('\n')
}
