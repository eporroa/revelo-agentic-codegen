import type { LLMProvider, LLMUsage } from "../llm/types.js";
import type { RunLog } from "./runLog.js";
import type { ToolResult } from "./types.js";

export type CallLLMTool = (
  taskId: string,
  prompt: string,
  context: string
) => Promise<ToolResult<{ text: string; usage: LLMUsage }>>;

export class LLMCallFailedError extends Error {
  constructor(attempts: number, options?: { cause?: unknown }) {
    super(`LLM call failed after ${attempts} attempts`, options);
    this.name = "LLMCallFailedError";
  }
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps the active LLMProvider.generate() with bounded retry-with-backoff
 * on transport failures (timeout, rate limit, 5xx) — FR-016. This budget is
 * separate from, and does not consume, validator/index.ts's post-validation
 * repair attempts (FR-010).
 */
export function createCallLLM(log: RunLog, provider: LLMProvider): CallLLMTool {
  return async (taskId, prompt, context) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await provider.generate(prompt, context);
        const output = { text: response.text, usage: response.usage };
        const loggedAs = await log.append({
          taskId,
          tool: "callLLM",
          input: { prompt, context, provider: provider.name, model: provider.model, attempt },
          output,
        });
        return { output, loggedAs };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    const failure = new LLMCallFailedError(MAX_ATTEMPTS, { cause: lastError });
    await log.append({
      taskId,
      tool: "callLLM",
      input: { prompt, context, provider: provider.name, model: provider.model },
      output: { error: String(lastError) },
    });
    throw failure;
  };
}
