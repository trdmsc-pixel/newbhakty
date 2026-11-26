/**
 * Meta Model API (Muse models) — OpenAI-compatible Chat Completions.
 *   Base URL:  META_API_BASE (default https://api.meta.ai/v1)
 *   Key:       META_API_KEY  (sent as "Authorization: Bearer <key>")
 *   Model:     META_MODEL    (default muse-ember-1.0)
 *
 * Resilience:
 *  - If the configured model is rejected (404 / unknown model), the server asks
 *    GET /models once and switches to the best available Muse model.
 *  - Meta keys are often written "LLM|<id>|<secret>". If a key written with
 *    underscores is rejected (401/403), the pipe form is tried once.
 * Request bodies are never logged.
 */
import type { AIProvider, JSONCompletionRequest, TextCompletionRequest } from "../types.js";
import { AIUnavailableError } from "../types.js";

const env = (k: string) => (typeof process.env[k] === "string" ? process.env[k]!.trim() : "");
export const META_DEFAULT_MODEL = "muse-ember-1.0";

export type ChatRole = "system" | "user" | "assistant" | "tool";
export type ChatContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
export interface ChatMessage {
  role: ChatRole;
  content: ChatContent | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}
export interface ChatTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: "auto" | "none" | "required";
  max_tokens?: number;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}
export interface ChatResult {
  text: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  model: string;
  finishReason?: string;
}

let resolvedModel: string | null = null;
let workingKey: string | null = null;

export const metaConfigured = () => Boolean(env("META_API_KEY"));
const base = () => (env("META_API_BASE") || "https://api.meta.ai/v1").replace(/\/+$/, "");

function keyVariants(): string[] {
  const k = env("META_API_KEY");
  const out = [workingKey || k];
  if (/^LLM_\d+_/.test(k)) out.push(k.replace(/^LLM_(\d+)_/, "LLM|$1|"));
  if (k.includes("|")) out.push(k.replace(/\|/g, "_"));
  return Array.from(new Set(out.filter(Boolean)));
}

async function pickAvailableModel(key: string): Promise<string | null> {
  try {
    const r = await fetch(`${base()}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const j: any = await r.json();
    const ids: string[] = (j?.data || j?.models || []).map((m: any) => m?.id || m?.name).filter(Boolean);
    const muse = ids.filter((id) => /muse/i.test(id));
    const wanted = (env("META_MODEL") || META_DEFAULT_MODEL).toLowerCase();
    return (
      muse.find((id) => id.toLowerCase() === wanted) ||
      muse.find((id) => /-1\.0$/.test(id) && id.toLowerCase().includes(wanted.split("-")[1] || "")) ||
      muse.find((id) => /-1\.0$/.test(id)) ||
      muse[0] ||
      ids[0] ||
      null
    );
  } catch {
    return null;
  }
}

/** One Chat Completions call with key/model fallbacks. */
export async function metaChat(req: ChatRequest): Promise<ChatResult> {
  if (!metaConfigured()) throw new AIUnavailableError("META_API_KEY is not configured.");
  let model = resolvedModel || env("META_MODEL") || META_DEFAULT_MODEL;
  let lastErr = "request failed";
  for (const key of keyVariants()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 50_000);
      try {
        const body: Record<string, unknown> = {
          model,
          messages: req.messages,
          max_tokens: req.max_tokens ?? 1500,
          temperature: req.temperature ?? 0.4,
        };
        if (req.tools?.length) {
          body.tools = req.tools;
          body.tool_choice = req.tool_choice || "auto";
        }
        if (req.json) body.response_format = { type: "json_object" };
        const r = await fetch(`${base()}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data: any = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) {
          lastErr = `Meta API rejected the key (HTTP ${r.status})`;
          break; // try the next key form
        }
        const msg = String(data?.error?.message || data?.message || "");
        if (!r.ok && (r.status === 404 || /model/i.test(msg)) && attempt === 0) {
          const alt = await pickAvailableModel(key);
          if (alt && alt !== model) {
            model = alt;
            continue;
          }
        }
        if (!r.ok && req.json && r.status === 400 && attempt === 0) {
          req = { ...req, json: false }; // model may not support response_format
          continue;
        }
        if (!r.ok) throw new AIUnavailableError(`Meta API HTTP ${r.status}: ${msg || "request failed"}`);
        workingKey = key;
        resolvedModel = model;
        const choice = data?.choices?.[0];
        const m = choice?.message || {};
        const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p: any) => p?.text || "").join("") : "";
        const toolCalls = (m.tool_calls || []).map((tc: any) => {
          let args: unknown = {};
          try {
            args = typeof tc?.function?.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : tc?.function?.arguments || {};
          } catch {
            args = {};
          }
          return { name: String(tc?.function?.name || ""), args };
        });
        return { text: text.trim(), toolCalls, model, finishReason: choice?.finish_reason };
      } catch (err: any) {
        if (err instanceof AIUnavailableError) throw err;
        lastErr = err?.name === "AbortError" ? "Meta API timed out" : err?.message || lastErr;
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new AIUnavailableError(lastErr);
}

/** AIProvider adapter so extract()/draft()/split() can run on Muse. */
export function createMetaProvider(): AIProvider {
  const userContent = (req: JSONCompletionRequest | TextCompletionRequest): ChatContent => {
    const images = "images" in req ? req.images || [] : [];
    if (!images.length) return req.user;
    return [
      ...images.map((img) => ({ type: "image_url" as const, image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
      { type: "text" as const, text: req.user },
    ];
  };
  return {
    name: "meta",
    model: resolvedModel || env("META_MODEL") || META_DEFAULT_MODEL,
    async completeJSON(req) {
      const r = await metaChat({
        messages: [
          { role: "system", content: `${req.system}\n\nReply with ONLY a JSON object matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}` },
          { role: "user", content: userContent(req) },
        ],
        json: true,
        temperature: 0.1,
        max_tokens: req.maxTokens ?? 4000,
      });
      return r.text;
    },
    async completeText(req) {
      const r = await metaChat({
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: userContent(req) },
        ],
        max_tokens: req.maxTokens ?? 1200,
      });
      return r.text;
    },
  };
}
