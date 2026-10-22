# Plan: an agent pipeline for PitchUp work

Written 2026-10-22. A design to review before anything is set up. It turns
the way C-14 and C-15 were built (a plan the owner approved, then code,
tests and evidence) into a repeatable pipeline of Claude Code agents, with
the owner approving at two points.

## Why not six agents

The owner asked for agents that write tickets, write code, test, write
automatic tests, check tickets against the implementation, and update
tickets with photos. Three changes:

- **Testing and checking the ticket are one job**: does the code do what
  the ticket says? One reviewer runs the checks and judges each acceptance
  criterion with proof. What matters is that it is not the agent that wrote
  the code, and starts without its context.
- **Automatic tests are written before the code, from the ticket alone.**
  A test writer that reads the implementation tests what was built, not
  what was asked. Written first, the E2E tests are an independent
  definition of done. The developer still writes unit tests next to its
  code.
- **Posting screenshots is a script, not an agent.** It is mechanical:
  `snap()` with `EVIDENCE=1` already writes them. A script is free,
  repeatable and can't misreport.

## The pipeline

| #   | Step                                                          | Who                                 | Reads                            | Writes                                                 |
| --- | ------------------------------------------------------------- | ----------------------------------- | -------------------------------- | ------------------------------------------------------ |
| 1   | Ticket                                                        | `ticket-writer` agent               | the owner's idea, docs, the code | a GitHub issue with numbered acceptance criteria       |
| ✋  | **Owner approves the ticket** (label `status: ready-for-dev`) |                                     |                                  |                                                        |
| 2   | Tests first                                                   | `test-writer` agent                 | the ticket only                  | E2E specs (API and web) and mobile Jest cases, failing |
| 3   | Build                                                         | `developer` agent                   | ticket + the failing tests       | the code, unit tests, docs; every check green          |
| 4   | Verify                                                        | `reviewer` agent (read-only, fresh) | ticket, the diff, check results  | a verdict per criterion, posted on the issue           |
| 5   | Evidence                                                      | `scripts/post-evidence.ts`          | the run's screenshots            | committed images and a comment on the issue            |
| ✋  | **Owner approves the merge**                                  |                                     |                                  |                                                        |

- **A failed review goes back to step 3** with the reviewer's notes, at
  most twice; then it stops and asks the owner.
- **Each ticket gets a branch** (`ticket/<number>-<slug>`). The owner works
  alone, so a pull request is optional; opening one makes CI run before
  `main` (it already runs on PRs and on pushes to `main`).
- **The fast path** for small fixes (one file, no new behaviour): ticket →
  developer → reviewer. No test-first step, no evidence.
- **Who runs it**: the main Claude session, through a `/ship <issue>` skill
  that starts each agent in turn, passes on only what the next step needs,
  and stops at the two approvals.

## The ticket format

