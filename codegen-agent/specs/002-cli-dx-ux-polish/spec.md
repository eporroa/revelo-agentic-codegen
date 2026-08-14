# Feature Specification: codegen-agent CLI DX/UX Polish

**Feature Branch**: `[002-cli-dx-ux-polish]`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "codegen-cli DX and UX enhancements, based on the information from the spec 001-codegen-agent-cli, let's update the application with some enhancements for the UI of the CLI and how the code can be improved: (1) using tsconfig path aliases (@/* -> src/*) throughout the codebase instead of relative imports; (2) using @clack/prompts to interactively confirm or collect --spec/--boilerplate/--out — pre-filled from flags when supplied, prompted when missing; (3) a live UI showing which phase/task the agent is currently on, with loading indicators and status messages; (4) verify no OpenAI references remain anywhere in the codegen-agent app."

## Clarifications

### Session 2026-08-14

- Q: When a flag's value is pre-filled into its confirmation prompt, can the developer edit it, or is it accept-only? → A: Pre-filled by default (the "autocomplete" behavior), but the developer can edit the value before confirming if it's wrong.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirm inputs before spending tokens (Priority: P1)

A developer runs `codegen-agent` — whether they passed all three required flags, some of them, or
none — and is walked through an interactive step that shows the resolved `--spec`,
`--boilerplate`, and `--out` values (pre-filled from any flags that were supplied) and prompts
for whichever ones are still missing, requiring one explicit confirmation before the run
actually starts.

**Why this priority**: This is the single highest-leverage change here — it catches a mistyped
path before the run spends real LLM tokens on it, which matters directly to a project that
already treats cost as a first-class concern (spec 001's token/cost reporting).

**Independent Test**: Run the CLI with zero flags and confirm it walks through prompting for
all three inputs one at a time. Separately, run it with all three flags supplied and confirm it
shows a single confirmation step (not a silent pass-through) before PLAN starts.

**Acceptance Scenarios**:

1. **Given** no flags are passed, **When** the CLI starts, **Then** it prompts for `--spec`,
   `--boilerplate`, and `--out` one at a time, and does not begin PLAN until all three are
   provided or the developer cancels.
2. **Given** all three flags are passed on the command line, **When** the CLI starts, **Then**
   it displays the resolved values, pre-filled as the default answer that the developer can
   edit if it's wrong, and requires a single confirmation before continuing — it does not skip
   straight into PLAN.
3. **Given** some flags are passed and others aren't, **When** the CLI starts, **Then** it only
   prompts for the missing ones, while still showing the supplied ones for confirmation.
4. **Given** the developer cancels at the confirmation step, **When** that happens, **Then** the
   CLI exits cleanly — nothing is written to `--out`, and no LLM call has been made.

---

### User Story 2 - See what phase and task the agent is on right now (Priority: P2)

A developer watches the terminal while a run is in progress and can tell, at a glance, which of
the four phases (PLAN, GENERATE, VALIDATE, REPORT) is currently active — and during GENERATE,
which specific task is being worked on — via a live status line and loading indicator, instead
of a terminal that looks frozen for minutes at a time.

**Why this priority**: A multi-minute run made of several sequential LLM calls currently gives
no live feedback; this makes the plan → generate → validate → report structure spec 001 already
built visible *while it's happening*, not just afterward in `plan.md`/`report.md`.

**Independent Test**: Run the CLI against a real spec and watch the terminal — each phase
transition should produce a distinct, identifiable status update, and each GENERATE task should
show its own start/finish indicator without waiting for the whole run to end.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** it enters PLAN, GENERATE, VALIDATE, or REPORT, **Then**
   a distinct status message identifies the newly active phase.
2. **Given** GENERATE is active, **When** each task starts and finishes, **Then** the terminal
   shows that task's description and whether it succeeded, live — not batched until the end.
3. **Given** VALIDATE is repairing a file, **When** a repair attempt runs, **Then** the terminal
   shows which attempt number (out of the bounded max) is in progress.

---

### User Story 3 - Navigate the codebase without deep relative imports (Priority: P3)

A developer maintaining `codegen-agent`'s own source can import any module via a `@/`-prefixed
path relative to `src/`, instead of counting `../` segments — and can trust that the project's
own documentation doesn't claim OpenAI support that doesn't exist in the code.

**Why this priority**: Pure internal maintainability and documentation accuracy — valuable, but
it changes nothing a CLI user observes at runtime, so it's the lowest priority of the three.

**Independent Test**: Search `src/` and `tests/` for relative imports that cross more than one
directory level — after this change, none should remain outside `src/cli.ts`'s own top-level
entry. Search all project documentation for "OpenAI" — after this change, any remaining mention
only appears in the context of explaining it is *not* supported.

**Acceptance Scenarios**:

1. **Given** the codebase after this change, **When** searching `src/` and `tests/` imports,
   **Then** no cross-directory import uses relative `../` syntax — all such imports use the
   `@/` alias instead.
2. **Given** the project's documentation, **When** it describes supported LLM providers,
   **Then** it accurately states Claude and Gemini only.
3. **Given** the change is complete, **When** `npm run typecheck && npm test && npm run
   test:e2e` runs, **Then** all pass exactly as before — this story changes import paths and
   doc text only, never runtime behavior.

---

### Edge Cases

- What happens when only some required flags are supplied? The prompt flow asks only for the
  missing ones, while still confirming the supplied ones (User Story 1, Acceptance Scenario 3).
- What happens when a path entered interactively doesn't exist or isn't readable? The same
  validation spec 001 already requires (FR-001–FR-003 there) applies — surfaced through the
  interactive flow rather than a silent process exit.
- What happens when the CLI is run without an interactive terminal attached (e.g., piped into a
  script or run in CI)? It must not hang waiting for input it can never receive.
- What happens if the developer cancels mid-prompt (e.g., Ctrl+C)? The CLI exits cleanly with
  nothing written to `--out`, matching spec 001's precondition-failure contract.
- What happens to `plan.md`, `log.jsonl`, and `report.md`? Unchanged — this feature only adds a
  terminal UI layer; it does not alter any persisted artifact from spec 001.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST detect whether each required input (`--spec`, `--boilerplate`,
  `--out`) was supplied on the command line.
- **FR-002**: For any required input not supplied via flag, the CLI MUST prompt for it
  interactively before proceeding.
- **FR-003**: For any required input that was supplied via flag, the CLI MUST still display it,
  pre-filled as the default, editable answer, and require one explicit confirmation before
  proceeding — never silently trusting a flag value without showing it back to the developer,
  and never locking it from being corrected if it's wrong.
- **FR-004**: The CLI MUST NOT begin PLAN until all three required inputs are confirmed.
- **FR-005**: If the developer cancels the interactive flow at any point, the CLI MUST exit
  without writing anything to `--out` and without making any LLM call.
- **FR-006**: When no interactive terminal is attached and all three required flags are
  supplied, the CLI MUST skip the interactive confirmation and proceed directly, so scripted or
  CI-style invocations never hang waiting for input.
- **FR-007**: The CLI MUST display which of the four phases (PLAN, GENERATE, VALIDATE, REPORT)
  is currently active, updated at each phase transition.
- **FR-008**: During GENERATE, the CLI MUST show live progress per task — at minimum, when a
  task starts and when it finishes (success or failure) — without waiting for the whole run to
  complete before showing anything.
- **FR-009**: During VALIDATE's repair loop, the CLI MUST show which repair attempt (of the
  bounded maximum) is currently in progress, for which file.
