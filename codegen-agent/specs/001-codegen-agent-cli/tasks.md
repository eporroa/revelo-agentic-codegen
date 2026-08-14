---

description: "Task list for codegen-agent CLI implementation"
---

# Tasks: codegen-agent CLI

**Input**: Design documents from `/specs/001-codegen-agent-cli/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — plan.md's Testing Approach explicitly requires unit tests for `planner/`
and `validator/`'s retry-bounding logic, plus a mocked-LLM end-to-end integration test.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to `codegen-agent/` unless stated otherwise

## Path Conventions

Single CLI project, per plan.md's Project Structure: `src/`, `tests/` at the `codegen-agent/`
package root (this repo's root — not nested under `specs/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization

- [X] T001 Create project skeleton directories per plan.md Project Structure
      (`src/{planner,llm,tools,generator,validator,reporter,prompts,cost}`,
      `tests/{unit,integration,fixtures}`) in `codegen-agent/`
- [X] T002 Initialize `codegen-agent/package.json`: `type: module`, scripts (`build`, `dev`,
      `typecheck`, `test`, `test:e2e`), dependencies (`commander`, `dotenv`, `zod`,
      `@anthropic-ai/sdk`, `@google/genai`), devDependencies (`typescript`, `vitest`,
      `@types/node`, `tsx`)