The same shape as the existing issues (#188, the C-13 ticket), with the
criteria numbered so the tests and the review can refer to them:

```markdown
## Summary

What changes and why, in a few sentences.

## Decisions

Taken by the owner, and those the ticket takes (the owner can change them).

## Acceptance criteria

- [ ] AC1 — A venue without a subscription is hidden from Discover (API E2E)
- [ ] AC2 — The manager sees the Subscription tab in both languages (web E2E, screenshot)
- [ ] AC3 — …

## Out of scope

## Notes for the implementer

Files to read first, related tickets, risks.
```

Each criterion names how it is proved (API E2E, web E2E with a
screenshot, mobile Jest, unit). The reviewer ticks the boxes; nobody else
does.

**Labels**: keep the existing epic, priority, type and platform labels; add
`status: ready-for-dev`, `status: in-review` and `status: verified`.
Change tickets keep the `[C-n]` title prefix.

## The agents (`.claude/agents/*.md`)

Each is a file with its instructions and the tools it may use. Shared rules
live in `CLAUDE.md` (below), which every agent reads.

| Agent           | Tools                                        | Rules                                                                                                                       |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ticket-writer` | read, search, `gh issue`                     | Never edits code. Asks the owner when a decision is theirs. Every criterion testable and in one platform.                   |
| `test-writer`   | read, search, write, run tests               | Reads the ticket, `e2e/support` and existing specs, not the feature's code. Writes only test files. Each test names its AC. |
| `developer`     | everything except `gh` and `git push`        | Makes the tests pass without changing them; may add tests. Runs the checks before handing over.                             |
| `reviewer`      | read, search, run checks, `gh issue comment` | Never edits. Judges each AC from evidence (test name, file:line, screenshot), lists problems by severity.                   |

Tool limits can't restrict _which files_ an agent edits, so `/ship` checks
it after each step: the test-writer's diff may only touch `e2e/**`,
`*.test.ts(x)` and fixtures; the reviewer's must be empty. A step that
breaks this is rejected.

## The evidence script

`scripts/post-evidence.ts <issue>`:

1. Runs the ticket's web specs with `EVIDENCE=1` (the tests name their
   area), so `snap()` writes `docs/test-evidence/web/<area>/NN-name.jpg`.
2. Commits the new or changed images on the ticket's branch.
3. Comments on the issue with each image, linked at that commit
   (`https://github.com/QWW21/PitchUp/blob/<sha>/<path>?raw=true`), which
   renders for anyone who can see the repo, private or not.

GitHub has no API for attaching an image to an issue, so committing the
images and linking them is the dependable way. They are small JPEGs and
already live in the repo.

## `CLAUDE.md` for the repository

Today the rules every agent needs are spread over the plan docs and one
session's memory. A short `CLAUDE.md` at the root (importing `AGENTS.md`)
would hold them:

- What to read first (HANDOVER, ARCHITECTURE, TESTING) and the checks to
  run before handing over: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:mobile`, `pnpm test:e2e`.
- Every text in English and Romanian; API errors as `api.*` keys;
  clients branch on `details.reason`.
- Snapshot on the booking, never reprice.
- Mobile is checked with Jest only; it is never built or run.
- E2E runs with blank Stripe keys and `DEFAULT_LOCALE=en`; it uses port
  3100, so a dev server must use another port.
- Never commit `README.md`, the root `package.json`, `.claude/`,
  `docs/PRODUCT_GAPS_AND_ROADMAP.md`, `.env` or the Firebase files; scan
  for `AIzaSy`, `GOCSPX` and private keys before committing.
- Write files as UTF-8 (a Windows codepage broke the build once).

## Hooks

Kept few, since each one slows every session:

- **Kept**: the existing pre-commit (eslint and prettier on staged files).
- **Not a hook after all**: "check the developer's work when it finishes"
  is done by `/ship` itself, which runs typecheck, lint and the unit tests
  after the developer answers and sends failures straight back. A hook
  can't tell reliably which agent finished, and a check in the skill is
  easier to read and change.
- **Optional**: a pre-commit check that refuses the never-commit files.
  Off by default, since the owner keeps local edits in them.

## Cost

Each agent starts cold and re-reads what it needs, so a full run costs
several times a single session; the full E2E run (about 13 minutes) is the
slowest part. To keep it reasonable:

- The fast path for small fixes (`/ship <n> --fast`).
- The test-writer runs only its own new specs; the full suite runs once,
  in the reviewer's step.
- Agents get the ticket and a file list, not the whole history.

## Set up (2026-10-22)

| Step | What                                                                                                                                             | Where                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1    | Rules for every session and agent                                                                                                                | `CLAUDE.md` (imports `AGENTS.md`)                                  |
| 2    | Labels `status: ready-for-dev`, `status: in-review`, `status: verified`                                                                          | GitHub                                                             |
| 3    | The four agents                                                                                                                                  | `.claude/agents/{ticket-writer,test-writer,developer,reviewer}.md` |
| 4    | The evidence script, with `--dry-run` and `--skip-run`; tried on the C-15 Subscription spec (4 screenshots found, comment built, nothing posted) | `scripts/post-evidence.ts`                                         |
| 5    | The `/ship` skill: the stages, the diff checks, the review loop (two rounds at most), the two approvals                                          | `.claude/skills/ship/SKILL.md`                                     |
| 6    | A trial on #188, then on a feature ticket                                                                                                        | not run yet                                                        |

## Defaults for the owner's questions

Taken so the pipeline can run; the owner can change any of them.

- **Pull requests**: none by default; at gate 2 `/ship` fast-forwards
  `main` and pushes, as the owner works alone. It offers a PR when the
  owner wants CI to run first.
- **Mobile evidence**: test results in the review comment, no screenshots
  (the app is checked with Jest only).
- **Where `/ship` stops**: after the evidence comment, at gate 2; the merge
  happens only on the owner's yes.
- **`.claude/` in git**: the agents and the skill live in `.claude/`, which
  was on the never-commit list because of `launch.json`. `CLAUDE.md` and
  the skill now name only `.claude/launch.json`; committing
  `.claude/agents` and `.claude/skills` is the owner's call.