- **FR-010**: All progress and status output MUST be additive terminal UI only — it MUST NOT
  change the content or format of `plan.md`, `log.jsonl`, or `report.md`.
- **FR-011**: The codebase's own module imports (within `src/` and `tests/`) MUST use a
  `@/`-prefixed path alias resolving to `src/`, instead of multi-level relative (`../../`)
  imports, wherever an import crosses a module or directory boundary.
- **FR-012**: The alias MUST resolve correctly in every way the CLI is actually run — under the
  development runner and under the compiled output run with plain `node` — so this is never a
  dev-only convenience that breaks the built artifact.
- **FR-013**: Project documentation that describes supported LLM providers (including, at
  minimum, `CLAUDE.md` and `README.md`) MUST state only Claude and Gemini, with no wording that
  implies OpenAI is supported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer running the CLI with zero flags can supply all required inputs and
  reach a confirmed, ready-to-run state through a single guided flow, without needing to already
  know the CLI's flag syntax.
- **SC-002**: A developer running the CLI with all flags supplied sees and confirms the exact
  paths that will be used before any file is written or any LLM call is made.
- **SC-003**: At any point during a run, a developer watching the terminal can identify the
  current phase (plan/generate/validate/report) at a glance, without opening any log file.
- **SC-004**: 100% of the codebase's cross-directory internal imports use the alias rather than
  relative paths, verified by a repository-wide search after the change.
- **SC-005**: No project documentation describes OpenAI as a supported provider, verified by a
  repository-wide search after the change.
- **SC-006**: The full existing automated test suite (unit and integration) continues to pass
  with zero behavior regressions after these changes.

## Assumptions

- "Autocomplete" means a flag's value becomes the prompt's pre-filled, editable default — the
  developer accepts it with Enter or overwrites it if it's wrong (confirmed in Clarifications
  above) — not filesystem path autocompletion/browsing, which is out of scope.
- Non-interactive detection uses whether an interactive terminal is attached (standard practice
  for CLI tools built on prompt libraries) — no new flag (e.g. `--yes`) is introduced; `--force`
  from spec 001 continues to govern destination-overwrite behavior only, unrelated to this
  input-confirmation flow.
- This feature is presentation-layer and internal-structure only: it does not change PLAN,
  GENERATE, VALIDATE, or REPORT's actual behavior, spec 001's functional requirements, or any
  persisted artifact's content — only how the CLI collects input and what it prints while
  running, plus internal import style and documentation accuracy.
- "No OpenAI references" means no wording implying OpenAI is a supported provider. Documentation
  that explicitly states OpenAI is *not* supported (as spec 001's clarification record already
  does, intentionally) is not a violation and is out of scope to remove.
- The existing automated test suite from spec 001 is the regression baseline for this feature;
  this feature does not need new automated coverage beyond confirming that suite still passes,
  except for validating the new interactive/progress behavior itself.
