import crypto from "crypto";
import type { Request } from "express";

// modify = read + labels (read/unread, important, archive); send + compose for
// replies the owner explicitly sends from Studio OS. Nothing is ever auto-sent.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
];
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function env(k: string) {
  const v = process.env[k];
  return typeof v === "string" ? v.trim() : "";
}

export function googleConfigured(): boolean {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function baseUrlFromRequest(req: Request): string {
  const configured = env("APP_URL") || env("PUBLIC_APP_URL");
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000").split(",")[0].trim();
  return `${host.startsWith("localhost") ? "http" : proto}://${host}`;
}

export function redirectUri(req: Request): string {
  return env("GOOGLE_REDIRECT_URI") || `${baseUrlFromRequest(req)}/api/studio-os/gmail/callback`;
}

function stateKey(): string {
  return env("GOOGLE_CLIENT_SECRET") || env("INGEST_HMAC_SECRET");
}

export function signState(data: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 10 * 60 * 1000, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  const sig = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): Record<string, any> | null {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig || !stateKey()) return null;
  const expected = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildAuthUrl(req: Request, state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(req: Request, code: string): Promise<{ refresh_token?: string; access_token: string; scope?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${data?.error || res.status}: ${data?.error_description || "token exchange failed"}`);
  return data;
}

export class GmailAuthError extends Error {}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data?.error === "invalid_grant" || res.status === 400 || res.status === 401) {
      throw new GmailAuthError(data?.error_description || "Refresh token expired or revoked");
    }
    throw new Error(data?.error_description || `Token refresh failed (${res.status})`);
  }
  return data.access_token;
}

export class GmailClient {
  constructor(private accessToken: string) {}

  private async get(path: string, params: Record<string, string | string[] | undefined> = {}): Promise<any> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.set(k, v);
    }
    const res = await fetch(`${API}${path}${qs.toString() ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.error?.message || `Gmail HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  profile(): Promise<{ emailAddress: string; historyId: string }> {
    return this.get("/profile");
  }

  listMessageIds(q: string, max = 25): Promise<{ messages?: Array<{ id: string; threadId: string }> }> {
    return this.get("/messages", { q, maxResults: String(max) });
  }

  async historySince(startHistoryId: string): Promise<{ ids: string[]; historyId: string }> {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    let latest = startHistoryId;
    for (let page = 0; page < 5; page++) {
      const data = await this.get("/history", { startHistoryId, historyTypes: "messageAdded", pageToken, maxResults: "100" });
      for (const h of data.history || []) {
        for (const m of h.messagesAdded || []) if (m?.message?.id) ids.add(m.message.id);
      }
      latest = data.historyId || latest;
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return { ids: [...ids], historyId: latest };
  }

  getMessage(id: string): Promise<any> {
    return this.get(`/messages/${id}`, { format: "full" });
  }

  getThreadMeta(id: string): Promise<any> {
    return this.get(`/threads/${id}`, { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date", "Message-ID"] });
  }

  listThreads(q: string, max = 25, pageToken?: string): Promise<{ threads?: Array<{ id: string; snippet: string }>; nextPageToken?: string; resultSizeEstimate?: number }> {
    return this.get("/threads", { q, maxResults: String(max), pageToken });
  }

  getThread(id: string): Promise<any> {
    return this.get(`/threads/${id}`, { format: "full" });
  }

  getThreadSummary(id: string): Promise<any> {
    return this.get(`/threads/${id}`, { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] });
  }

  private async post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.error?.message || `Gmail HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  modifyThread(id: string, addLabelIds: string[], removeLabelIds: string[]) {
    return this.post(`/threads/${id}/modify`, { addLabelIds, removeLabelIds });
  }

  sendRaw(raw: string, threadId?: string) {
    return this.post(`/messages/send`, { raw, ...(threadId ? { threadId } : {}) });
  }

  draftRaw(raw: string, threadId?: string) {
    return this.post(`/drafts`, { message: { raw, ...(threadId ? { threadId } : {}) } });
  }

  async createDraft(opts: { threadId: string; from: string; to: string; subject: string; inReplyTo?: string; body: string }): Promise<{ id: string; messageId: string }> {
    const encodeHeader = (s: string) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
    const subject = /^re:/i.test(opts.subject) ? opts.subject : `Re: ${opts.subject || ""}`.trim();
    const lines = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${encodeHeader(subject)}`,
      opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : "",
      opts.inReplyTo ? `References: ${opts.inReplyTo}` : "",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      opts.body,
    ].filter((l, i, arr) => l !== "" || i === arr.length - 2);
    const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
    const res = await fetch(`${API}/drafts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw, threadId: opts.threadId } }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Draft create failed (${res.status})`);
    return { id: data.id, messageId: data.message?.id };
  }
}

// ---------------------------------------------------------------------------
// Message parsing & filtering
// ---------------------------------------------------------------------------
export interface ParsedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  from: { name: string; email: string };
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  messageIdHeader?: string;
  body: string;
  isNewsletter: boolean;
  internalDate: string;
}

export function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: raw.trim().toLowerCase() };
}

function splitAddresses(raw: string): string[] {
  return (raw || "")
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => parseAddress(s).email)
    .filter((e) => e.includes("@"));
}

function decode(data?: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function findBody(part: any): { plain: string; html: string } {
  let plain = "";
  let html = "";
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data && !plain) plain = decode(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = decode(p.body.data);
    (p.parts || []).forEach(walk);
  };
  walk(part);
  return { plain, html };
}

export function parseMessage(msg: any): ParsedMessage {
  const headers: Record<string, string> = {};
  for (const h of msg.payload?.headers || []) headers[String(h.name).toLowerCase()] = String(h.value);
  const { plain, html } = findBody(msg.payload);
  const precedence = (headers["precedence"] || "").toLowerCase();
  return {
    id: msg.id,
    threadId: msg.threadId,
    labelIds: msg.labelIds || [],
    from: parseAddress(headers["from"] || ""),
    to: splitAddresses(headers["to"] || ""),
    cc: splitAddresses(headers["cc"] || ""),
    subject: headers["subject"] || "",
    date: headers["date"] || "",
    messageIdHeader: headers["message-id"],
    body: plain || htmlToText(html),
    isNewsletter: Boolean(headers["list-unsubscribe"] || headers["list-id"] || precedence === "bulk" || precedence === "list"),
    internalDate: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
  };
}

const NOREPLY = /(no-?reply|do-?not-?reply|donotreply|notifications?@|mailer-daemon|postmaster|newsletter|bounce|updates@|alerts?@|news@|marketing@)/i;
const SKIP_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "SPAM", "TRASH", "DRAFT", "CHAT"];

export function shouldSkip(m: ParsedMessage, accountEmail: string): string | null {
  if (m.labelIds.some((l) => SKIP_LABELS.includes(l))) return "category";
  const sent = m.labelIds.includes("SENT") || m.from.email === accountEmail.toLowerCase();
  if (sent) return null;
  if (NOREPLY.test(m.from.email)) return "noreply";
  if (m.isNewsletter) return "newsletter";
  return null;
}

export const SYNC_QUERY = "newer_than:3d -category:promotions -category:social -category:forums -in:chats";
