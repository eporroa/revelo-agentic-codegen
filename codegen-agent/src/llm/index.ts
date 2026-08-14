import type { LLMProvider, LLMProviderName } from "./types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";

function resolveProviderName(): LLMProviderName {
  const raw = process.env["LLM_PROVIDER"]?.trim().toLowerCase();
  if (!raw) return "anthropic"; // Claude is the constitution's primary provider.
  if (raw === "anthropic" || raw === "gemini") return raw;
  throw new Error(
    `Unknown LLM_PROVIDER "${raw}". Expected "anthropic" or "gemini".`
  );
}

let cached: LLMProvider | undefined;

/**
 * Reads LLM_PROVIDER/LLM_MODEL from process.env (populated from .env by
 * cli.ts at startup) and returns the matching LLMProvider. Fails fast with
 * a clear message if the selected provider has no API key configured
 * (contracts/llm-provider.md's Selection contract).
 */
export function getProvider(): LLMProvider {
  if (cached) return cached;

  const name = resolveProviderName();
  const model = process.env["LLM_MODEL"];

  cached =
    name === "anthropic"
      ? createAnthropicProvider(model)
      : createGeminiProvider(model);
  return cached;
}

/** Test-only: clears the cached provider so a new one is built on next call. */
export function resetProviderCache(): void {
  cached = undefined;
}
