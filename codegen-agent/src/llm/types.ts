/**
 * The seam that makes the LLM swappable without touching planner/, generator/,
 * or validator/ (FR-014, constitution principle V).
 * See specs/001-codegen-agent-cli/contracts/llm-provider.md.
 */

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

export type LLMProviderName = "anthropic" | "gemini";

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly model: string;
  /**
   * `prompt` is the structured instruction template; `context` is the scoped
   * data for this call only (FR-008) — never the full spec or full codebase.
   * Implementations do NOT retry internally; that's tools/callLLM.ts's job
   * (FR-016), applied identically across providers.
   */
  generate(prompt: string, context: string): Promise<LLMResponse>;
}

/** Thrown when the selected provider has no usable API key configured. */
export class MissingApiKeyError extends Error {
  constructor(provider: LLMProviderName, envVar: string) {
    super(
      `No API key configured for LLM provider "${provider}". Set ${envVar} in your .env file (see .env.example).`
    );
    this.name = "MissingApiKeyError";
  }
}
