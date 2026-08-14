# Phase 0 Research: codegen-agent CLI

Each unknown from Technical Context, resolved as Decision / Rationale / Alternatives considered.

## Runtime & language version

- **Decision**: TypeScript 5.7 on Node.js 20 LTS+.
- **Rationale**: Matches the boilerplate's own TS version (consistency of `tsconfig` conventions
  the agent has to read/mimic). Node 20 is the oldest LTS with stable `fs.cp`/`fs.cpSync`
  recursive directory copy, which is how the CLI clones `--boilerplate` into `--out` without a
  third-party dependency.
- **Alternatives considered**: Python or Go for the agent itself — rejected per the project's
  constitution tech constraint ("Node.js with TypeScript preferred").

## CLI argument parsing

- **Decision**: `commander`.
- **Rationale**: Required-flag validation (`--spec`, `--boilerplate`, `--out`), `--help`/usage
  text, and clear error messages out of the box, at a small footprint (one dependency, no
  transitive bloat).
- **Alternatives considered**: Node's built-in `node:util.parseArgs` — zero dependencies, but
  hand-rolling required-arg validation and help text for three flags didn't earn its
  "simplicity" over pulling in the one well-known library; rejected as a marginal call, not a
  strong one.

## LLM provider SDKs

- **Decision**: `@anthropic-ai/sdk` for Claude, `@google/genai` for Gemini, both behind one
  `LLMProvider` interface (`generate(prompt, context) -> { text, usage }`) selected via an
  `LLM_PROVIDER` value in `.env` (see [contracts/llm-provider.md](./contracts/llm-provider.md)).
- **Rationale**: Official first-party SDKs for the two providers the spec's Clarifications
  session requires (Claude + Gemini, no OpenAI in v1). Both SDKs return per-call token usage in
  their response metadata, which `cost/` uses directly for FR-012/SC-006's cost reporting
  instead of estimating from scratch.
- **Alternatives considered**: A unifying meta-SDK (e.g. LangChain's model wrappers) — rejected
  per constitution principle V (reproducibility over cleverness): the actual surface area needed
  (one `generate` call per provider) is small enough that a thin hand-written interface is both
  simpler and more auditable than adopting a framework's abstractions.

## `.env` configuration loading

- **Decision**: `dotenv`.
- **Rationale**: Loads `.env` into `process.env` predictably across Node 20/22 without relying
  on a newer Node-version-specific built-in flag, keeping the CLI portable across whatever LTS a
  developer has installed.
- **Alternatives considered**: Node's native `--env-file` flag / `process.loadEnvFile()` —
  rejected as a hard version-pin risk (behavior differs across recent Node versions); the
  `dotenv` package is stable and near-zero-weight.

## Shell command execution (npm install / typecheck / test)

- **Decision**: Node's built-in `node:child_process` (`execFile`), wrapped by
  `tools/runShell.ts`.
- **Rationale**: The only requirement is "run an npm script, capture stdout/stderr/exit code" —
  built-in `child_process` does this with no added dependency.
- **Alternatives considered**: `execa` — nicer ergonomics (promise-based, better error objects)
  but an extra dependency for a thin wrapper `tools/runShell.ts` already provides; rejected per
  constitution principle V.

## Boilerplate → destination copy

- **Decision**: `fs.cp(boilerplatePath, outPath, { recursive: true, errorOnExist: true })`
  (Node built-in), after checking `outPath` is empty or absent (FR-003).
- **Rationale**: Zero-dependency recursive copy, available since Node 16.7 and stable in 20 LTS.
- **Alternatives considered**: `fs-extra` — rejected, redundant with a built-in that already does
  the job.

## Structured plan/task output validation

- **Decision**: `zod` schemas for the `Task`/`Plan` shape the planner LLM call must return;
  parse-and-validate the LLM's JSON before trusting it, retrying the planning call (bounded,
  same 3-attempt pattern as generation) on a schema mismatch.
- **Rationale**: The planner's own LLM call is itself an LLM call that can return malformed
  output; validating it the same way generated *code* is validated keeps the "mandatory
  self-validation" principle applied consistently to the planning phase, not just generation.
- **Alternatives considered**: Trusting raw JSON.parse with no schema — rejected as silently
  accepting a malformed plan would violate constitution principle I (no task list, no
  generation) in spirit, since a garbage plan is barely better than no plan.

## Run-artifact location

- **Decision**: `<out>/.codegen-agent/{plan.md,log.jsonl,report.md}` — a hidden folder inside
  the generated app's own destination directory, not inside the `codegen-agent` package itself.
- **Rationale**: Keeps every run's artifacts co-located with the app they describe (useful when
  multiple `--out` targets exist side by side, e.g. original spec vs. modified-spec runs for
  SC-005 verification), without polluting the generated app's own `src/` tree or colliding with
  the CLI's own working directory.
- **Alternatives considered**: A fixed `run/` folder inside the `codegen-agent` package
  (as sketched in the initial architecture note) — rejected because it would overwrite the
  previous run's artifacts on every invocation regardless of `--out`, undermining User Story
  2/3 (inspecting *this* run's plan and report after the fact, potentially across multiple
  generated outputs).

## Plan file format

- **Decision**: `plan.md` — Markdown, per the spec's Clarifications session ("Markdown or plain
  text, human-readable, no JSON requirement"). Internally, `planner/` still works with a typed
  `Task[]` object (validated via the zod schema above); `plan.md` is a rendering of that object,
  not a separate source of truth.
- **Rationale**: Directly satisfies FR-004; avoids the earlier draft architecture's `plan.json`,
  which predates the clarification and would fail SC-002 ("reviewable... without any tooling").
- **Alternatives considered**: `plan.json` — was the original sketch, superseded by the ratified
  spec's clarification; kept only as the in-memory shape, not the persisted artifact.

## Testing framework

- **Decision**: Vitest, mirroring the boilerplate's own test stack.
- **Rationale**: One less tool for a developer to learn across the two projects; the agent's
  own integration test can reuse the same assertion/mocking idioms already used to test the
  *generated* app.
- **Alternatives considered**: Jest — functionally equivalent here; no reason to diverge from
  what the rest of this challenge already standardizes on.

## Token/cost estimation

- **Decision**: Use each provider's reported usage (`usage.input_tokens`/`output_tokens` for
  Claude, `usageMetadata` for Gemini) when present; fall back to a `chars / 4` heuristic only if
  a response omits usage data. Cost is computed by multiplying usage against a small static
  per-model `$/1K tokens` table in `cost/index.ts`.
- **Rationale**: Provider-reported usage is authoritative when available; the fallback keeps
  SC-006 ("every run reports token/cost") true even against a future provider response that
  omits usage metadata.
- **Alternatives considered**: Always estimating via a tokenizer library (e.g. `tiktoken`) —
  rejected as unnecessary weight when both configured providers already report real usage; and
  `tiktoken`'s BPE is OpenAI-specific, not accurate for Claude/Gemini tokenization anyway.

**Output**: All Technical Context unknowns resolved above; none remain marked
`NEEDS CLARIFICATION` in plan.md.
