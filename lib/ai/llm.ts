/**
 * Simple multi-turn chat for assistant features (portal helper, admin writer).
 * Meta Muse when META_API_KEY is set; Gemini as a fallback. Server-side only.
 */
import { metaChat, metaConfigured, type ChatMessage } from "./providers/meta.js";
import { AIUnavailableError } from "./types.js";

const env = (k: string) => (typeof process.env[k] === "string" ? process.env[k]!.trim() : "");

export interface LlmTurn {
  role: "user" | "assistant";
  text: string;
}

export async function llmChat(opts: { system: string; turns: LlmTurn[]; maxTokens?: number; temperature?: number; json?: boolean }): Promise<string> {
  if (metaConfigured()) {
    const messages: ChatMessage[] = [{ role: "system", content: opts.system }, ...opts.turns.map((t) => ({ role: t.role, content: t.text }) as ChatMessage)];
    const r = await metaChat({ messages, max_tokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.4, json: opts.json });
    return r.text;
  }
  const key = env("GEMINI_API_KEY");
  if (!key) throw new AIUnavailableError("No AI model configured. Set META_API_KEY in Vercel.");
  const model = env("COPILOT_MODEL") || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text || "…" }] })),
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.4, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new AIUnavailableError(`Gemini HTTP ${r.status}: ${data?.error?.message || "failed"}`);
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
