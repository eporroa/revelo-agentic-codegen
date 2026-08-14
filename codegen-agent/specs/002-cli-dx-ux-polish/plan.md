# Implementation Plan: codegen-agent CLI DX/UX Polish

**Branch**: `002-cli-dx-ux-polish` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cli-dx-ux-polish/spec.md`

## Summary

Add an interactive input-collection/confirmation flow and a live phase/task progress UI to
`codegen-agent`'s existing CLI (both via `@clack/prompts`), switch the codebase's own internal
imports to a `@/`-prefixed alias resolving to `src/`, and correct stale documentation that still
implies OpenAI support. This is presentation-layer and internal-structure work only — PLAN,
GENERATE, VALIDATE, and REPORT's actual behavior, and the content of `plan.md`/`log.jsonl`/
`report.md`, are unchanged (spec.md's own scope boundary).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 20 LTS+ (unchanged from spec 001).

**Primary Dependencies**: `@clack/prompts` (interactive prompts, spinners, and status logging —
covers both the input-confirmation flow and the live progress UI with one library). `tsc-alias`
(devDependency) rewrites `@/` aliases to relative paths in the compiled output at build time —
see research.md for why this replaces the literally-requested `tsconfig-paths` package.

**Storage**: Unchanged (none) — this feature touches no persisted artifact's content.

**Testing**: Vitest, matching spec 001. Interactive prompts and live spinners aren't unit-tested
against a real TTY; instead, the pure decision logic (which fields are missing, whether to skip
the interactive flow) is unit-tested directly, and progress hooks are verified via a spy
`ProgressReporter` double rather than real terminal output. The existing mocked-`llm/`
integration suite continues to exercise the non-interactive path unchanged (see research.md).

**Target Platform**: Unchanged — local developer machine, Node.js CLI.

**Project Type**: Single CLI project (unchanged structure, additive modules only).

**Performance Goals**: Not applicable — this is a UI/DX change with no performance target of its
own; it must not measurably slow down a run (spinners/prompts are cheap relative to LLM calls).

**Constraints**: MUST NOT alter `plan.md`/`log.jsonl`/`report.md` content or format (FR-010).
MUST NOT hang when no interactive terminal is attached and all required flags are supplied
(FR-006). MUST work identically under `tsx` (dev) and compiled `node dist/cli.js` (FR-012).

**Scale/Scope**: Touches `src/cli.ts`'s entry flow, adds a small `src/ui/` module, and rewrites
import specifiers project-wide (~25 import statements across ~18 files) — no new business logic
modules beyond the UI layer itself.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Gate | Status |
|---|---|---|
| I. Explicit task decomposition | Unaffected | **PASS** — no change to planner/ or its output |
| II. Discrete, inspectable tool calls | Unaffected | **PASS** — FR-010 explicitly protects log.jsonl's content/format |
| III. Bounded context per step | Unaffected | **PASS** — no change to generator/'s prompt scoping |
| IV. Mandatory self-validation loop | Unaffected | **PASS** — no change to validator/'s repair loop |
| V. Reproducibility over cleverness | New deps must earn their weight | **PASS** — `@clack/prompts` is a purpose-built micro-library (not a framework) covering both US1 and US2 with one dependency; `tsc-alias` is a small, single-purpose build step. See research.md |
| VI. No hardcoding to the sample spec | Unaffected | **PASS** — no change to spec-handling code |
| VII. Cost and token transparency | Unaffected | **PASS** — FR-010 explicitly protects report.md's cost section |
| VIII. Small, narrated commits | Process, not architecture | Enforced during `/speckit-implement`, as before |

No violations requiring justification — Complexity Tracking is empty.

**Post-Phase-1 re-check**: data-model.md, contracts/, and quickstart.md introduced no new
dependency or shortcut beyond research.md's `@clack/prompts`/`tsc-alias` (the `tsconfig-paths`
substitution is a mechanism change, not an added dependency). All gates above still hold.

## Project Structure

### Documentation (this feature)

```text
specs/002-cli-dx-ux-polish/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── progress-reporter.md
│   └── input-collection.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root: `codegen-agent/`)

```text
codegen-agent/
├── src/
│   ├── cli.ts                   # extended: calls collectInputs() before PLAN, wires ProgressReporter into planner/generator/validator/reporter
│   ├── ui/
│   │   ├── collectInputs.ts      # @clack/prompts-based flag collection/confirmation (US1)
│   │   ├── progress.ts           # ProgressReporter interface + clack-backed implementation (US2)
│   │   └── noopProgress.ts       # no-op ProgressReporter — the default for planner/generator/validator's own unit tests
│   ├── planner/                  # unchanged behavior; index.ts gains an optional `progress` dep
│   ├── generator/                # unchanged behavior; index.ts gains an optional `progress` dep
│   ├── validator/                # unchanged behavior; index.ts gains an optional `progress` dep
│   ├── llm/ tools/ prompts/ reporter/ cost/   # unchanged behavior; imports migrated to `@/...`
│   └── ...
├── tests/
│   ├── unit/
│   │   ├── collectInputs.test.ts # NEW: missing-flag detection, TTY-skip decision (US1)
│   │   └── progress.test.ts      # NEW: ProgressReporter contract via a spy double (US2)
│   └── integration/               # existing suite, imports migrated to `@/...`, unchanged assertions
├── tsconfig.json                  # + baseUrl/paths (@/* -> src/*)
├── package.json                   # + @clack/prompts dep, + tsc-alias devDep, build script runs tsc-alias after tsc
└── CLAUDE.md                      # FR-013: "OpenAI/Gemini" corrected to "Gemini"
```

**Structure Decision**: Additive. A new `src/ui/` module owns everything interactive/visual;
`planner/`, `generator/`, `validator/` each take an *optional* `progress` dependency (default:
no-op) rather than importing `@clack/prompts` directly — keeping their existing unit tests
free of any TTY/terminal concern, exactly as spec.md's Assumptions require.

## Complexity Tracking

*No entries — Constitution Check has no violations to justify.*
