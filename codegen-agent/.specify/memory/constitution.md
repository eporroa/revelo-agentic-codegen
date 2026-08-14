# Codegen Agent Constitution

## Core Principles

### I. Explicit Task Decomposition
Every run MUST produce a visible, ordered, dependency-aware task list before any code is
generated. No task list, no generation. The task list is a first-class artifact of the run
(logged/persisted), not an internal monologue — it is what proves this is not a single-shot
"prompt and pray" system.

### II. Discrete, Inspectable Tool Calls
File writes, shell commands (`npm install`/`test`/`typecheck`), and LLM calls MUST each be
logged as separate, inspectable actions with their inputs and outputs. No step may bury a
file write, a shell command, and an LLM call inside one opaque "do everything" completion.

### III. Bounded Context Per Step
No single LLM call may receive the entire spec plus the entire generated codebase. Context
passed between steps MUST be scoped to what that step needs — the relevant interfaces, the
prior file contents it depends on, and the relevant schema — and nothing more.

### IV. Mandatory Self-Validation Loop
After generation, the agent MUST run typecheck and the test suite (or a secondary LLM review
call) and feed failures back into a bounded number of repair iterations, **max 3**, before
giving up and reporting exactly what failed. Silent failure or infinite retry are both
violations.

### V. Reproducibility Over Cleverness
Prefer a clean function-calling loop or lightweight state machine over a heavyweight agent
framework. A framework (LangChain, LangGraph, CrewAI, etc.) may only be introduced if it earns
its added complexity over the plain loop — the default assumption is that it does not.

### VI. No Hardcoding to the Sample Spec
The agent MUST be validated against a modified spec (e.g. renamed fields, an added filter) to
prove it is generating from the spec, not memorizing/pattern-matching the reference app.
Passing only on the original sample spec does not satisfy this principle.

### VII. Cost and Token Transparency
Every run MUST log approximate tokens used and estimated cost for each LLM call, and a total
for the run. This is not optional telemetry — it is required output of every run.

### VIII. Small, Narrated Commits
The agent's own development MUST proceed in focused commits that map to the task list — not
one large commit. Commit history should let a reader reconstruct how the system was built,
step by step.

## Tech Constraints

- **Language/runtime**: Node.js with TypeScript, preferred over other languages.
- **LLM provider**: pluggable behind a common interface. Anthropic Claude is the primary
  provider; the interface MUST support swapping to OpenAI or Gemini without rewriting the
  agent loop.
- **Output scope**: no database, backend, auth, or CI. The agent's output is a static
  generated React + TypeScript app only, written into the existing boilerplate at
  `../code-boilerplate` (React 19, Vite, Apollo Client, MUI, MSW, Vitest — see that project's
  README for the reference application spec).

## Governance

This constitution supersedes ad hoc practices for this repository. Any deviation from a
principle above (adopting a heavyweight framework, skipping self-validation, generating from
an unbounded context, a single giant commit, etc.) MUST be justified in the relevant commit or
PR description, not silently done. Amendments to this document require a version bump and a
note on what changed and why.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
