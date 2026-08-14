# Feature Specification: codegen-agent CLI

**Feature Branch**: `[001-codegen-agent-cli]`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Build a CLI tool called `codegen-agent` that takes a natural-language product specification (a text file) and autonomously generates a working React + TypeScript application into a pre-existing Vite boilerplate, without scaffolding a new project. Inputs: --spec <path>, --boilerplate <path>, --out <path>. Behavior, in order: 1. PLAN — read the spec and produce a structured, ordered, dependency-aware task list, persisted to disk. 2. GENERATE — execute tasks in dependency order, each task a discrete, scoped LLM call followed by an explicit file write; never one mega-prompt. 3. VALIDATE — run typecheck and test as shell tool calls, feed failures back into a bounded repair loop (max 3 attempts per failing file). 4. REPORT — a run summary: tasks completed, files written, validation results, retry count, approximate token usage and cost, and any unresolved failures."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a working app from a spec (Priority: P1)

A developer points the CLI at a natural-language product spec, a pre-built boilerplate
project, and a destination folder. The CLI produces a working React + TypeScript app in that
destination — the described features implemented, the app installable and runnable, without
the developer hand-writing or hand-fixing any code.

**Why this priority**: This is the entire reason the tool exists. Without a working generated
app at the end, nothing else in the system has value.

**Independent Test**: Run the CLI against the reference "Car Inventory Manager" spec and the
provided boilerplate. Success is fully verifiable by running `npm install && npm run dev` in
the output folder and confirming the described app is there and working — no other part of
the system needs to be exercised to validate this story.

**Acceptance Scenarios**:

1. **Given** a spec describing the Car Inventory Manager app and a valid boilerplate path,
   **When** the developer runs the CLI with `--spec`, `--boilerplate`, and `--out`, **Then** a
   new folder is created at `--out` containing a full copy of the boilerplate with the
   described features implemented, and the CLI reports that typecheck and tests passed.
2. **Given** the destination folder already contains a previous run's output, **When** the
   developer runs the CLI again without explicitly confirming an overwrite, **Then** the CLI
   refuses to silently overwrite it and reports that the destination is not empty.
3. **Given** the CLI reports success, **When** the developer runs `npm install && npm run dev`
   inside the generated app, **Then** it starts and serves the application described in the
   spec.

---

### User Story 2 - Inspect the plan before trusting the run (Priority: P2)

A developer wants to see the ordered, dependency-aware list of tasks the agent intends to
execute for a given spec, written to disk before generation starts, so the plan can be
reviewed and trusted independently of watching the run happen live.

**Why this priority**: This is what makes the tool demonstrably not a single-shot "prompt and
pray" system — the plan must exist and be inspectable as its own artifact, not just implied by
the final output.

**Independent Test**: Run the CLI (or its PLAN phase) against a spec and, without waiting for
generation to finish, open the persisted plan file. It should stand on its own as a readable,
ordered, dependency-aware task list.

**Acceptance Scenarios**:

1. **Given** a spec, **When** the CLI runs, **Then** a plan file is written to disk before any
   generation step starts, listing each task in execution order along with what it depends on.
2. **Given** the plan file, **When** the developer opens it after the run has finished, **Then**
   it still accurately reflects what was planned, independent of the live run.

---

### User Story 3 - Review run outcome, cost, and residual failures (Priority: P3)

A developer wants a clear end-of-run summary — which tasks completed, which files were
written, whether validation passed, how many repair attempts were used, how much the run cost,
and what (if anything) is still broken — so they can decide whether to trust or manually
address the output.

**Why this priority**: Self-validation and cost transparency are core guarantees of this
system; without a trustworthy report, a developer cannot tell a clean success from a run that
quietly gave up.

**Independent Test**: Run the CLI to completion (including a run engineered to leave a
residual failure, e.g. by pointing at an intentionally broken boilerplate) and confirm the
report accurately reflects the outcome without inspecting raw logs.

**Acceptance Scenarios**:

1. **Given** a run that fully succeeds, **When** it finishes, **Then** the summary lists all
   completed tasks, all files written, confirms typecheck/test passed, and reports approximate
   token usage and estimated cost.
2. **Given** a run where a generated file fails validation on all 3 repair attempts, **When**
   the run finishes, **Then** the summary explicitly names the failing file(s), the last error
   encountered, and the number of repair attempts used — the CLI does not report the run as
   fully successful.

---

### Edge Cases

- What happens when the spec file path doesn't exist or isn't readable?
- What happens when the boilerplate path doesn't exist, or is missing the expected
  `typecheck`/`test` scripts?
- What happens when `--out` already exists and is non-empty?
- How does the system handle a spec that describes fields or features not present in the
  boilerplate's existing mock schema (e.g., a renamed field, an added filter) — the agent must
  adapt rather than fail outright?
- How does the system handle an individual LLM call failing or timing out mid-generation for
  one task, without corrupting or silently abandoning the rest of the run?
