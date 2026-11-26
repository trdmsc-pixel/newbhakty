/**
 * Simple multi-turn chat for assistant features (portal helper, admin writer).
 * Runs on Google Gemini (GEMINI_API_KEY). Server-side only.
 */
import { AIUnavailableError } from "./types.js";
import { geminiGenerate } from "./geminiClient.js";

const env = (k: string) => (typeof process.env[k] === "string" ? process.env[k]!.trim() : "");

export interface LlmTurn {
  role: "user" | "assistant";
  text: string;
}

export const llmConfigured = () => Boolean(env("GEMINI_API_KEY"));

export async function llmChat(opts: { system: string; turns: LlmTurn[]; maxTokens?: number; temperature?: number; json?: boolean }): Promise<string> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new AIUnavailableError("GEMINI_API_KEY is not configured.");
  const { data } = await geminiGenerate(
    {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text || "…" }] })),
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.4, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
    },
    { preferred: env("GEMINI_MODEL") || undefined, tier: "fast", timeoutMs: 50_000 }
  );
  return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
}

/** Parse a JSON object out of a model reply (tolerates ```json fences / prose). */
export function parseJsonReply<T = any>(raw: string): T | null {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(t.slice(s, e + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
