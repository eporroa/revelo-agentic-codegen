import { GoogleGenAI } from "@google/genai";
import type { LLMProvider, LLMResponse } from "./types.js";
import { MissingApiKeyError } from "./types.js";

const DEFAULT_MODEL = "gemini-2.5-pro";

export function createGeminiProvider(
  model: string = DEFAULT_MODEL
): LLMProvider {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new MissingApiKeyError("gemini", "GEMINI_API_KEY");
  }
  const client = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    model,
    async generate(prompt: string, context: string): Promise<LLMResponse> {
      const contents = context ? `${prompt}\n\n---\n\nContext:\n${context}` : prompt;
      const response = await client.models.generateContent({
        model,
        contents,
      });

      return {
        text: response.text ?? "",
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