- How does the system handle a file that still fails validation after all 3 repair attempts —
  it must be reported, not swallowed?
- How does the system handle a spec that omits optional features — the CLI should build only
  what's described, not assume unrequested extras?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST accept three required inputs: a path to a natural-language spec
  file, a path to a pre-built boilerplate project, and a destination path for the generated
  output.
- **FR-002**: The CLI MUST NOT scaffold a new project from scratch; it MUST generate into a
  copy of the provided boilerplate.
- **FR-003**: The CLI MUST refuse to write into a non-empty destination path unless the
  developer explicitly confirms an overwrite, to prevent silent data loss.
- **FR-004**: Before any code is generated, the CLI MUST produce an ordered, dependency-aware
  task list derived from the spec and persist it to disk in a durable, human-inspectable
  format.
- **FR-005**: The CLI MUST NOT begin code generation if task-list creation fails or produces no
  tasks.
- **FR-006**: Each generation step MUST correspond to one discrete unit of work (one file, or a
  tightly related set of files) and MUST be executed and logged as its own action — never
  combined with other steps into a single call.
- **FR-007**: Each generation step MUST be logged with both its inputs (the scoped context
  given to it) and its outputs (the file(s) written), independently inspectable after the run.
- **FR-008**: Context supplied to any single generation step MUST be limited to what that step
  needs — the relevant spec excerpt, the target file's expected interface/exports, and the
  contents of files it depends on — never the full spec plus the full generated codebase at
  once.
- **FR-009**: After generation, the CLI MUST run the project's typecheck and test commands as
  separate, logged actions.
- **FR-010**: When validation fails, the CLI MUST attempt to repair the specific offending
  file(s) using the relevant error output, up to a maximum of 3 attempts per file, before
  moving on.
- **FR-011**: If repair attempts are exhausted for a file, the CLI MUST report the residual
  failure explicitly rather than reporting the run as fully successful.
- **FR-012**: The CLI MUST produce a final run report including: tasks completed, files
  written, validation outcome, repair-attempt counts per file, approximate token usage,
  estimated cost, and any unresolved failures.
- **FR-013**: The CLI MUST work against specs that differ from any reference/sample spec (e.g.,
  renamed fields, added filters) without requiring changes to the CLI itself.
- **FR-014**: The CLI's LLM calls MUST go through a provider-agnostic interface so the
  underlying provider can be swapped without changing the CLI's plan/generate/validate flow.
- **FR-015**: The CLI MUST exit with a non-zero status when a run finishes with unresolved
  validation failures, and with a zero status when a run finishes fully successful.

### Key Entities *(include if feature involves data)*

- **Spec**: the natural-language input file describing the desired application.
- **Task**: one planned unit of work, with an identifier, description, dependencies, and
  status.
- **Plan**: the ordered collection of Tasks persisted to disk before generation begins.
- **Generation Step**: a logged, executed action that produced or modified one or more files,
  including its scoped input context and its output.
- **Validation Result**: the outcome of a typecheck/test run, including any failures and which
  file(s) they belong to.
- **Run Report**: the final summary artifact produced at the end of a CLI invocation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from a spec file to a running generated app (`npm install &&
  npm run dev` succeeds) without manually editing any generated file, for a spec matching the
  reference Car Inventory Manager description.
- **SC-002**: The task plan is visible and reviewable as a standalone artifact before
  generation begins, in 100% of runs.
- **SC-003**: For at least 95% of individual generation steps, the logged input context does
  not include the full spec and the full existing codebase simultaneously.
- **SC-004**: When validation fails, the run report names every unresolved failure and the
  exact number of repair attempts made, in 100% of runs.
- **SC-005**: A run using a modified spec (different field names or an added filter, not the
  original reference spec) still produces a working generated app, demonstrating the CLI is
  not hardcoded to one spec.
- **SC-006**: Every run reports an approximate token count and an estimated dollar cost,
  visible to the developer without inspecting raw logs.

## Assumptions

- The pre-built boilerplate already provides working `typecheck` and `test` npm scripts; the
  CLI relies on these rather than defining its own.
- Destination conflicts are resolved conservatively: the CLI does not overwrite a non-empty
  `--out` directory without explicit confirmation.
- The natural-language spec is unstructured free text; no fixed schema or front-matter is
  required of it.
- LLM provider selection follows the pluggable-provider approach already established in this
  project's constitution (Claude primary, OpenAI/Gemini swappable via a common interface).
- Token and cost figures are approximate, based on published per-token pricing for the
  configured model, not billed-invoice-accurate.
- This feature covers the CLI's plan/generate/validate/report pipeline only — no database,
  backend, authentication, or CI integration, consistent with the project's tech constraints.
- A single CLI invocation runs the full plan → generate → validate → report pipeline in one
  pass; resuming a partially completed run is out of scope for this feature.
