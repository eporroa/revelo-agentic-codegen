# Agentic Code Generation Workflow — Erik Porroa

> One-line pitch: an agent that plans, generates, and self-validates a React + TypeScript
> app from a natural-language spec, into an existing boilerplate.

## Repo layout

```
.
├── code-boilerplate/          # the provided React+TS+Vite+Apollo+MUI+MSW starter (untouched, copied per run)
├── codegen-agent/              # the agent source code (Track A)
│   ├── src/                    # planner/, llm/, tools/, generator/, validator/, reporter/, prompts/, cost/
│   ├── tests/                  # the agent's own unit + integration test suite
│   ├── specs/                  # spec-kit feature specs the agent itself was built from
│   ├── .env.example
│   └── README.md                # agent-specific dev notes (setup, architecture, tests)
├── specs/
│   ├── sample-spec.txt         # the Car Inventory Manager spec (agent input)
│   └── sample-spec-variant.txt # modified spec used to prove non-memorization
├── sample-output/               # a generated app produced by a real run — `npm install && npm run dev` works
│   └── .codegen-agent/          # that run's own artifacts: plan.md, log.jsonl, report.md
└── README.md                   # <- this file
```

## 1. Overview

`codegen-agent` reads a natural-language product spec, has an LLM decompose it into an ordered,
dependency-aware task list, walks that list generating one file at a time into a copy of an
existing React+TS+Vite boilerplate, then runs `tsc --noEmit` and the test suite and feeds any
failures back into a bounded per-file repair loop before writing a final report. It is not a
single "write me an app" prompt: every phase — plan, generate, validate, report — is a discrete,
logged step you can inspect independently. Known gaps today: the validator's failing-file
attribution is a best-effort regex over raw `tsc`/`vitest` output rather than a structured
parser (see [§8](#8-what-worked-well--what-id-improve)); there's no resume-from-partial-run
support; and the reference run committed in `sample-output/` still has 2 of 13 tasks marked
`failed` in its own repair-attempt accounting even though the combined typecheck/test suite it
produced passes in full (see [§7](#7-cost--performance-per-run)).

## 2. Quick start

```bash
cd codegen-agent
npm install
cp .env.example .env
# edit .env: set LLM_PROVIDER (anthropic or gemini, defaults to anthropic) and the matching API key
npm run build
node dist/cli.js --spec ../specs/sample-spec.txt --boilerplate ../code-boilerplate --out ../out
```

Then, separately, to run the *generated* app already committed at the repo root
(`sample-output/`, produced by a real run — its own run artifacts are at
`sample-output/.codegen-agent/`):

```bash
cd sample-output
npm install
npm run dev
```

Both were tested on a clean checkout before submitting: `sample-output` typechecks clean, its
full test suite passes (88/88), and `npm run dev` serves the app at `localhost:5173`.

## 3. Architecture overview

```
                     ┌─────────────┐
   spec.txt   ─────▶ │   planner   │  one scoped LLM call: full spec in, Task[] out
                     └──────┬──────┘
                            │ plan.md (written before any code exists)
                            ▼
                     ┌─────────────┐
                     │  generator  │  loop: per task → scoped prompt → LLM call → writeFile
                     │    loop     │  (dependency file contents only, never full spec/codebase)
                     └──────┬──────┘
                            │ log.jsonl (every write/shell/LLM call, logged as it happens)
                            ▼
                     ┌─────────────┐
                     │  validator  │  typecheck + test → on failure: repair prompt with the
                     │ (+ repair)  │  exact error output → re-validate, max 3 rounds/task
                     └──────┬──────┘
                            ▼
                     ┌─────────────┐
                     │  reporter   │  aggregates Task[] + Validation + token usage → report.md
                     └──────┬──────┘
                            ▼
                    generated app out (a real, installable React+TS app)
```

| Module | Responsibility | Why a separate module |
|---|---|---|
| `src/planner/` | Spec text → ordered, dependency-aware `Task[]`, via one zod-validated LLM call; renders `plan.md` | Isolates the one call that legitimately sees the whole spec, and the only place a dependency graph gets built/validated (cycle detection) |
| `src/llm/` | Provider-agnostic `LLMProvider` interface; Claude and Gemini implementations | Swapping providers must never touch the agent loop — this is the only file that knows about SDK specifics |
| `src/tools/` | Discrete, logged actions: `writeFile`, `readFile`, `runShell`, `callLLM` | This is where "discrete, inspectable tool calls" (constitution principle II) actually lives — every one of these appends a step to `log.jsonl` |
| `src/generator/` | Walks the task graph; one scoped prompt + one file write per target file | Owns context scoping (constitution principle III): gathers only a task's declared dependencies' file contents, never the whole codebase |
| `src/validator/` | Runs typecheck/test; bounded per-file repair loop on failure | Owns error recovery: isolates the failing-file parser, the repair budget, and the completed/failed verdict per task, independent of generation |
| `src/reporter/` | Aggregates the finished run into `report.md`, honest about residual failures | Pure, I/O-free aggregation — kept separate so it's cheap to unit test against synthetic run state |
| `src/prompts/` | The three structured prompt templates (plan / generate / repair) | Keeps prompt text reviewable and testable independent of the orchestration code that calls it |
| `src/cost/` | Per-model pricing table + usage aggregation, read back from `log.jsonl` | Cost reporting derives from the log (single source of truth) rather than an in-memory tally that could drift |

**Task decomposition** happens entirely in `src/planner/`: the one planning LLM call returns a
JSON task graph (id, description, `dependsOn`, `targetFiles`), which is topologically sorted and
cycle-checked before `plan.md` is written — generation never starts on an unordered or invalid
graph. **Discrete tool use** happens in `src/tools/`: every file write, shell command, and LLM
call is its own logged step in `log.jsonl`, never folded into one opaque completion.
**Context scoping** happens in `src/generator/`'s `gatherDependencyContext`: a task only ever
sees the file contents of the tasks it explicitly `dependsOn`, plus a style few-shot with no
spec-specific field names — never the full spec or full generated codebase after the initial
plan call. **Error recovery** happens in `src/validator/`: typecheck/test failures are attributed
to owning tasks, fed back into `buildRepairPrompt` with the exact error output, and re-validated,
bounded at 3 rounds per task.

Full design rationale — why this module split, why these dependencies and not others, why a
plain sequential pipeline instead of an agent framework — is in
[`codegen-agent/specs/001-codegen-agent-cli/research.md`](codegen-agent/specs/001-codegen-agent-cli/research.md).

## 4. Design decisions & tradeoffs

- **LLM providers**: Claude (`claude-sonnet-4-5`, default) and Gemini (`gemini-flash-latest`),
  selected via `.env`, behind a common `LLMProvider` interface (`codegen-agent/src/llm/types.ts`).
  No OpenAI in v1 — dropped explicitly during spec clarification rather than left ambiguous
  (constitution amendment 1.1.0). If cost/latency weren't a concern I'd default to
  `claude-opus-4-1` for generation quality on the harder repair rounds; the committed reference
  run used Gemini Flash specifically because it's the cheap end of the pricing table and still
  produced a working app.
- **No agent framework**: a plain sequential pipeline (plan → generate → validate → report)
  instead of LangChain/LangGraph/CrewAI/Mastra. The actual surface area needed — one LLM call per
  step, four discrete tools, a bounded retry loop — didn't earn a framework's abstraction
  overhead (constitution principle V). The whole orchestration fits in `cli.ts`'s `run()`
  function, readable top to bottom.
- **Context scoping per step**: the planning call sees the entire spec (it has to, to produce a
  task list) and nothing else. Every generate/repair call sees: the one task's description, its
  target file path, an expected-exports hint, a style few-shot with no spec-specific field
  names, and the file contents of only its declared dependencies. It never sees the full spec
  text, sibling tasks' output, or the rest of the generated codebase — kept small deliberately so
  cost stays predictable and repair prompts stay focused on the one failing file.
- **Repair loop bound**: max 3 repair attempts per task-file (constitution principle IV), tracked
  in a budget that's entirely separate from `callLLM`'s own max-3 transport-retry budget (timeout/
  rate-limit/5xx) — a flaky network blip never burns a task's code-quality repair budget and vice
  versa. On exhaustion, the task is marked `failed`, the exact last error is recorded, and the
  run still produces a `report.md` and exits non-zero rather than silently succeeding or looping
  forever.
- **Left out of scope**: auth, a real backend/database, and CI. The agent's only output is a
  static generated React+TS app written against the boilerplate's existing MSW-mocked GraphQL
  layer — per the constitution's Tech Constraints, this is explicitly the assessment's scope, not
  an oversight.

## 5. Prompt design

**Generate** (`codegen-agent/src/prompts/generate.ts`) — one file per call, scoped dependency
context only, a style-only few-shot, and a strict output-format instruction so the response body
can be written to disk directly:

```
You are the code-generation stage of an autonomous agent. Write exactly one file.

Task: ${taskDescription}
Target file: ${targetFile}
${expectedExports ? `Expected exports/interface: ${expectedExports}` : ""}

// Example of the expected style — a functional component with a typed
// props interface, MUI for presentation, and data access delegated to a
// custom hook rather than inlined: ...

Relevant existing files this task depends on:
--- ${depPath} ---
${depContents}

Return ONLY the complete contents of ${targetFile} — no markdown code fences, no
explanation, no surrounding prose. The response body IS the file.
```

**Repair** (`codegen-agent/src/prompts/repair.ts`) — the failing file's current contents plus the
exact validator output, asking for a corrected full file rather than a diff (simpler to apply,
no patch-format failure mode):

```
You are the repair stage of an autonomous code-generation agent. The file below was
generated for this task and failed validation. Fix it.

Task: ${taskDescription}
Target file: ${targetFile}

Current contents of ${targetFile}:
--- ${targetFile} ---
${currentContents}

Exact validation error output:
--- error output ---
${errorOutput}

Return ONLY the complete, corrected contents of ${targetFile} — no markdown code
fences, no explanation, no surrounding prose. The response body IS the file.
```

## 6. Validation & error recovery

After every task has generated its files, `validator/index.ts` runs `npm run typecheck` and
`npm test` once each (`runCheck`) and parses failing file paths out of the combined output
(best-effort regex, see [§8](#8-what-worked-well--what-id-improve)). For each task that owns a
currently-failing file: the failing file's current contents plus the validator lines that
mention that file are fed into `buildRepairPrompt`, the LLM's response overwrites the file, and
typecheck+test are re-run — up to 3 rounds per task. A task resolved within budget is marked
`completed`; one that still has a failing file after 3 rounds is marked `failed`, with its last
error output and repair-attempt count recorded verbatim in `report.md` — it does not leave a
silent `// TODO` marker, and it does not claim success. The CLI's exit code mirrors this: `0`
only if every task completed and the final typecheck/test both passed, `1` otherwise. A
secondary-LLM-review validation path (the constitution's principle IV allows this as an
alternative to typecheck/test) isn't implemented, since the boilerplate always provides a real
test suite in this project's scope.

## 7. Cost & performance per run

From the real run committed at `sample-output/.codegen-agent/` (`report.md`, `log.jsonl`) —
Gemini `gemini-flash-latest`, against `specs/sample-spec.txt`, 13 planned tasks:

| Metric | Value |
|---|---|
| LLM calls | 36 (`grep -c '"tool":"callLLM"' sample-output/.codegen-agent/log.jsonl`) |
| Tool calls total | 36 callLLM + 47 readFile + 37 writeFile + 29 runShell |
| Input tokens | 162,155 |
| Output tokens | 76,614 |
| Estimated cost | $0.2402 |
| Wall-clock time | ~6m37s (`plan.md` written 10:05:38 → `report.md` written 10:12:15) |
| Tasks completed / failed | 11 / 13 completed, 2 marked failed (repair budget exhausted) |
| Final typecheck / test | both passed |

The 2 tasks marked `failed` (T11, T12 — writing unit tests for `useCarFilters`/`CarFilters` and
for `CarList`/`CarCard`) burned their full 3-repair-attempt budget on UI-text-exact assertions
that took longer than the budget to converge; by the time validation ran its final pass, both
areas' tests actually passed as part of the combined suite — the task-level `failed` verdict is
a stricter, per-repair-round bookkeeping signal than "does the final app work," which is worth
noting as a known sharp edge (see [§11](#11-known-limitations)). `sample-output/` — the same
run's generated app — typechecks clean and passes 88/88 tests when installed fresh.

## 8. What worked well / what I'd improve

**Worked well**: keeping the plan/generate/validate/report artifacts as real files rather than
just log lines made the "not prompt-and-pray" claim something you can point at, not just assert
— `sample-output/.codegen-agent/plan.md` genuinely doesn't change after generation starts, and
`report.md` genuinely names its own residual failures. The transport-retry vs. validation-repair
budget split also paid off: it made the failure-reporting logic much easier to reason about once
the two concerns were disentangled, and it's directly visible in `log.jsonl` as two different
`attempt` counters that never interact.

**Would improve with more time**:
- The failing-file parser in `validator/index.ts` is a best-effort regex over raw `tsc`/`vitest`
  output — it works for the common single-file-per-error case but isn't a real parser, and it's
  the direct cause of the T11/T12 "failed but actually fine" bookkeeping gap in §7. A structured
  `tsc --noEmit --pretty false` / vitest JSON reporter would attribute failures more reliably and
  let a task's final status match the final combined test run rather than the last repair
  round's snapshot.
- `generator/index.ts` currently re-reads a dependency's file contents fresh for every target
  file in a task; for tasks with many target files, caching within `generateTask` would cut
  redundant `readFile` tool calls (and log noise) without changing behavior.
- No support yet for resuming a partially-completed run (explicitly out of scope per the spec's
  Assumptions) — for a longer-lived tool this would be worth revisiting.
- Responsive image handling (mobile/tablet/desktop breakpoints) is spec'd and the generated
  `CarImage` component does implement it, but it's validated only by typecheck/test, not a
  visual/viewport check — a Playwright-driven viewport screenshot test would close that gap.

## 9. Testing the agent itself

```bash
cd codegen-agent
npm run typecheck   # tsc --noEmit
npm test            # unit tests: planner ordering, validator repair-bounding, reporter aggregation — no network calls
npm run test:e2e    # integration test: full CLI loop against tests/fixtures/, llm/ mocked — no network calls
```

Current status on this checkout: 22/22 tests green (5 unit files / 17 tests + 1 integration file
/ 5 tests), typecheck clean. Unit tests cover `planner/` (topological ordering, cycle detection),
`validator/` (repair-loop bounding and resolution), `reporter/` (aggregation from synthetic run
state), and the interactive-input/progress-reporting UX. The integration test
(`tests/integration/cli.e2e.test.ts`) runs the full plan→generate→validate→report loop against
`tests/fixtures/stub-boilerplate` with a mocked `llm/` provider, asserting `plan.md` is written
before any generation step, that ≥95% of `callLLM` log entries omit the full spec+codebase at
once (context scoping, SC-003), and that an engineered unrecoverable failure produces an honest
`report.md` and exit code `1`. This is distinct from and doesn't exercise the generated app's own
test suite (that's `sample-output/`'s `npm test`, covered in §7).

## 10. Generalization proof

[`specs/sample-spec-variant.txt`](specs/sample-spec-variant.txt) is `specs/sample-spec.txt` with
the `color` field renamed to `paintColor` throughout (schema description, card display, and the
Add-Car form fields), plus an added requirement — "Also support filtering by paint color,
alongside the model search" — folded into the required-features list rather than left optional.
Nothing in `codegen-agent/src/` references `color`, `car`, `make`, or any other field/feature
name from the reference spec — the planner and generator prompts are built entirely from
whatever spec text is passed in, so this variant is a genuine test of spec-driven generation
rather than a check against a hardcoded reference app. To reproduce:

```bash
cd codegen-agent
node dist/cli.js --spec ../specs/sample-spec-variant.txt --boilerplate ../code-boilerplate --out ../out-variant
```

**Expected**: the generated app uses `paintColor` (not `color`) in its GraphQL documents, types,
card display, and Add-Car form, and includes a paint-color filter control alongside the model
search — proving generation followed *this* spec's text rather than pattern-matching the
committed `sample-output/`. This run wasn't executed for this submission (it spends real LLM
tokens against a live provider, same as the reference run in `sample-output/.codegen-agent/`) —
it's a documented, reproducible check per constitution principle VI, matching
[`codegen-agent/specs/001-codegen-agent-cli/quickstart.md`](codegen-agent/specs/001-codegen-agent-cli/quickstart.md)'s
Scenario 4.

## 11. Known limitations

- The validator's failing-file attribution is a best-effort regex over raw `tsc`/`vitest` output,
  not a structured parser — see §7/§8 for the concrete case (T11/T12) where this produced a
  task-level `failed` verdict for tests that actually pass in the final combined run.
- No resume-from-partial-run support — a killed or crashed run must be restarted from scratch
  (explicitly out of scope per the spec's Assumptions).
- No secondary-LLM-review validation path — only typecheck/test, since the boilerplate always
  provides a real test suite in this project's scope; the constitution allows either.
- The generalization proof (`specs/sample-spec-variant.txt`) is a documented manual check, not an
  automated CI assertion — running it spends real tokens against a live LLM provider, which the
  agent's own automated suite (§9) deliberately avoids by mocking `llm/`.
- `sample-output/.codegen-agent/log.jsonl` (~2MB) is the full, unredacted tool-call log for one
  real run, including full prompt/response text — useful for inspection, but not something a
  long-lived project would want to keep accumulating in git as-is.

---

## Commit history

`git log --oneline` (55 commits as of this submission) roughly follows the task list in
[`codegen-agent/specs/001-codegen-agent-cli/tasks.md`](codegen-agent/specs/001-codegen-agent-cli/tasks.md):
spec-kit scaffolding and constitution → planner → tools (log/write/read/shell/LLM) → generator →
validator → reporter → CLI wiring → the DX/progress-UX follow-up feature
(`002-cli-dx-ux-polish`) → this root-level sample run and documentation pass. Reading it top to
bottom tells the build story without needing extra narration.
