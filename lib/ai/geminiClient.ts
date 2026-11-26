/**
 * Resilient Gemini generateContent (server-side).
 *
 * Google's API often answers 503 "UNAVAILABLE / model is overloaded" (and 429
 * when a per-model quota is hit) even while the console shows the model as up.
 * This client:
 *   1. retries the same model with backoff on 429/500/503/504,
 *   2. then moves through a fallback chain of models,
 *   3. skips models that don't exist for this key (404),
 *   4. as a last resort discovers a working text model via models.list.
 *
 * Two tiers, matched to the free-tier quotas on this key:
 *   smart — Copilot (tool calling, reasoning): 3.8 Flash → 3.6 Flash → 4 Hydrogen → 3.5 Flash-Lite
 *   fast  — everything else (email reading, drafts, imports, portal assistant,
 *           admin writing): 3.5 Flash-Lite (500/day) first, bigger models only as backup
 * Overrides: GEMINI_SMART_MODELS / GEMINI_FAST_MODELS (comma-separated); a caller's
 * preferred model (COPILOT_MODEL / GEMINI_MODEL) always goes first.
 * Quota-aware: a 429 parks that model (1 min for per-minute limits, until the daily
 * reset for per-day limits) and moves straight to the next model.
 * Live / TTS / image / embedding models are never used here — they don't serve
 * request/response generateContent with synchronous function calling.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const env = (k: string) => (typeof process.env[k] === "string" ? process.env[k]!.trim() : "");

export type GeminiTier = "smart" | "fast";
export const TIER_DEFAULTS: Record<GeminiTier, string[]> = {
  smart: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-hydrogen", "gemini-3.5-flash-lite"],
  fast: ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"],
};
const parked = new Map<string, number>(); // model → epoch ms until usable again
/** Free-tier daily quotas reset at midnight Pacific (≈ 07:00–08:00 UTC). */
function nextDailyReset(): number {
  const now = new Date();
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t.getTime();
}
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const NOT_TEXT = /live|tts|audio|image|imagen|veo|embedding|aqa|robotics|transcribe/i;

const missing = new Set<string>(); // models this key can't use (404) — skip for the life of the instance
let discovered: string[] | null = null;
let lastGood: string | null = null;

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

function chain(tier: GeminiTier, preferred?: string): string[] {
  const override = env(tier === "smart" ? "GEMINI_SMART_MODELS" : "GEMINI_FAST_MODELS").split(",").map((s) => s.trim()).filter(Boolean);
  const list = [preferred, ...(override.length ? override : TIER_DEFAULTS[tier]), lastGood].filter((m): m is string => Boolean(m) && !NOT_TEXT.test(m!));
  const now = Date.now();
  const usable = Array.from(new Set(list)).filter((m) => !missing.has(m));
  const ready = usable.filter((m) => (parked.get(m) || 0) <= now);
  // If everything is parked, still try the one that frees up soonest.
  return ready.length ? ready : usable.sort((a, b) => (parked.get(a) || 0) - (parked.get(b) || 0)).slice(0, 1);
}

async function discover(key: string): Promise<string[]> {
  if (discovered) return discovered;
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    const j: any = await r.json().catch(() => ({}));
    const names: string[] = (j?.models || [])
      .filter((m: any) => (m?.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => String(m.name || "").replace(/^models\//, ""))
      .filter((n: string) => /^gemini-/.test(n) && !NOT_TEXT.test(n) && !/preview|exp/i.test(n));
    // Prefer flash, newest version first.
    const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || "0");
    discovered = names.sort((a, b) => Number(/flash/.test(b)) - Number(/flash/.test(a)) || ver(b) - ver(a)).slice(0, 4);
  } catch {
    discovered = [];
  }
  return discovered;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST :generateContent with retries + model fallback. Returns the raw JSON response
 * and the model that answered.
 */
export async function geminiGenerate(
  body: Record<string, unknown>,
  opts: { preferred?: string; timeoutMs?: number; key?: string; tier?: GeminiTier } = {}
): Promise<{ data: any; model: string }> {
  const tier: GeminiTier = opts.tier || "fast";
  const key = opts.key || env("GEMINI_API_KEY");
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured.", 503);
  let lastStatus = 503;
  let lastMsg = "Gemini is unavailable";
  const tried: string[] = [];

  const attemptModel = async (model: string): Promise<{ data: any; model: string } | null> => {
    tried.push(model);
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 55_000);
      try {
        const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data: any = await r.json().catch(() => ({}));
        if (r.ok) {
          lastGood = model;
          return { data, model };
        }
        lastStatus = r.status;
        lastMsg = data?.error?.message || `HTTP ${r.status}`;
        if (r.status === 404 || /not found|is not supported|unsupported/i.test(lastMsg)) {
          missing.add(model);
          return null; // next model
        }
        if (r.status === 400 || r.status === 401 || r.status === 403) throw new GeminiError(`Gemini (${model}): ${lastMsg}`, r.status);
        if (r.status === 429) {
          // Quota hit: don't hammer this model — park it and move on.
          const daily = /per.?day|daily|PerDay|RPD/i.test(JSON.stringify(data?.error || {}));
          parked.set(model, daily ? nextDailyReset() : Date.now() + 60_000);
          return null;
        }
        if (!RETRYABLE.has(r.status)) return null;
        if (attempt < 2) await sleep(600 * (attempt + 1) + Math.random() * 300);
      } catch (err: any) {
        if (err instanceof GeminiError) throw err;
        lastStatus = 504;
        lastMsg = err?.name === "AbortError" ? "request timed out" : err?.message || "network error";
        if (attempt < 2) await sleep(500);
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  };

  for (const model of chain(tier, opts.preferred)) {
    const ok = await attemptModel(model);
    if (ok) return ok;
  }
  for (const model of (await discover(key)).filter((m) => !tried.includes(m) && !missing.has(m) && (parked.get(m) || 0) <= Date.now())) {
    const ok = await attemptModel(model);
    if (ok) return ok;
  }
  const friendly =
    lastStatus === 429
      ? "Your Gemini free-tier limits are used up for every available model right now — they reset each minute (per-minute) or daily at about 1:30 pm IST (per-day)."
      : lastStatus === 503 || lastStatus === 500 || lastStatus === 502
      ? "Google's Gemini servers are temporarily overloaded (their side). I retried several models — please try again shortly."
      : `Gemini: ${lastMsg}`;
  throw new GeminiError(`${friendly} (tried: ${tried.join(", ")})`, lastStatus);
}
