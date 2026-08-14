# Quickstart: Validating codegen-agent

Runnable scenarios that prove this feature works end-to-end. See
[contracts/cli.md](./contracts/cli.md) for the exact flag contract and
[data-model.md](./data-model.md) for the artifacts referenced below.

## Prerequisites

- Node.js 20+, npm.
- A copy of the reference boilerplate (`../code-boilerplate` in this repo).
- `.env` in `codegen-agent/` with `LLM_PROVIDER=anthropic` (or `gemini`) and the matching API
  key — copy `.env.example` and fill it in.

## Setup

```bash
cd codegen-agent
npm install
```

## Scenario 1 — Reference spec produces a working app (validates SC-001, US1)

```bash
node dist/cli.js \
  --spec ./sample-spec.txt \
  --boilerplate ../code-boilerplate \
  --out ./tmp/reference-run

cd tmp/reference-run
npm install
npm run dev   # expect: app boots, Car Inventory Manager renders seeded cars
```

**Expected**: CLI exits `0`; `tmp/reference-run/.codegen-agent/report.md` shows all tasks
`completed`, typecheck and test both passed. `npm run dev` serves a working car list with
search-by-model and sort-by-year/make (the required scope from the spec's user-facing
functional target).

## Scenario 2 — Plan is inspectable before generation finishes (validates SC-002, US2)

Re-run Scenario 1's command, but in a second terminal — as soon as
`tmp/reference-run/.codegen-agent/plan.md` appears, open it without waiting for the run to
finish.

**Expected**: `plan.md` is a readable, ordered list of tasks with each task's dependencies
shown, matching what the finished run's `report.md` later says it executed — the plan doesn't
change retroactively.

## Scenario 3 — Report is honest about a residual failure (validates SC-004, US3)

Point `--boilerplate` at a deliberately broken copy of the boilerplate (e.g. one with its
`test` script renamed so validation cannot pass):

```bash
cp -r ../code-boilerplate /tmp/broken-boilerplate
# edit /tmp/broken-boilerplate/package.json: rename "test" script to "test:disabled"

node dist/cli.js \
  --spec ./sample-spec.txt \
  --boilerplate /tmp/broken-boilerplate \
  --out ./tmp/broken-run
echo "exit code: $?"
```

**Expected**: exit code `1`; `tmp/broken-run/.codegen-agent/report.md` explicitly names the
unresolved failure and the number of repair attempts spent — it does not claim success.

## Scenario 4 — Modified spec, not the reference one (validates SC-005, FR-013)

```bash
cp sample-spec.txt tmp/modified-spec.txt
# edit tmp/modified-spec.txt: rename "color" to "paintColor" throughout, and add
# "also support filtering by paint color" to the feature list

node dist/cli.js \
  --spec ./tmp/modified-spec.txt \
  --boilerplate ../code-boilerplate \
  --out ./tmp/modified-run

cd tmp/modified-run && npm install && npm run dev
```

**Expected**: the generated app reflects the renamed field and the added filter — proving the
CLI generated from *this* spec's text rather than pattern-matching the reference app. This
scenario is inherently a manual/documented check (it spends real LLM tokens against a
provider), not a cheap CI assertion — see `tests/integration/cli.e2e.test.ts` for the
tokens-free automated equivalent that only proves the orchestration loop, not real generation
quality.

## Automated equivalent (no tokens spent)

```bash
npm test        # unit tests: planner ordering, validator retry-bounding
npm run test:e2e  # integration test: full CLI loop against tests/fixtures/, llm/ mocked
npm run typecheck
```