- [X] T003 [P] Configure `codegen-agent/tsconfig.json` (strict TypeScript 5.7, Node 20 target,
      matching the boilerplate's own strictness conventions per research.md)
- [X] T004 [P] Configure `codegen-agent/vitest.config.ts` covering both `tests/unit` and
      `tests/integration`
- [X] T005 [P] Add `codegen-agent/.env.example` documenting `LLM_PROVIDER`, `LLM_MODEL`,
      `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Define `Task`/`Plan`/`GenerationStep`/`ValidationResult`/`RunReport` types + zod
      schemas in `src/planner/types.ts` (data-model.md)
- [X] T007 [P] Define the `LLMProvider`/`LLMUsage`/`LLMResponse` interface in
      `src/llm/types.ts` (contracts/llm-provider.md)
- [X] T008 [P] Implement the Claude provider in `src/llm/anthropic.ts` (implements
      `LLMProvider`, captures `usage.input_tokens`/`output_tokens`)
- [X] T009 [P] Implement the Gemini provider in `src/llm/gemini.ts` (implements
      `LLMProvider`, captures `usageMetadata`)
- [X] T010 Implement the provider factory `getProvider()` in `src/llm/index.ts`, reading
      `LLM_PROVIDER`/`LLM_MODEL` from `.env` and failing fast with a clear message on a
      missing/invalid API key (depends on: T007, T008, T009)
- [X] T011 [P] Implement the run log writer in `src/tools/runLog.ts` — appends one
      `GenerationStep` JSON line to `<out>/.codegen-agent/log.jsonl` per call (depends on: T006)
- [X] T012 [P] Implement `src/tools/writeFile.ts` (writes a file, logs via `runLog`)
- [X] T013 [P] Implement `src/tools/readFile.ts` (reads a file, logs via `runLog`)
- [X] T014 [P] Implement `src/tools/runShell.ts` — restricted to `install`/`typecheck`/`test`,
      via `node:child_process.execFile`, cwd = `--out`, logs exit code + stdout/stderr
- [X] T015 Implement `src/tools/callLLM.ts` — wraps the active `LLMProvider.generate()` with
      bounded retry-with-backoff (max 3 attempts, FR-016) and logs via `runLog` (depends on:
      T010, T011)
- [X] T016 [P] Implement `src/cost/index.ts` — static per-model `$/1K tokens` pricing table +
      a usage-aggregation helper (research.md)
- [X] T017 Implement `src/cli.ts` skeleton: `commander` arg parsing
      (`--spec`/`--boilerplate`/`--out`/`--force`) plus preconditions (spec readable,
      boilerplate has `typecheck`/`test` scripts, `--out` empty or `--force`) per
      contracts/cli.md (depends on: T006)
- [X] T018 Implement the boilerplate → `--out` recursive copy (`fs.cp`) in `src/cli.ts`,
      run immediately after preconditions pass (depends on: T017)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Generate a working app from a spec (Priority: P1) 🎯 MVP

**Goal**: The full plan → generate → validate pipeline runs end-to-end; the CLI produces a
working app in `--out`.

**Independent Test**: Run the CLI against `sample-spec.txt` + `../code-boilerplate`; confirm
`npm install && npm run dev` works in `--out` (quickstart.md Scenario 1).

### Tests for User Story 1 ⚠️

> Write these tests first; confirm they fail before the implementation tasks below make them pass.

- [X] T019 [P] [US1] Create `tests/fixtures/stub-spec.txt` and
      `tests/fixtures/stub-boilerplate/` (minimal `package.json` with stub `typecheck`/`test`
      scripts) for use by all integration tests. Also adds
      `tests/fixtures/stub-boilerplate-broken/` (test script always fails), reused by T036.
- [ ] T020 [P] [US1] Unit test: planner produces an ordered, dependency-respecting task graph
      from a stub spec, in `tests/unit/planner.test.ts`
- [ ] T021 [P] [US1] Unit test: validator's repair loop stops at max 3 attempts per file and
      reports the residual failure instead of looping forever, in
      `tests/unit/validator.test.ts`
- [ ] T022 [US1] Integration test: full CLI run against `tests/fixtures/` with `llm/` mocked,
      asserting `plan.md`/`log.jsonl`/`report.md` are all written and the exit code is correct;
      additionally, reading back `log.jsonl`, assert at least 95% of logged `callLLM` steps
      carry a `context` payload that excludes the full spec text and the full set of
      previously-generated files simultaneously (SC-003), in
      `tests/integration/cli.e2e.test.ts` (depends on: T019)

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement `src/prompts/plan.ts` — structured planning prompt template
      (spec text → task graph JSON matching the T006 zod schema)
- [X] T024 [P] [US1] Implement `src/prompts/generate.ts` — structured per-task generation
      prompt template (role + task + context block + target file's expected export signature +
      few-shot example drawn from the boilerplate's existing conventions + explicit "return
      only the file contents" constraint). Few-shot is style-only, no spec content (resolves
      analyze finding A2).
- [X] T025 [P] [US1] Implement `src/prompts/repair.ts` — structured repair prompt template
      (original task context + failing file + exact error output + "return a corrected full
      file")
- [X] T026 [US1] Implement `src/planner/index.ts`: spec text → `Task[]` via one scoped LLM call
      using `prompts/plan.ts` + `tools/callLLM`, zod-validates the response (re-prompting on a
      schema mismatch). On success, persists `<out>/.codegen-agent/plan.md`. If retries are
      exhausted or the validated result has zero tasks, throws a typed `PlanningFailedError`
      instead of returning a `Plan` (FR-005) (depends on: T006, T015, T023). Also validates
      dependsOn references and topologically orders tasks, re-prompting on a cyclic/dangling
      graph. plan.md is rendered as a static pre-generation snapshot (resolves analyze A1 in
      favor of the US2 reading — final task status lives in report.md, not plan.md).
- [X] T027 [US1] Implement `src/generator/index.ts`: walks `Task[]` in dependency order; per
      task, assembles scoped context (dependency file contents via `tools/readFile` + the
      target file's expected interface only — never the full spec or full codebase) using
      `prompts/generate.ts`, calls `tools/callLLM`, writes via `tools/writeFile`, updates task
      status (depends on: T012, T013, T015, T024). Leaves status `in_progress` after writing —
      validator (T028) sets the final completed/failed verdict.
- [X] T028 [US1] Implement `src/validator/index.ts`: runs typecheck + test via
      `tools/runShell`, parses failing files out of the output, and runs a bounded repair loop
      (max 3 attempts per file) that re-invokes `src/generator/index.ts` with
      `prompts/repair.ts` plus the exact error output, marking a task `failed` once exhausted
      (depends on: T014, T025, T027). Also sets every task's final completed/failed status
      (FR-017).
- [X] T029 [US1] Wire `src/cli.ts` orchestration: plan → generate → validate in sequence. If
      `planner/` throws `PlanningFailedError`, abort immediately and report the failure —
      `generator/` is never invoked (FR-005). Otherwise, process exits `0` only when
      validation finishes with zero unresolved failures (FR-015) (depends on: T018, T026,
      T027, T028)
- [ ] T030 [US1] Author `codegen-agent/sample-spec.txt` — the reference Car Inventory Manager
      spec (the deliverable input, per plan.md)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Inspect the plan before trusting the run (Priority: P2)

**Goal**: `plan.md` is a trustworthy, standalone artifact, written before generation starts and
unchanged by what happens afterward.

**Independent Test**: Open `<out>/.codegen-agent/plan.md` while generation is still running
(quickstart.md Scenario 2).

- [ ] T031 [P] [US2] Integration test: assert `plan.md` is fully written to disk before the
      first `writeFile`/`runShell` Generation Step is logged, in
      `tests/integration/cli.e2e.test.ts`
- [ ] T032 [US2] Refine `src/planner/index.ts`'s `plan.md` rendering so each task's execution
      order and dependencies read as prose, per data-model.md's Plan entity — not a raw dump of
      the `Task[]` array (depends on: T026)

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Review run outcome, cost, and residual failures (Priority: P3)

**Goal**: `report.md` honestly summarizes the run — completions, failures, repair attempts,
tokens, and cost.

**Independent Test**: quickstart.md Scenario 1 (clean success) and Scenario 3 (engineered
residual failure) both read back correctly from `report.md`.

- [ ] T033 [P] [US3] Unit test: reporter correctly aggregates `tasksCompleted`, `tasksFailed`,
      `filesWritten`, `tokenUsage`, and `estimatedCostUsd` from a synthetic run state, in
      `tests/unit/reporter.test.ts`
- [ ] T034 [US3] Implement `src/reporter/index.ts`: builds the Run Report from `Task[]`, the
      Run Log, and Validation Results; writes `<out>/.codegen-agent/report.md` (tasks, files,
      validation outcome, per-file repair-attempt counts, token usage, estimated cost) per
      data-model.md's Run Report (depends on: T016, T026, T027, T028)
- [ ] T035 [US3] Wire `src/reporter/index.ts` into `src/cli.ts` as the final orchestration
      step; the process exit code mirrors the report's outcome (FR-015) (depends on: T029, T034)
- [ ] T036 [P] [US3] Integration test: an engineered residual failure (a `stub-boilerplate`
      fixture variant with its `test` script disabled) produces a `report.md` that names the
      failure and repair-attempt count, and the CLI exits `1`, in
      `tests/integration/cli.e2e.test.ts`

**Checkpoint**: All three user stories independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T037 [P] Write `codegen-agent/README.md`: setup, architecture overview, design
      decisions/tradeoffs, cost-per-run estimate, what you'd improve (plan.md deliverable
      layout)
- [ ] T038 Run quickstart.md Scenario 1 against the real `../code-boilerplate` and commit the
      result as `codegen-agent/sample-output/`
- [ ] T039 Run quickstart.md Scenario 4 (modified spec — a renamed field plus an added filter)
      to verify FR-013/SC-005, and record the outcome in `README.md`
- [ ] T040 Final validation pass: `npm run typecheck && npm test && npm run test:e2e` all green
      in `codegen-agent/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 has no dependency on US2/US3.
  - US2 depends on `src/planner/index.ts` existing (built in US1, T026) — it refines that
    file's output rather than adding a new module, so it cannot start before US1's T026.
  - US3 depends on US1's `planner`/`generator`/`validator` (T026–T028) existing as its data
    source — it reads their output, it doesn't block them.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on other stories.
- **User Story 2 (P2)**: Starts after Foundational **and** after US1's T026 (it edits the file
  T026 creates) — not independently buildable before US1, but independently *testable* once
  built (quickstart.md Scenario 2 exercises only the plan-file behavior).
