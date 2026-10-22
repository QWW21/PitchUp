/**
 * Posts a ticket's screenshots on its GitHub issue — step 5 of the agent
 * pipeline (docs/PLAN_AGENT_PIPELINE.md). Mechanical on purpose: no agent.
 *
 *   pnpm exec tsx scripts/post-evidence.ts --issue 188 --specs e2e/web/billing.spec.ts
 *   … --dry-run      runs the specs and prints the comment; commits and posts nothing
 *   … --skip-run     uses the screenshots already on disk
 *
 * 1. Runs the given web specs with EVIDENCE=1, so snap() writes
 *    docs/test-evidence/web/<area>/<name>.jpg (E2E_SKIP_BUILD is passed on).
 * 2. Commits the new or changed images on the current branch and pushes
 *    that branch. Refuses on main: evidence belongs to a ticket's branch.
 * 3. Comments on the issue with each image, linked at that commit, which
 *    renders for anyone who can see the repository.
 *
 * GitHub has no API for attaching an image to an issue, hence committing.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = 'QWW21/PitchUp'
const EVIDENCE_DIR = 'docs/test-evidence'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    // pnpm and gh are .cmd shims on Windows.
    shell: process.platform === 'win32',
  })
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}

function must(cmd: string, args: string[], opts?: Parameters<typeof run>[2]) {
  const r = run(cmd, args, opts)
  if (!r.ok) {
    console.error(`✗ ${cmd} ${args.join(' ')}\n${r.out}`)
    process.exit(1)
  }
  return r.out
}

const issue = arg('issue')
const specs = (arg('specs') ?? '').split(',').filter(Boolean)
const dryRun = flag('dry-run')
if (!issue || !/^\d+$/.test(issue) || (!specs.length && !flag('skip-run'))) {
  console.error(
    'Usage: post-evidence.ts --issue <number> --specs <a.spec.ts,b.spec.ts> [--dry-run] [--skip-run]'
  )
  process.exit(2)
}

const branch = must('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (!dryRun && (branch === 'main' || branch === 'HEAD')) {
  console.error(`✗ On ${branch}: evidence is committed on the ticket's branch, never on main.`)
  process.exit(1)
}

// 1. The screenshots.
if (!flag('skip-run')) {
  console.log(`Running ${specs.join(', ')} with EVIDENCE=1…`)
  const r = run('pnpm', ['exec', 'playwright', 'test', '--project=web', ...specs], {
    cwd: 'apps/web',
    env: { ...process.env, EVIDENCE: '1' },
  })
  console.log(r.out.split('\n').slice(-5).join('\n'))
  if (!r.ok) {
    console.error('✗ The specs failed: no evidence is posted for a failing run.')
    process.exit(1)
  }
}

// 2. What changed under docs/test-evidence.
const changed = must('git', ['status', '--porcelain', '--untracked-files=all', '--', EVIDENCE_DIR])
  .split('\n')
  .map(line => line.slice(3).trim().replace(/^"|"$/g, ''))
  .filter(path => path.endsWith('.jpg'))
  .sort()
if (!changed.length) {
  console.log('No new or changed screenshots: nothing to post.')
  process.exit(0)
}

let sha = '<commit>'
if (!dryRun) {
  must('git', ['add', '--', ...changed])
  must('git', ['commit', '-m', `test(evidence): screenshots for #${issue}`, '--', ...changed])
  sha = must('git', ['rev-parse', 'HEAD'])
  must('git', ['push', '-u', 'origin', branch])
}

// 3. The comment: grouped by area, each image linked at the commit.
const byArea = new Map<string, string[]>()
for (const path of changed) {
  const area = path.split('/').slice(-2, -1)[0] ?? 'other'
  byArea.set(area, [...(byArea.get(area) ?? []), path])
}
const body = [
  `## Test evidence`,
  ``,
  `Screenshots from ${specs.length ? specs.map(s => `\`${s}\``).join(', ') : 'the last run'}, at ${dryRun ? 'the next commit' : `\`${sha.slice(0, 7)}\``} on \`${branch}\`.`,
  ...[...byArea].flatMap(([area, paths]) => [
    ``,
    `### ${area}`,
    ...paths.map(p => {
      const name = p
        .split('/')
        .pop()!
        .replace(/\.jpg$/, '')
      return `\n**${name}**\n\n![${name}](https://github.com/${REPO}/blob/${sha}/${p}?raw=true)`
    }),
  ]),
].join('\n')

if (dryRun) {
  console.log(`\n--- Dry run: would commit ${changed.length} image(s) and post on #${issue} ---\n`)
  console.log(body)
  process.exit(0)
}

const file = join(mkdtempSync(join(tmpdir(), 'evidence-')), 'comment.md')
writeFileSync(file, body, 'utf8')
console.log(must('gh', ['issue', 'comment', issue, '--repo', REPO, '--body-file', file]))
console.log(`✓ ${changed.length} screenshot(s) posted on #${issue}`)
