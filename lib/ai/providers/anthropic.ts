import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, JSONCompletionRequest, TextCompletionRequest } from "../types.js";
import { AIUnavailableError } from "../types.js";

// Cheapest fast Claude model; override with ANTHROPIC_MODEL.
const DEFAULT_MODEL = "claude-haiku-5-5";

function textFrom(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new AIUnavailableError("Claude declined this request.");
  }
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 2 });
  const model = (process.env.ANTHROPIC_MODEL || "").trim() || DEFAULT_MODEL;

  const userContent = (req: JSONCompletionRequest | TextCompletionRequest): Anthropic.ContentBlockParam[] => {
    const blocks: Anthropic.ContentBlockParam[] = [];
    const images = "images" in req ? req.images || [] : [];
    for (const img of images) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: img.base64,
        },
      });
    }
    blocks.push({ type: "text", text: req.user });
    return blocks;
  };

  return {
    name: "claude",
    model,
    async completeJSON(req) {
      const base = {
        model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: [{ role: "user" as const, content: userContent(req) }],
      };
      try {
        const message = await client.messages.create({
          ...base,
          output_config: { effort: "low", format: { type: "json_schema", schema: req.jsonSchema } },
        });
        return textFrom(message);
      } catch (err) {
        // If the schema is rejected, fall back to prompt-only JSON (Zod still validates).
        if (err instanceof Anthropic.BadRequestError) {
          const message = await client.messages.create({
            ...base,
            output_config: { effort: "low" },
            system: `${req.system}\n\nRespond with a single JSON object only, matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`,
          });
          return textFrom(message);
        }
        throw err;
      }
    },
    async completeText(req) {
      const message = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? 1200,
        system: req.system,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: userContent(req) }],
      });
      return textFrom(message);
    },
  };
}