- **User Story 3 (P3)**: Starts after Foundational **and** after US1's T026–T028 (it reads
  their state) — same pattern: not independently buildable first, but independently testable
  via quickstart.md Scenario 3 once built.

### Within Each User Story

- Tests are written first and confirmed failing before the implementation tasks that follow.
- Types/prompts before the modules that use them.
- Story complete and checkpointed before moving to the next priority.

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel.
- Foundational: T006, T007, T008, T009, T011, T012, T013, T014, T016 in parallel (respect the
  explicit `depends on` notes for T010, T015, T017, T018).
- US1: T019–T021 (the three test-writing tasks) in parallel once fixtures exist; T023–T025
  (the three prompt templates) in parallel.
- US2: T031 has no code dependency on T032 and can run in parallel with it being written.
- US3: T033 and T036 in parallel with each other.
- Polish: T037 in parallel with T038/T039.

---

## Parallel Example: User Story 1

```bash
# Once T019 (fixtures) lands, run the three test-writing tasks together:
Task: "Unit test: planner produces an ordered, dependency-respecting task graph in tests/unit/planner.test.ts"
Task: "Unit test: validator's repair loop stops at max 3 attempts/file in tests/unit/validator.test.ts"
Task: "Integration test: full CLI run against tests/fixtures/ with llm/ mocked in tests/integration/cli.e2e.test.ts"

# The three prompt templates have no dependency on each other:
Task: "Implement src/prompts/plan.ts"
Task: "Implement src/prompts/generate.ts"
Task: "Implement src/prompts/repair.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 end-to-end against the real boilerplate.
5. This alone satisfies the constitution's core non-negotiables (task list before generation,
   discrete logged tool calls, bounded context, mandatory validation loop) and is a legitimate
   demo checkpoint.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate independently → this is the MVP.
3. US2 → validate independently (plan.md is trustworthy pre-generation).
4. US3 → validate independently (report.md is honest about cost and failures).
5. Polish → README, sample-output/, the modified-spec generalization check, final green run.

### Notes

- Commit after each task or logical group of tasks — this maps directly onto constitution
  principle VIII (small, narrated commits); the task IDs above (T001…T040) are the intended
  commit-message anchors.
- `[P]` tasks touch different files and have no unmet dependency — safe to parallelize or
  reorder freely among themselves.
- Every implementation task above cites the contract/data-model/research section it satisfies,
  so `/speckit-implement` (or manual implementation) never has to re-derive intent from spec.md
  alone.
