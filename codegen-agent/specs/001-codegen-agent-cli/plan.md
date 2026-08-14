# Implementation Plan: codegen-agent CLI

**Branch**: `001-codegen-agent-cli` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-codegen-agent-cli/spec.md`

## Summary

Build `codegen-agent`, a TypeScript/Node.js CLI that turns a natural-language product spec
into a working React + TypeScript app generated into an existing Vite boilerplate. The CLI
runs a strict four-phase pipeline — **plan → generate → validate → report** — where each phase
produces its own inspectable, persisted artifact (`plan.md`, `log.jsonl`, `report.md`) under
`<out>/.codegen-agent/`. Generation is file-by-file with scoped context, never one mega-prompt;
validation runs the boilerplate's own `typecheck`/`test` scripts and feeds failures back into a
bounded (max 3 attempts/file) repair loop; the LLM provider (Claude or Gemini) is selected via
`.env` config behind a common interface. This is the technical approach for the spec already
ratified in [spec.md](./spec.md) — no new product decisions are made here, only how to build it.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 20 LTS+ (matches the boilerplate's TS version;
Node 20 is the oldest LTS with stable `fs.cp`/`fs.cpSync` recursive copy used to clone the
boilerplate).

**Primary Dependencies**: `@anthropic-ai/sdk` (Claude), `@google/genai` (Gemini), `commander`
(CLI arg parsing/help text), `dotenv` (`.env` loading), `zod` (validates the LLM's structured
plan/task JSON before trusting it). Everything else (shell exec, recursive file copy, JSONL
logging) uses Node.js built-ins — see [research.md](./research.md) for why no heavier
dependency (execa, fs-extra, LangChain/LangGraph, etc.) is pulled in.

**Storage**: None (no database). Filesystem only: reads the spec file and boilerplate tree,
writes the generated app plus `.codegen-agent/{plan.md,log.jsonl,report.md}` run artifacts.

**Testing**: Vitest (same as the boilerplate) — unit tests for `planner/` and `validator/`'s
retry-bounding logic, plus an end-to-end integration test that runs the CLI against a stub
spec/boilerplate fixture with a mocked `llm/` client (no real tokens spent in CI).

**Target Platform**: Local developer machine (macOS/Linux/CI runner), Node.js CLI invoked via
`npm`/`node`; not deployed anywhere.

**Project Type**: Single CLI project (`src/` + `tests/`), source living in this feature's own
package at the repo root (`codegen-agent/`), generating *into* a separate boilerplate project
it does not own.

**Performance Goals**: Not a hard SLA — this is a developer-invoked, single-run tool, not a
service. The only binding time constraint is the constitution's bounded retry/repair counts
(max 3 each), which cap worst-case run length independent of wall-clock targets.

**Constraints**: Max 3 transport-level LLM retries per call (FR-016); max 3 validation-repair
attempts per failing file (FR-010); no database/backend/auth/CI (constitution tech constraints);
must not special-case the reference spec's field/feature names anywhere in code or prompts
(FR-013, SC-005).

**Scale/Scope**: One CLI invocation generates on the order of 10–20 files for the reference Car
Inventory Manager scope; not designed for concurrent runs or large-N file counts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Gate | Status |
|---|---|---|
| I. Explicit task decomposition | `planner/` MUST produce the full task list before `generator/` writes anything | **PASS** — `cli.ts` orchestration calls planner → persist `plan.md` → only then generator runs |
| II. Discrete, inspectable tool calls | Every file write, shell command, and LLM call MUST be its own logged action | **PASS** — `tools/` wraps each action and logs input/output to `log.jsonl`; no action is folded into another |
| III. Bounded context per step | No LLM call gets the full spec + full codebase | **PASS** — `generator/` builds a scoped prompt per task (task description + dependency file contents + target interface only) |
| IV. Mandatory self-validation loop | typecheck/test MUST run post-generation with bounded repair | **PASS** — `validator/` runs both via `tools/runShell`, repairs bounded at 3/file (FR-010) |
| V. Reproducibility over cleverness | No heavyweight agent framework unless it earns its complexity | **PASS** — plain sequential modules (planner→generator→validator→reporter), no LangChain/LangGraph/CrewAI; see research.md |
| VI. No hardcoding to the sample spec | Must work on a modified spec | **PASS (design-level)** — no field/feature names from the sample spec appear in prompts or code; verified operationally by quickstart.md's modified-spec scenario, since this can't be a cheap CI assertion without real LLM calls |
| VII. Cost and token transparency | Every run logs approx. tokens + cost per call | **PASS** — `llm/` captures provider-reported usage (or a char-based estimate fallback) per call; `reporter/` aggregates into `report.md` |
| VIII. Small, narrated commits | Agent's own dev proceeds in focused commits mapped to tasks | **Process, not architecture** — enforced during `/speckit-implement`, not by this plan |

No violations requiring justification — Complexity Tracking is empty.

**Post-Phase-1 re-check**: data-model.md, contracts/, and quickstart.md introduced no new
dependency, framework, or shortcut not already covered above (the zod/dotenv/commander/SDK set
from research.md is unchanged). All gates above still hold; no new Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/001-codegen-agent-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── cli.md
│   ├── llm-provider.md
│   └── tools.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root: `codegen-agent/`)

```text
codegen-agent/
├── src/
│   ├── cli.ts                  # arg parsing (commander), orchestrates plan→generate→validate→report
│   ├── planner/
│   │   ├── index.ts             # spec text -> ordered task graph
│   │   └── types.ts             # Task, Plan types (zod schemas)
│   ├── llm/
│   │   ├── types.ts             # LLMProvider interface: generate(prompt, context) -> {text, usage}
│   │   ├── index.ts             # provider factory, reads LLM_PROVIDER from .env
│   │   ├── anthropic.ts         # Claude implementation
│   │   └── gemini.ts            # Gemini implementation
│   ├── tools/
│   │   ├── index.ts             # re-exports + shared logging wrapper
│   │   ├── writeFile.ts
│   │   ├── readFile.ts
│   │   ├── runShell.ts          # npm install/typecheck/test
│   │   ├── callLLM.ts
│   │   └── runLog.ts            # appends every tool call to <out>/.codegen-agent/log.jsonl
│   ├── generator/
│   │   └── index.ts             # walks task graph in dependency order, scoped prompt per task
│   ├── validator/
│   │   └── index.ts             # runs typecheck+test, bounded repair loop (max 3/file)
│   ├── reporter/
│   │   └── index.ts             # writes <out>/.codegen-agent/report.md
│   ├── prompts/
│   │   ├── generate.ts          # structured generation prompt template
│   │   └── repair.ts            # structured repair prompt template
│   └── cost/
│       └── index.ts             # per-model token/$ pricing table + usage aggregation
├── tests/
│   ├── unit/
│   │   ├── planner.test.ts
│   │   └── validator.test.ts
│   └── integration/
│       └── cli.e2e.test.ts      # runs cli.ts end-to-end against fixtures/, llm/ mocked
├── tests/fixtures/
│   ├── stub-spec.txt
│   └── stub-boilerplate/        # minimal fake boilerplate (package.json w/ typecheck+test stubs)
├── sample-spec.txt              # the reference Car Inventory Manager spec
├── sample-output/                # a real generated app, committed as the deliverable
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Structure Decision**: Single CLI project. The agent's own source (`src/`, `tests/`) lives at
the root of this feature's package (`codegen-agent/`, which is also this spec-kit project
root) — it is not nested under `specs/`. It never lives inside the boilerplate it generates
into; `--boilerplate` and `--out` are always external paths passed at runtime, keeping the
agent's own codebase and the app it produces fully separate (so the agent can target *any*
boilerplate copy, including a modified one, per FR-013/SC-005).

## Complexity Tracking

*No entries — Constitution Check has no violations to justify.*
