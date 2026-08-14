# Phase 1 Data Model: codegen-agent CLI DX/UX Polish

This feature introduces no new *persisted* entities (spec.md's Assumptions: no change to
`plan.md`/`log.jsonl`/`report.md`). The shapes below are in-memory/UI-flow only.

## Collected Inputs

The outcome of User Story 1's flow — what `cli.ts` has once collection/confirmation is done.

| Field | Type | Notes |
|---|---|---|
| `spec` | `string` | Absolute path, either from `--spec` (possibly edited during confirmation) or prompted |
| `boilerplate` | `string` | Same pattern as `spec` |
| `out` | `string` | Same pattern as `spec` |
| `source` | `{ spec: "flag" \| "prompted"; boilerplate: "flag" \| "prompted"; out: "flag" \| "prompted" }` | Per-field provenance, used only for the confirmation prompt's pre-fill vs. blank-prompt behavior — not persisted anywhere |

**Validation rules**: identical to spec 001's existing `validatePreconditions` — this feature
changes *how* the three values are collected, never what's required of them once collected.

## Phase

The four stages User Story 2 makes visible live.

```ts
type Phase = "plan" | "generate" | "validate" | "report";
```

No new concept — this names the four phases `cli.ts` (spec 001) already executes sequentially;
User Story 2 just narrates them as they happen.

## Progress Event

What `generator/`, `validator/`, and `cli.ts` report to a `ProgressReporter` (see
[contracts/progress-reporter.md](./contracts/progress-reporter.md)). Not a persisted entity —
purely an in-process call, with no on-disk representation (that remains `log.jsonl`'s job,
unchanged by this feature).

| Event | Fields | Fired by |
|---|---|---|
| Phase start/end | `phase: Phase`, `ok?: boolean` (end only) | `cli.ts`, at each phase transition |
| Task start/end | `taskId: string`, `description?: string` (start only), `status?: "completed" \| "failed"` (end only) | `generator/index.ts` |
| Repair attempt | `taskId: string`, `file: string`, `attempt: number`, `max: number` | `validator/index.ts` |

**Relationships**: A Progress Event never outlives the process — it's a live callback, not a
record. Its content is a strict subset of what's already captured more durably in `log.jsonl`'s
Generation Steps (data-model.md in spec 001) and `report.md`'s Run Report — this feature adds a
*view* of that same underlying activity, not a new source of truth.
