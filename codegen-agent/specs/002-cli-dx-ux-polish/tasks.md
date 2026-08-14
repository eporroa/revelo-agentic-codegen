---

description: "Task list for codegen-agent CLI DX/UX Polish implementation"
---

# Tasks: codegen-agent CLI DX/UX Polish

**Input**: Design documents from `/specs/002-cli-dx-ux-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — plan.md's Testing section requires unit coverage for the pure
`collectInputs` decision logic and for `ProgressReporter` call sequencing via a spy double.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to `codegen-agent/` unless stated otherwise

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add `@clack/prompts` dependency and `tsc-alias` devDependency to
      `package.json`; change the `build` script to `tsc -p tsconfig.json && tsc-alias -p
      tsconfig.json` (research.md's alias-mechanism decision)
- [X] T002 [P] Add `"baseUrl": "."` and `"paths": { "@/*": ["src/*"] }` to `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `ProgressReporter` seam every later story's modules plug into

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Define the `Phase` type and `ProgressReporter` interface in `src/ui/progress.ts`
      (contracts/progress-reporter.md)
- [X] T004 [P] Implement `noopProgressReporter` (every method a no-op) in
      `src/ui/noopProgress.ts` (depends on: T003)
- [X] T005 Add an **optional** `progress?: ProgressReporter` field to `GeneratorDeps` in
      `src/generator/index.ts` and `ValidatorDeps` in `src/validator/index.ts` — the field
      exists but nothing calls it yet, so existing unit tests for these modules require no
      changes (depends on: T003, T004). Deviation from plan.md: `PlannerDeps` deliberately does
      NOT get this field — planner's retry loop has no event shape that fits
      taskStart/taskEnd/repairAttempt; adding an unused field would be dead code. Corrected in
      contracts/progress-reporter.md too.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Confirm inputs before spending tokens (Priority: P1) 🎯 MVP

**Goal**: Interactive collection/confirmation for `--spec`/`--boilerplate`/`--out`, pre-filled
and editable when supplied via flag, prompted when missing.

**Independent Test**: quickstart.md Scenarios 1–3.

### Tests for User Story 1

- [X] T006 [P] [US1] Unit test: `missingFields()` correctly identifies which of
      spec/boilerplate/out are absent from a `FlagInputs` object, in
      `tests/unit/collectInputs.test.ts`
- [X] T007 [P] [US1] Unit test: `shouldPromptInteractively()` returns `false` only when
      `isTTY` is false **and** every field is present; `true` in every other case, in
      `tests/unit/collectInputs.test.ts`. Surfaced a real gap: Vite/Vitest doesn't read
      tsconfig.json's `paths` on its own — added `resolve.alias` to vitest.config.ts (anchored
      to `@/` via regex, not bare `@`, so scoped packages like `@clack/prompts` aren't
      accidentally matched). Not a task in the original plan; necessary for any `@/`-importing
      test to run at all.

### Implementation for User Story 1

- [ ] T008 [US1] Implement `missingFields()` and `shouldPromptInteractively()` as pure
      functions in `src/ui/collectInputs.ts` (contracts/input-collection.md) (depends on: T006,
      T007)
- [ ] T009 [US1] Implement `collectInputs()`: an `@clack/prompts` `text()` prompt per field
      (pre-filled via `initialValue` from the flag when supplied, editable per the 2026-08-14
      Clarification; blank when missing), followed by one `confirm()`; returns `"cancelled"` on
      cancel or decline; when non-interactive with missing fields, fails fast with a clear error
      instead of prompting, in `src/ui/collectInputs.ts` (depends on: T008)
- [ ] T010 [US1] Wire `collectInputs()` into `src/cli.ts`'s `run()`, called before
      `validatePreconditions`/`copyBoilerplate`; on `"cancelled"`, exit `1` with nothing written
      to `--out` and no LLM call made (FR-005) (depends on: T009)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - See what phase and task the agent is on right now (Priority: P2)

**Goal**: Live phase/task progress in the terminal via the `ProgressReporter` seam.

**Independent Test**: quickstart.md Scenario 4.

### Tests for User Story 2

- [ ] T011 [P] [US2] Unit test: a spy `ProgressReporter` receives `phaseStart`/`phaseEnd` for
      plan, generate, validate, and report, in that order, in `tests/unit/progress.test.ts`
- [ ] T012 [P] [US2] Unit test: a spy `ProgressReporter` receives `taskStart`/`taskEnd` for
      each task during `generateAll`, and `repairAttempt` during `validateAndRepair`'s repair
      loop, in `tests/unit/progress.test.ts`

### Implementation for User Story 2

- [ ] T013 [P] [US2] Implement the `@clack/prompts`-backed `ProgressReporter` (a spinner per
      phase/task, `log.step` for repair attempts) in `src/ui/progress.ts` (depends on: T003)
