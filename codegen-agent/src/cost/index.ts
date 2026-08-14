import { readFile } from "node:fs/promises";
import type { LLMUsage } from "../llm/types.js";
import type { TokenUsageEntry } from "../planner/types.js";
import { logPath } from "../tools/runLog.js";

/**
 * Static $/1K-token pricing, used only to produce an approximate estimate
 * (spec.md Assumptions: "not billed-invoice-accurate"). Update as provider
 * pricing changes; unknown models fall back to a conservative default.
 */
const PRICING_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 0.003, output: 0.015 },
  "claude-opus-4-1": { input: 0.015, output: 0.075 },
  "gemini-pro-latest": { input: 0.00125, output: 0.005 },
  "gemini-flash-latest": { input: 0.0003, output: 0.0025 },
  "gemini-flash-lite-latest": { input: 0.0001, output: 0.0004 },
  // Superseded model ids kept for reports generated before a pricing update.
  "gemini-2.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
};

const DEFAULT_PRICING = { input: 0.003, output: 0.015 };

export function estimateCallCostUsd(
  _provider: string,
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

interface LoggedCallLLMStep {
  tool: string;
  input?: { provider?: string; model?: string };
  output?: { usage?: LLMUsage; error?: string };
}

/**
 * Reads back log.jsonl's callLLM entries to recover every successful call's
 * usage — the log is the single source of truth for what actually
 * happened (FR-007), so cost reporting derives from it rather than a
 * separately-maintained in-memory tally that could drift from it.
 */
export async function recordedCallsFromLog(outDir: string): Promise<RecordedCall[]> {
  let raw: string;
  try {
    raw = await readFile(logPath(outDir), "utf8");
  } catch {
    return [];
  }
  const calls: RecordedCall[] = [];
  for (const line of raw.trim().split("\n")) {
    if (!line) continue;
    const step = JSON.parse(line) as LoggedCallLLMStep;
    if (step.tool !== "callLLM" || !step.output?.usage || !step.input?.provider || !step.input?.model) {
      continue;
    }
    calls.push({ provider: step.input.provider, model: step.input.model, usage: step.output.usage });
  }
  return calls;
}
