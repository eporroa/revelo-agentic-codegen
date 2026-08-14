# Contract: ProgressReporter

The seam that lets `planner/`, `generator/`, and `validator/` report live status without
depending on `@clack/prompts` directly, or changing their existing unit tests (FR-007–FR-009,
research.md's testing decision).

```ts
// src/ui/progress.ts
export type Phase = "plan" | "generate" | "validate" | "report";

export interface ProgressReporter {
  phaseStart(phase: Phase): void;
  phaseEnd(phase: Phase, ok: boolean): void;
  taskStart(taskId: string, description: string): void;
  taskEnd(taskId: string, status: "completed" | "failed"): void;
  repairAttempt(taskId: string, file: string, attempt: number, max: number): void;
}
```

## Injection contract

- `generator/index.ts`'s `GeneratorDeps` and `validator/index.ts`'s `ValidatorDeps` each gain an
  **optional** `progress?: ProgressReporter` field. `planner/index.ts` deliberately does **not**
  — its bounded retry loop doesn't map onto `taskStart`/`taskEnd`/`repairAttempt`'s shapes
  (neither a generated task nor a per-file repair), and PLAN is reported at the phase level only
  (`cli.ts` wraps the whole `createPlan()` call with `phaseStart`/`phaseEnd`). Adding an unused
  field to `PlannerDeps` would be dead code; this correction was made during `/speckit-implement`
  (see spec 002's task T005).
- When omitted, each module falls back to `noopProgressReporter` (`src/ui/noopProgress.ts`) — a
  `ProgressReporter` whose every method is a no-op. This is what spec 001's existing unit tests
  continue to use implicitly (by simply not passing `progress`), so none of them need to change.
- `cli.ts` is the only caller that constructs the real, `@clack/prompts`-backed
  implementation, and only when `process.stdin.isTTY` (or equivalent — see
  [input-collection.md](./input-collection.md)) indicates an interactive terminal is attached;
  otherwise it still passes the no-op, keeping non-interactive runs' output clean for piping/CI.

## Behavioral contract

- Every method is fire-and-forget (`void`, never `Promise`) — a `ProgressReporter` MUST NOT be
  able to slow down or fail a run. A throwing implementation is a bug in the reporter, never a
  reason for `generateTask`/`validateAndRepair` to fail.
- Calling a `ProgressReporter` method MUST NOT write to, or otherwise affect, `plan.md`,
  `log.jsonl`, or `report.md` (FR-010) — it is presentation only, reading state that already
  exists, never a second writer of persisted state.
- `phaseEnd`/`taskEnd` are always called after their matching `phaseStart`/`taskStart` for the
  same identifier — a reporter implementation may assume start/end are paired and never
  interleaved for the same `taskId`, since `generator/index.ts` processes tasks strictly
  sequentially (spec 001's dependency-ordered walk).
