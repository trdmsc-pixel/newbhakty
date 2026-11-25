import type { AIProvider, JSONCompletionRequest, TextCompletionRequest } from "../types.js";
import { AIUnavailableError } from "../types.js";

// Cheapest fast Gemini model; override with GEMINI_MODEL.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(apiKey: string): AIProvider {
  const model = (process.env.GEMINI_MODEL || "").trim() || DEFAULT_MODEL;

  async function call(body: Record<string, unknown>): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Never echo request content; only the provider's status/message.
        throw new AIUnavailableError(`Gemini HTTP ${res.status}: ${data?.error?.message || "request failed"}`);
      }
      const candidate = data?.candidates?.[0];
      if (!candidate || candidate.finishReason === "SAFETY") {
        throw new AIUnavailableError("Gemini returned no usable candidate.");
      }
      return (candidate.content?.parts || [])
        .map((p: any) => (typeof p.text === "string" ? p.text : ""))
        .join("")
        .trim();
    } finally {
      clearTimeout(timer);
    }
  }

  const parts = (req: JSONCompletionRequest | TextCompletionRequest) => {
    const out: Array<Record<string, unknown>> = [];
    const images = "images" in req ? req.images || [] : [];
    for (const img of images) out.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
    out.push({ text: req.user });
    return out;
  };

  return {
    name: "gemini",
    model,
    async completeJSON(req) {
      return call({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: parts(req) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: req.jsonSchema,
          maxOutputTokens: req.maxTokens ?? 4000,
          temperature: 0.1,
        },
      }).catch(async (err) => {
        // Retry without the schema in case the model rejects a schema feature.
        if (err instanceof AIUnavailableError && /HTTP 400/.test(err.message)) {
          return call({
            systemInstruction: {
              parts: [{ text: `${req.system}\n\nReturn JSON matching this schema:\n${JSON.stringify(req.jsonSchema)}` }],
            },
            contents: [{ role: "user", parts: parts(req) }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxTokens ?? 4000, temperature: 0.1 },
          });
        }
        throw err;
      });
    },
    async completeText(req) {
      return call({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: parts(req) }],
        generationConfig: { maxOutputTokens: req.maxTokens ?? 1200, temperature: 0.4 },
      });
    },
  };
}
