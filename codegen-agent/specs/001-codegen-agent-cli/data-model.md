# Phase 1 Data Model: codegen-agent CLI

Entities from [spec.md](./spec.md)'s Key Entities section, with concrete fields/relationships/
validation rules for implementation. These are the CLI's own in-memory/on-disk types — not a
database schema (this feature has no database).

## Spec

The natural-language input file. Not parsed into a rigid structure — passed to the planner as
raw text plus a source path.

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Resolved absolute path to the `--spec` file |
| `rawText` | `string` | Full file contents, read once |

**Validation rules**: `path` must exist and be readable, or the CLI exits before planning
(Edge Cases: unreadable spec path).

## Task

One planned unit of work. Produced by `planner/`, validated against a `zod` schema before the
plan is trusted (see [research.md](./research.md#structured-plantask-output-validation)).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable short id, e.g. `T01` |
| `description` | `string` | Human-readable summary, e.g. "define Car type" |
| `dependsOn` | `string[]` | Ids of tasks that must be `completed` first |
| `targetFiles` | `string[]` | Repo-relative paths this task is expected to write |
| `status` | `"pending" \| "in_progress" \| "completed" \| "failed"` | Per spec Clarifications; starts `pending` |
| `repairAttempts` | `number` | Count of post-validation repair attempts consumed (0–3, FR-010) |
| `apiRetries` | `number` | Count of transport-level LLM retries consumed for this task's calls (0–3, FR-016; does not share the budget with `repairAttempts`) |

**Validation rules**:
- `dependsOn` must reference only ids that exist elsewhere in the same Plan (no dangling
  references) and must not introduce a cycle (planner rejects/re-requests a cyclic plan).
- `status` transitions only forward: `pending → in_progress → (completed | failed)`. A task
  does not re-enter `pending` once started.

## Plan

The ordered collection of Tasks, persisted as Markdown before generation begins (FR-004).

| Field | Type | Notes |
|---|---|---|
| `tasks` | `Task[]` | In dependency-safe execution order (topological sort of `dependsOn`) |
| `createdAt` | `ISO 8601 string` | Timestamp plan was generated |
| `specPath` | `string` | Echoes the source Spec's path, for traceability |

**Relationships**: One Plan has many Tasks (1:N, owned — a Plan is only ever built from its own
task list). Persisted to `<out>/.codegen-agent/plan.md`; the in-memory `Plan` object is the
source of truth, `plan.md` is a rendering of it (research.md).

## Generation Step

A single logged, executed action taken while walking the Plan — one row in the Run Log.

| Field | Type | Notes |
|---|---|---|
| `taskId` | `string` | Which Task this step belongs to |
| `tool` | `"readFile" \| "writeFile" \| "runShell" \| "callLLM"` | Which discrete tool ran (FR-006) |
| `input` | `unknown` (tool-specific) | Exactly what was passed in — e.g. the scoped prompt + context for `callLLM` (FR-008) |
| `output` | `unknown` (tool-specific) | What the tool returned — e.g. file contents written, shell exit code + stdout/stderr |
| `timestamp` | `ISO 8601 string` | When the step ran |

**Relationships**: Many Generation Steps per Task (1:N). Every Generation Step is appended to
the Run Log as it happens (not batched).

## Run Log

The single append-only, structured file recording every Generation Step for a run (FR-007,
Clarifications).

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Always `<out>/.codegen-agent/log.jsonl` |
| Format | JSON Lines | One `Generation Step` (serialized) per line, appended as it happens — chosen so a crash mid-run doesn't corrupt already-written entries the way a single top-level JSON array would |

## Validation Result

The outcome of one typecheck/test run (FR-009).

| Field | Type | Notes |
|---|---|---|
| `command` | `"typecheck" \| "test"` | Which check produced this result |
| `passed` | `boolean` | |
| `rawOutput` | `string` | Full stdout+stderr, used to build repair prompts |
| `failingFiles` | `string[]` | Best-effort file paths parsed out of `rawOutput` (tsc/vitest both emit paths in failures) |

**Relationships**: A validation run produces one Validation Result for `typecheck` and one for
`test`. Each `failingFiles` entry drives a repair attempt against the corresponding Task
(bumping its `repairAttempts`, FR-010).

## Run Report

The final summary artifact (FR-012), persisted as `<out>/.codegen-agent/report.md`.

| Field | Type | Notes |
|---|---|---|
| `tasksCompleted` | `Task[]` | Final `status === "completed"` tasks |
| `tasksFailed` | `Task[]` | Final `status === "failed"` tasks, with their last error |
| `filesWritten` | `string[]` | Deduped union of every `writeFile` Generation Step's target path |
| `validation` | `{ typecheck: ValidationResult; test: ValidationResult }` | Final validation state after all repairs are exhausted |
| `repairSummary` | `{ taskId: string; attempts: number; resolved: boolean }[]` | Per spec Clarifications / FR-010 |
| `tokenUsage` | `{ provider: string; model: string; inputTokens: number; outputTokens: number }[]` | Per-call usage, aggregated per model |
| `estimatedCostUsd` | `number` | Sum of `tokenUsage` × the static pricing table (research.md) |
| `exitCode` | `0 \| 1` | Mirrors FR-015 |

**State transitions summary** (Task lifecycle, per spec Clarifications):

```text
pending --(generator picks up task, deps satisfied)--> in_progress
in_progress --(writeFile succeeds, no repair needed OR repair resolves it within 3 attempts)--> completed
in_progress --(3 repair attempts exhausted, OR 3 API retries exhausted with no successful call)--> failed
```
