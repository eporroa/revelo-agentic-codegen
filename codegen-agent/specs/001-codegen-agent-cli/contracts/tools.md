# Contract: Tool Calls & Run Log

The discrete, inspectable-action seam (FR-006, FR-007, constitution principle II).

```ts
// src/tools/index.ts
export interface ToolResult<TOutput> {
  output: TOutput;
  loggedAs: GenerationStepId; // the Run Log line this call produced
}

writeFile(taskId: string, path: string, contents: string): Promise<ToolResult<{ bytesWritten: number }>>;
readFile(taskId: string, path: string): Promise<ToolResult<{ contents: string }>>;
runShell(taskId: string, command: "install" | "typecheck" | "test"): Promise<ToolResult<{
  exitCode: number; stdout: string; stderr: string;
}>>;
callLLM(taskId: string, prompt: string, context: string): Promise<ToolResult<{
  text: string; usage: LLMUsage;
}>>;
```

## Logging contract

Every one of the four functions above, on every call:

1. Writes exactly one JSON Line to `<out>/.codegen-agent/log.jsonl` **before** returning to the
   caller — a `Generation Step` record (see [data-model.md](../data-model.md#generation-step))
   with `taskId`, `tool`, `input`, `output`, `timestamp`.
2. Never batches multiple tool calls into one log line, and never omits a call from the log —
   this file is the audit trail the "discrete, inspectable tool calls" principle depends on
   being complete, not just the happy-path calls.
3. Logs failures too: a thrown error from `runShell`/`callLLM` still produces a log line (with
   the error captured in `output`) before the exception propagates to the caller.

## `runShell` contract

- `command` is restricted to the three named boilerplate npm scripts — no arbitrary shell string
  is ever accepted from spec text or LLM output, closing off command injection from untrusted
  input.
- Resolves to the boilerplate's own `package.json` scripts (`npm run <command>` under the hood,
  or `npm install` for `install`), run with cwd set to `--out`.

## `callLLM` contract

- Delegates to the active `LLMProvider.generate()` (contracts/llm-provider.md), wrapped in the
  transport-retry policy (max 3 attempts, backoff) described there.
- `context` passed in by the caller is logged verbatim as part of `input` — this is what makes
  FR-008/SC-003 ("context stayed scoped") independently auditable after the fact, not just
  asserted.
