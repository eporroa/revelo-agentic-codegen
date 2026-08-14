import type { LLMUsage } from "../llm/types.js";
import type { TokenUsageEntry } from "../planner/types.js";

/**
 * Static $/1K-token pricing, used only to produce an approximate estimate
 * (spec.md Assumptions: "not billed-invoice-accurate"). Update as provider
 * pricing changes; unknown models fall back to a conservative default.
 */
const PRICING_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 0.003, output: 0.015 },
  "claude-opus-4-1": { input: 0.015, output: 0.075 },
  "gemini-2.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
};

const DEFAULT_PRICING = { input: 0.003, output: 0.015 };

export function estimateCallCostUsd(
  provider: string,
  model: string,
  usage: LLMUsage
): number {
  const pricing = PRICING_PER_1K_TOKENS[model] ?? DEFAULT_PRICING;
  return (
    (usage.inputTokens / 1000) * pricing.input +
    (usage.outputTokens / 1000) * pricing.output
  );
}

/** One call's usage, ready to fold into a run-level aggregate. */
export interface RecordedCall {
  provider: string;
  model: string;
  usage: LLMUsage;
}

/**
 * Aggregates every recorded LLM call into per-model totals plus a run-wide
 * estimated cost (FR-012, SC-006). Two calls to the same model are merged
 * into one TokenUsageEntry rather than listed per-call.
 */
export function aggregateUsage(calls: RecordedCall[]): {
  tokenUsage: TokenUsageEntry[];
  estimatedCostUsd: number;
} {
  const byModel = new Map<string, TokenUsageEntry>();
  let estimatedCostUsd = 0;

  for (const call of calls) {
    const key = `${call.provider}:${call.model}`;
    const existing = byModel.get(key);
    if (existing) {
      existing.inputTokens += call.usage.inputTokens;
      existing.outputTokens += call.usage.outputTokens;
    } else {
      byModel.set(key, {
        provider: call.provider,
        model: call.model,
        inputTokens: call.usage.inputTokens,
        outputTokens: call.usage.outputTokens,
      });
    }
    estimatedCostUsd += estimateCallCostUsd(call.provider, call.model, call.usage);
  }

  return { tokenUsage: Array.from(byModel.values()), estimatedCostUsd };
}
