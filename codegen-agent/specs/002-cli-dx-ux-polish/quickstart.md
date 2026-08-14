# Quickstart: Validating CLI DX/UX Polish

Runnable scenarios proving this feature works end-to-end. See
[contracts/input-collection.md](./contracts/input-collection.md) and
[contracts/progress-reporter.md](./contracts/progress-reporter.md) for the exact contracts
referenced below.

## Prerequisites

Same as spec 001's quickstart: `npm install`, a configured `.env`, and a copy of
`../code-boilerplate`.

## Scenario 1 — No flags: fully interactive collection (validates US1, SC-001)

```bash
npm run build
node dist/cli.js
```

**Expected**: prompted for `--spec`, then `--boilerplate`, then `--out`, one at a time, each
blank (nothing to pre-fill), followed by a single confirmation before PLAN starts.

## Scenario 2 — All flags supplied: confirm with editable pre-fill (validates US1, SC-002, Clarifications)

```bash
node dist/cli.js --spec ./sample-spec.txt --boilerplate ../code-boilerplate --out ./tmp/run-1
```

**Expected**: each value appears pre-filled from the flag; pressing Enter on all three, then
confirming, proceeds with exactly those values. Re-run and deliberately edit one value at its
prompt — the edited value, not the original flag, is what the run actually uses.

## Scenario 3 — Non-interactive with all flags: no prompt at all (validates FR-006)

```bash
node dist/cli.js --spec ./sample-spec.txt --boilerplate ../code-boilerplate --out ./tmp/run-2 < /dev/null
```

**Expected**: proceeds straight to PLAN with zero prompts — piping `/dev/null` into stdin
simulates a non-interactive invocation the same way a CI runner would produce.

## Scenario 4 — Live phase/task progress (validates US2, SC-003)

Run Scenario 2 and watch the terminal instead of only inspecting artifacts afterward.

**Expected**: a distinct status line/spinner for PLAN, then for each GENERATE task by name as it
starts and finishes, then for VALIDATE (including a visible repair-attempt counter if any file
needs repair), then REPORT — all live, not batched at the end. `<out>/.codegen-agent/plan.md`,
`log.jsonl`, and `report.md` are byte-for-byte the same shape spec 001 already produces (FR-010)
— confirm by diffing a run's `report.md` against the format documented in spec 001's
`data-model.md`.

## Scenario 5 — Import aliases (validates US3, SC-004)

```bash
grep -rn 'from "\.\./' src/ tests/
```

**Expected**: no results — every remaining relative import is same-directory (`./...`) or
`src/cli.ts`'s own top-level position; every cross-directory import uses `@/...`.

## Scenario 6 — No OpenAI references (validates US3, SC-005)

```bash
grep -rni "openai" CLAUDE.md README.md docs/ 2>/dev/null
```

**Expected**: either no results, or only results explicitly stating OpenAI is *not* supported
(never wording implying it is).

## Automated equivalent (no tokens spent, no real terminal needed)

```bash
npm run typecheck
npm test        # includes tests/unit/collectInputs.test.ts, tests/unit/progress.test.ts
npm run test:e2e  # existing suite, now exercising the non-interactive path via FR-006
```
