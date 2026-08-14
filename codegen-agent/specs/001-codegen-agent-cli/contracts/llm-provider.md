# Contract: LLM Provider Interface

The seam that makes the LLM swappable without touching `generator/`, `validator/`, or
`planner/` (FR-014, constitution principle V).

```ts
// src/llm/types.ts
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage; // provider-reported when available (research.md)
}

export interface LLMProvider {
  readonly name: "anthropic" | "gemini";
  readonly model: string;
  generate(prompt: string, context: string): Promise<LLMResponse>;
}
```

## Selection contract

- `LLM_PROVIDER` in `.env` is `"anthropic" | "gemini"`; `LLM_MODEL` optionally overrides the
  default model for that provider.
- `src/llm/index.ts` exports a single `getProvider(): LLMProvider` factory read once per CLI
  run. Every caller (`planner/`, `generator/`, `validator/`'s repair path) depends only on the
  `LLMProvider` interface, never on `anthropic.ts`/`gemini.ts` directly.
- Missing/invalid API key for the selected provider → the CLI fails fast before PLAN starts,
  with a clear "set ANTHROPIC_API_KEY / GEMINI_API_KEY in .env" message — not a cryptic SDK
  stack trace mid-run.

## Retry contract (FR-016)

`generate()` implementations do **not** retry internally. Retry-with-backoff on transport
failures (timeout, rate limit, 5xx) is a `tools/callLLM.ts` responsibility, wrapping whichever
`LLMProvider` is active — so the retry/backoff policy is defined once, identically, for both
providers, rather than duplicated per-SDK.

## Context-scoping contract (FR-008, constitution principle III)

Callers MUST pass:
- `prompt`: the structured template (role + task + expected export signature + few-shot
  example + output-format constraint — see [prompts/generate.ts](../plan.md#project-structure)).
- `context`: only the specific prior file contents this task's `dependsOn` names, plus the
  relevant spec excerpt — never the full spec and never the full generated tree.

There is intentionally no "pass the whole codebase" convenience method on this interface — that
constraint is enforced by the interface's own shape, not just code review discipline.
