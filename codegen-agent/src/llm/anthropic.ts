import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMResponse } from "./types.js";
import { MissingApiKeyError } from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;

export function createAnthropicProvider(
  model: string = DEFAULT_MODEL
): LLMProvider {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new MissingApiKeyError("anthropic", "ANTHROPIC_API_KEY");
  }
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    model,
    async generate(prompt: string, context: string): Promise<LLMResponse> {
      const userContent = context ? `${prompt}\n\n---\n\nContext:\n${context}` : prompt;
      const message = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: userContent }],
      });

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    },
  };
}