- [ ] T014 [US2] Call `progress.taskStart`/`taskEnd` around each task in
      `src/generator/index.ts`'s `generateTask` (depends on: T005, T011, T012)
- [ ] T015 [US2] Call `progress.repairAttempt` in `src/validator/index.ts`'s repair loop
      (depends on: T005, T011, T012)
- [ ] T016 [US2] Call `progress.phaseStart`/`phaseEnd` around PLAN/GENERATE/VALIDATE/REPORT in
      `src/cli.ts`'s `run()`, constructing the real clack-backed reporter only when
      `process.stdin.isTTY`, otherwise the no-op (depends on: T013, T014, T015)

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Navigate the codebase without deep relative imports (Priority: P3)

**Goal**: `@/`-aliased imports throughout; documentation states only Claude + Gemini.

**Independent Test**: quickstart.md Scenarios 5–6.

- [ ] T017 [P] [US3] Migrate every cross-directory relative import (`../...`) in `src/` to the
      `@/...` alias — `src/cost/index.ts`, `src/generator/index.ts`, `src/planner/index.ts`,
      `src/tools/callLLM.ts`, `src/tools/runLog.ts`, `src/tools/types.ts`,
      `src/reporter/index.ts`, `src/validator/index.ts` (the full list from the repo-wide grep
      done during `/speckit-specify`)
- [ ] T018 [P] [US3] Migrate every relative import (`../../src/...`) in `tests/` to the
      `@/...` alias — `tests/unit/planner.test.ts`, `tests/unit/reporter.test.ts`,
      `tests/unit/validator.test.ts`, `tests/integration/cli.e2e.test.ts`
- [ ] T019 [US3] Correct `CLAUDE.md`'s Tech Constraints line from "swapping to OpenAI/Gemini"
      to "swapping to Gemini" (FR-013), matching the constitution's 1.1.0 amendment
- [ ] T020 [US3] Run quickstart.md Scenarios 5 and 6 (the `grep` checks) and confirm zero
      unwanted matches (depends on: T017, T018, T019)

**Checkpoint**: All three user stories independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T021 Final validation pass: `npm run typecheck && npm test && npm run test:e2e` all
      green — confirms zero behavior regression (SC-006)
- [ ] T022 [P] Add a short README.md section describing the new interactive/progress UX
- [ ] T023 Run quickstart.md Scenarios 1–4 manually against the real boilerplate to visually
      confirm the prompt/spinner UX — no automated test substitutes for actually watching the
      terminal

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002's alias config is what T003+ will use) —
  BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 has no dependency on US2/US3 — it never touches `ProgressReporter`.
  - US2 depends on Foundational's `ProgressReporter` seam (T003–T005), not on US1.
  - US3 (the import migration) touches files created/edited by Foundational, US1, and US2 —
    doing it last avoids migrating a file's imports twice.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on other stories.
- **User Story 2 (P2)**: Starts after Foundational. No dependency on US1 — could be built in
  parallel by a second developer.
- **User Story 3 (P3)**: Starts after Foundational, and is sequenced after US1/US2 so the
  import-alias sweep only has to touch each file once.

### Parallel Opportunities

- Setup: T001, T002 in parallel.
- Foundational: T003, T004 in parallel (T005 depends on both).
- US1: T006, T007 in parallel; T008 depends on both.
- US2: T011, T012 in parallel; T013 in parallel with the tests (different file).
- US3: T017, T018 in parallel (disjoint file sets).
- Polish: T022 in parallel with T021/T023.

---

## Parallel Example: Foundational + User Story 1 kickoff

```bash
# Foundational, once Setup lands:
Task: "Define Phase type and ProgressReporter interface in src/ui/progress.ts"
Task: "Implement noopProgressReporter in src/ui/noopProgress.ts"

# US1 tests, once Foundational completes:
Task: "Unit test: missingFields() in tests/unit/collectInputs.test.ts"
Task: "Unit test: shouldPromptInteractively() in tests/unit/collectInputs.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md Scenarios 1–3 — the interactive confirm flow alone
   is the highest-leverage change (catches a mistyped path before real tokens are spent) and is
   a legitimate standalone demo checkpoint.

### Incremental Delivery

1. Setup + Foundational → the `ProgressReporter` seam exists, unused.
2. US1 → validate independently → MVP.
3. US2 → validate independently (live progress, no interactive-flow change needed).
4. US3 → validate independently (codebase-only change, zero runtime behavior difference).
5. Polish → final green run, README note, manual UX pass.

### Notes

- Commit after each task or logical group — constitution principle VIII, same as spec 001.
- US3's import migration (T017/T018) is mechanical and low-risk, but touches many files — a
  clean `npm run typecheck && npm test && npm run test:e2e` after T017/T018 (don't wait for
  T021) is worth doing immediately, to catch any missed import before it compounds.
