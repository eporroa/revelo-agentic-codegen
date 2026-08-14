# codegen-agent

An agentic CLI that takes a natural-language product spec and generates a working React +
TypeScript app into an existing Vite boilerplate — planning, generating, and self-validating
its own output, rather than making one LLM call and hoping for the best.

Built following a spec-driven process: see [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
for the non-negotiable principles this design is held to, and
[`specs/001-codegen-agent-cli/`](specs/001-codegen-agent-cli/) for the full spec, plan, and
task breakdown this implementation was built from.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set LLM_PROVIDER (anthropic or gemini, defaults to anthropic) and the matching API key
```

## Usage

```bash
npm run build
node dist/cli.js --spec ./sample-spec.txt --boilerplate ../code-boilerplate --out ./generated-app
# or, without building first:
npm run dev -- --spec ./sample-spec.txt --boilerplate ../code-boilerplate --out ./generated-app

cd generated-app
npm install
npm run dev
```

`--force` allows writing into a non-empty `--out` directory (refused by default, to avoid
silent data loss).

## Interactive UX

`--spec`/`--boilerplate`/`--out` are no longer strictly required flags. Run `codegen-agent`
with any subset of them (including none):

```bash
node dist/cli.js
```

Whatever's missing gets prompted for; whatever was supplied via flag shows up pre-filled and
editable — accept it with Enter or type over it if it's wrong — followed by one confirmation
before PLAN starts. This never triggers in a non-interactive context (CI, a pipe, a script)
when every required flag is already present — it just runs, exactly as before.

Once running, the terminal shows which phase is active (PLAN/GENERATE/VALIDATE/REPORT), a live
spinner for the task currently being generated, and a status line for each validation repair
attempt — instead of sitting silent for however long the LLM calls take.

See [`specs/002-cli-dx-ux-polish/`](specs/002-cli-dx-ux-polish/) for the full spec/plan/tasks
this was built from.

## Architecture

Four phases, run in strict order, each producing its own persisted, inspectable artifact under
`<out>/.codegen-agent/`:

```
PLAN  ──▶  plan.md      (ordered, dependency-aware task list — written before any code exists)
GENERATE ─▶ log.jsonl    (every file write / shell command / LLM call, logged as it happens)
VALIDATE ─▶ (typecheck + test, bounded repair loop, max 3 attempts per file)
REPORT  ──▶ report.md    (tasks completed/failed, files written, tokens, estimated cost)
```

| Module | Responsibility |
|---|---|
| `src/cli.ts` | Arg parsing, preconditions, orchestrates the four phases |
| `src/planner/` | Spec text → ordered `Task[]`, via one scoped LLM call, zod-validated |
| `src/llm/` | Provider-agnostic `LLMProvider` interface; Claude and Gemini implementations |
| `src/tools/` | Discrete, logged actions: `writeFile`, `readFile`, `runShell`, `callLLM` |
| `src/generator/` | Walks the task graph; one scoped prompt + one file write per task |
| `src/validator/` | Runs typecheck/test; bounded per-file repair loop on failure |
| `src/reporter/` | Aggregates the finished run into `report.md` |
| `src/prompts/` | The three structured prompt templates (plan / generate / repair) |
| `src/cost/` | Per-model pricing table + usage aggregation, read back from `log.jsonl` |

Every LLM call only ever sees a scoped slice of context — the task description, the target
file's expected shape, and the specific files it depends on — never the full spec plus the
full generated codebase in one call. The one exception is the planning call, which legitimately
needs the whole spec once, up front, to produce the task list; every call after that is scoped.

Full design rationale — why this module split, why these dependencies and not others, why a
plain sequential pipeline instead of an agent framework — is in
[`specs/001-codegen-agent-cli/research.md`](specs/001-codegen-agent-cli/research.md).

## Design decisions & tradeoffs

- **LLM providers**: Claude and Gemini, selected via `.env`, behind a common `LLMProvider`
  interface (`src/llm/types.ts`). No OpenAI support in v1 — dropped explicitly during spec
  clarification rather than left ambiguous.
- **No agent framework**: a plain sequential pipeline (plan → generate → validate → report)
  instead of LangChain/LangGraph/CrewAI. The actual surface area needed — one LLM call per
  step, a few discrete tools, a bounded retry loop — didn't earn a framework's abstraction
  overhead. See constitution principle V.
- **Plan/log/report formats**: `plan.md` and `report.md` are Markdown (human-readable without
  tooling, per the spec's Clarifications); `log.jsonl` is JSON Lines so a crash mid-run doesn't
  corrupt already-written entries.
- **Repair vs. retry are two separate, non-overlapping budgets**: a transport-level failure
  (timeout, rate limit, 5xx) gets up to 3 automatic retries in `tools/callLLM.ts` before a task
  is abandoned; a *validation* failure (typecheck/test) gets up to 3 repair attempts per file in
  `validator/index.ts`. These never share a counter — a flaky network blip doesn't burn a
  task's code-quality repair budget and vice versa.
- **No hardcoding to the reference spec**: nothing in `src/` references "car", "make", "model",
  or any other field/feature name from `sample-spec.txt`. The planning and generation prompts
  are built entirely from whatever spec text is passed in. See the modified-spec verification
  note below.

## Cost per run

Every run's `report.md` states its own measured token usage and estimated cost (pricing table
in `src/cost/index.ts`, applied to each provider's own reported usage). As a rough order of
magnitude for a spec the size of `sample-spec.txt` (~11-15 tasks): a real run against
`../code-boilerplate` (Gemini, `gemini-flash-latest`) completed 10/11 tasks, used roughly 122K
input / 50K output tokens, and cost about $0.16 — well under $1, with the one residual failure
being a genuinely hard task (writing UI-text-exact assertions) rather than a cost or
infrastructure problem. `sample-output/` (the committed generated-app deliverable) isn't in
this repo yet — the figures above are from a real run, not an estimate, but the artifact itself
is still pending.

## What worked well / what I'd improve with more time

**Worked well**: keeping the plan/generate/validate/report artifacts as real files rather than
just log lines made the "not prompt-and-pray" claim something you can point at, not just
assert. The transport-retry vs. validation-repair budget split also paid off — it made the
failure-reporting logic much easier to reason about once the two concerns were disentangled.

**Would improve with more time**:
- The failing-file parser in `validator/index.ts` is a best-effort regex over raw tsc/vitest
  output — it works for the common single-file-per-error case but isn't a real parser. A
  structured `tsc --noEmit --pretty false` / vitest JSON reporter would attribute failures more
  reliably.
- `generator/index.ts` currently re-reads a dependency's file contents fresh for every
  target file in a task; for tasks with many target files, caching within `generateTask` would
  cut redundant `readFile` tool calls (and log noise) without changing behavior.
- No support yet for resuming a partially-completed run (explicitly out of scope per the spec's
  Assumptions) — for a longer-lived tool this would be worth revisiting.
- A secondary-LLM-review validation path (the constitution's principle IV allows this as an
  alternative to typecheck/test) isn't implemented, since the boilerplate always provides a
  real test suite in this project's scope.

## Verifying it isn't hardcoded to the sample spec

Per the constitution's principle VI, this agent is expected to work against a spec that isn't
`sample-spec.txt` verbatim — see
[`specs/001-codegen-agent-cli/quickstart.md`](specs/001-codegen-agent-cli/quickstart.md)
("Scenario 4") for the exact steps (rename a field, add a filter, rerun). This is a manual/documented check
rather than an automated one — it spends real LLM tokens against a live provider, which the
automated test suite (`npm test && npm run test:e2e`) deliberately avoids by mocking `llm/`.

## Tests

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit tests (planner, validator, reporter) — no network calls
npm run test:e2e    # integration tests — full CLI loop, llm/ mocked, no network calls
```
