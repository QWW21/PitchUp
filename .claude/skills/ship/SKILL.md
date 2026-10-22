---
name: ship
description: Runs a PitchUp ticket through the agent pipeline - ticket, owner approval, tests first, build, independent review, screenshot evidence, owner approval to merge. Use when the owner types /ship with an issue number or an idea, or asks to "ship", "take", or "do" a ticket through the pipeline.
---

# /ship — a ticket through the pipeline

Arguments: an issue number (`/ship 188`), or an idea in words
(`/ship let managers export invoices`), optionally followed by `--fast` for
a small fix. The design and its reasons are in `docs/PLAN_AGENT_PIPELINE.md`.

You are the orchestrator. You start each agent with the Agent tool
(`subagent_type`: `ticket-writer`, `test-writer`, `developer`,
`reviewer`), give it only what it needs (the issue number, the branch,
findings to fix), check what it did, and stop at the owner's two approvals.
You don't write the code, tests or verdict yourself.

Keep a task list with one step per stage below, and tell the owner in one
line when each stage starts and ends.

## 1. The ticket

- **An idea**: start `ticket-writer` with the owner's words. Show the owner
  its draft (title, criteria, its questions) and get their answers.
- **An issue number**: `gh issue view <n>`. If it has no numbered acceptance
  criteria (AC1…), have `ticket-writer` draft them for that issue.

✋ **Gate 1: the owner approves the ticket.** Ask, and don't go on without
a clear yes. Then create or update the issue (`ticket-writer` with "the owner
approved this draft", or `gh issue edit` yourself) and add the label:
`gh issue edit <n> --add-label "status: ready-for-dev"`.

## 2. The branch

From an up-to-date `main` with a clean tree (the owner's local edits to the
never-commit files may stay; don't touch them):

```bash
git switch main && git pull --ff-only && git switch -c ticket/<n>-<slug>
gh issue edit <n> --add-label "status: in-progress" --remove-label "status: ready-for-dev"
```

## 3. Tests first (skipped with `--fast`)

Start `test-writer` with the issue number. Then check its diff touches only
tests:

```bash
git status --porcelain --untracked-files=all
```

Every path must be under `apps/web/e2e/` or end in `.test.ts` / `.test.tsx`.
Anything else: revert those files (`git checkout -- <file>` for tracked,
delete untracked ones) and send it back once with the reason. Commit the
tests: `test(#<n>): acceptance tests, failing until built`.

## 4. Build

Start `developer` with the issue number and the test-writer's list of
assumptions. When it answers, run the fast checks yourself; don't take its
word:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:mobile
```

Failures go straight back to `developer` with the output. If it says a
test is wrong, decide with the ticket in hand; ask the owner when it's a
product question. Then check it didn't edit the acceptance tests:
`git diff <tests commit> -- <test files>` must be empty unless you agreed.
Commit: `feat(#<n>): <title>` (or `fix`).

## 5. Review

`gh issue edit <n> --add-label "status: in-review" --remove-label "status: in-progress"`,
then start `reviewer` with the issue number and the branch. Afterwards
`git status --porcelain` must show no changes (beyond screenshots under
`docs/test-evidence/` from its E2E run, which you discard:
`git checkout -- docs/test-evidence` and remove new ones).

- **CHANGES NEEDED**: send the findings to `developer`, commit its fixes,
  and review again. **At most two rounds**; after a second failed review
  stop and give the owner the findings and your recommendation.
- **PASS**: tick the issue's AC boxes (`gh issue edit <n> --body-file`) and
  `gh issue edit <n> --add-label "status: verified" --remove-label "status: in-review"`.

## 6. Evidence (skipped with `--fast`, or when no AC asks for a screenshot)

```bash
pnpm exec tsx scripts/post-evidence.ts --issue <n> --specs <the ticket's web specs, comma-separated>
```

It runs those specs with screenshots on, commits them, pushes the ticket's
branch and comments on the issue. Mobile-only tickets get the test results
in the review comment and no screenshots (the app is checked with Jest only).

✋ **Gate 2: the owner approves the merge.** Give them the review verdict,
the evidence link and the commits on the branch. On a yes:

```bash
git switch main && git pull --ff-only && git merge --ff-only ticket/<n>-<slug>
git push origin main && gh issue close <n> --comment "Merged in <sha>."
git branch -d ticket/<n>-<slug>
```

If they'd like CI to run first, open a pull request instead
(`gh pr create`) and merge it when green.

## Rules

- Commit only the ticket's work: never `README.md`, the root
  `package.json`, `.claude/launch.json`, `docs/PRODUCT_GAPS_AND_ROADMAP.md`,
  `.env`, Firebase files. Scan `git diff --cached` for `AIzaSy`, `GOCSPX`
  and private keys before every commit; end messages with the session's
  `Co-Authored-By` line.
- Never push `main` or close the issue before gate 2.
- The full E2E run (about 13 minutes) runs once, in the review. Run long
  commands in the background.
- If something outside the ticket turns up (a bug, a gap), note it for the
  owner as a new ticket; don't widen this one.
