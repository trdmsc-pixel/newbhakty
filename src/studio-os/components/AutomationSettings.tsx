import React, { useCallback, useEffect, useState } from "react";
import { differenceInDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bot, Check, Copy, KeyRound, Loader2, Mail, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { GmailAccount } from "../InboxContext";
import { studioApi } from "../api";
import { SignaturesEditor } from "./SignaturesEditor";

interface AIStatus {
  claude: boolean;
  gemini: boolean;
  claudeModel: string;
  geminiModel: string;
  google: boolean;
  hmac: boolean;
}

interface IngestToken {
  id: string;
  label: string;
  token_hint: string | null;
  last_used_at: string | null;
  created_at: string;
  scope?: string;
}

const EXPECTED_ACCOUNTS = ["shyam@thechantingstudio.in", "studio@thechantingstudio.in", "accounts@thechantingstudio.in"];

const ago = (iso?: string | null) => {
  if (!iso) return "never";
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
};

const sectionTitle = (icon: React.ReactNode, title: string, sub: string) => (
  <div>
    <h3 className="sos-display text-[18px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
      {icon}
      {title}
    </h3>
    <p className="text-[12px] mt-0.5" style={{ color: "var(--sos-text-3)" }}>
      {sub}
    </p>
  </div>
);

export const AutomationSettings: React.FC = () => {
  const { settings, updateSettings, pushToast, supabaseSyncStatus, reloadFromCloud } = useStudioOS();
  const [scanDays, setScanDays] = useState(60);
  const [scan, setScan] = useState<{ running: boolean; processed: number; items: number; note?: string } | null>(null);
  /** Re-read recent client mail (after a fresh start / new clients) so tasks, statuses and replies owed match the inbox. */
  const scanClientMail = async () => {
    setScan({ running: true, processed: 0, items: 0 });
    let processed = 0;
    let items = 0;
    try {
      for (let round = 0; round < 12; round++) {
        const res = await studioApi<any>(`/api/cron/gmail-sync?backfill_days=${scanDays}`, { method: "POST", body: {} });
        if (res.skippedReason) {
          setScan({ running: false, processed, items, note: res.skippedReason });
          return;
        }
        const accounts = res.accounts || [];
        processed += accounts.reduce((s: number, a: any) => s + (a.processed || 0) + (a.skipped || 0), 0);
        items += accounts.reduce((s: number, a: any) => s + (a.items || 0), 0);
        const errors = accounts.map((a: any) => a.error).filter(Boolean);
        setScan({ running: true, processed, items });
        if (errors.length) {
          setScan({ running: false, processed, items, note: `Stopped: ${errors[0]}` });
          return;
        }
        if (!res.remaining) break;
      }
      setScan({ running: false, processed, items, note: "Done — check Inbox for suggestions; confident ones were applied automatically." });
      reloadFromCloud();
    } catch (err: any) {
      setScan({ running: false, processed, items, note: err?.message || "Scan failed" });
    }
  };
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [tokens, setTokens] = useState<IngestToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gmailResult, setGmailResult] = useState<{ status: string; detail: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem("sos_gmail_result");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [diag, setDiag] = useState<{ ok: boolean; checks: Array<{ check: string; ok: boolean; detail: string }> } | null>(null);
  const cloud = supabaseSyncStatus === "synced" && supabase;

  const runDiagnose = async () => {
    setBusy("diag");
    try {
      setDiag(await studioApi("/api/studio-os/gmail/diagnose"));
    } catch (err: any) {
      pushToast(err?.message || "Check failed", "warn");
    } finally {
      setBusy(null);
    }
  };

  const explain = (r: { status: string; detail: string }) => {
    const d = r.detail || "";
    if (r.status === "connected") return `Connected ${d}. First sync runs within 15 minutes.`;
    if (r.status === "token_exchange") {
      if (/invalid_client/.test(d)) return "Google rejected the client secret/ID (invalid_client). Create a new client secret in Google Cloud → Clients, paste it into Vercel as GOOGLE_CLIENT_SECRET, redeploy, then connect again.";
      if (/redirect_uri_mismatch/.test(d)) return "The redirect URI isn't registered. Run “Check Google setup” and add the URI it shows to Authorised redirect URIs.";
      return `Google refused the sign-in code: ${d}`;
    }
    if (r.status === "gmail_api") {
      if (/has not been used|disabled|accessNotConfigured/i.test(d)) return "The Gmail API isn't enabled in your Google Cloud project. Open APIs & Services → Library → Gmail API → Enable, wait a minute, then connect again.";
      return `Signed in, but the Gmail API call failed: ${d}`;
    }
    if (r.status === "no_refresh_token") return "Google didn't return a long-term token. Remove “Studio OS” at myaccount.google.com → Security → Third-party access, then connect again.";
    if (r.status === "denied") return `Google sign-in was cancelled or blocked (${d || "access_denied"}). If the app is Internal, only @thechantingstudio.in accounts can connect.`;
    if (r.status === "expired") return "The sign-in link expired (10 minutes). Please try again.";
    if (r.status === "save_failed") return `Connected to Google but saving failed: ${d}`;
    return `Connection failed (${r.status}) ${d}`;
  };

  const load = useCallback(async () => {
    if (!cloud || !supabase) return;
    studioApi<AIStatus>("/api/studio-os/ai/status").then(setStatus).catch(() => setStatus(null));
    const [{ data: acc }, { data: tok }] = await Promise.all([
      supabase
        .from("studio_gmail_accounts")
        .select("id, email, label, is_personal, connected_at, needs_reconnect, last_sync_at, last_error, messages_processed, is_active, granted_scopes")
        .is("archived_at", null)
        .order("email"),
      supabase.from("studio_ingest_tokens").select("id, label, token_hint, last_used_at, created_at, scope").is("revoked_at", null).order("created_at", { ascending: false }),
    ]);
    setAccounts((acc || []) as GmailAccount[]);
    setTokens((tok || []) as IngestToken[]);
  }, [cloud]);

  useEffect(() => {
    load();
  }, [load]);

  const connectGmail = async (hint?: string) => {
    setBusy("connect");
    try {
      const { url } = await studioApi<{ url: string }>(`/api/studio-os/gmail/auth-url${hint ? `?hint=${encodeURIComponent(hint)}` : ""}`);
      window.location.href = url;
    } catch (err: any) {
      pushToast(err?.message || "Could not start Google sign-in", "warn");
      setBusy(null);
    }
  };

  const disconnect = async (acc: GmailAccount) => {
    if (!window.confirm(`Disconnect ${acc.email}? Its stored token will be deleted.`)) return;
    setBusy(acc.id);
    try {
      await studioApi("/api/studio-os/gmail/disconnect", { body: { account_id: acc.id } });
      pushToast(`Disconnected ${acc.email}`, "info");
      load();
    } catch (err: any) {
      pushToast(err?.message || "Could not disconnect", "warn");
    } finally {
      setBusy(null);
    }
  };

  const createToken = async () => {
    setBusy("token");
    try {
      const res = await studioApi<IngestToken & { token: string }>("/api/studio-os/ingest-tokens", { body: { label: "iPhone Shortcut" } });
      setNewToken(res.token);
      load();
    } catch (err: any) {
      pushToast(err?.message || "Could not create token", "warn");
    } finally {
      setBusy(null);
    }
  };

  const [claudeUrl, setClaudeUrl] = useState("");
  const createClaudeLink = async () => {
    setBusy("claude");
    try {
      const res = await studioApi<IngestToken & { token: string }>("/api/studio-os/ingest-tokens", { body: { label: "Claude connector", scope: "claude" } });
      setClaudeUrl(`${window.location.origin}/api/mcp/${res.token}`);
      load();
    } catch (err: any) {
      pushToast(err?.message || "Could not create the Claude link", "warn");
    } finally {
      setBusy(null);
    }
  };

  const revokeToken = async (id: string) => {
    if (!window.confirm("Revoke this token? Shortcuts using it will stop working.")) return;
    await studioApi(`/api/studio-os/ingest-tokens/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const missingNewScopes = (a: GmailAccount) => Boolean(a.granted_scopes) && !/gmail\.modify/.test(a.granted_scopes || "");
  const needsReconnect = (a: GmailAccount) =>
    a.needs_reconnect ||
    !a.granted_scopes ||
    missingNewScopes(a) || (a.is_personal && a.connected_at ? differenceInDays(new Date(), parseISO(a.connected_at)) >= 7 : false);

  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/ingest` : "/api/ingest";

  if (!cloud) {
    return (
      <section className="sos-card p-6 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
        Automatic inputs (Gmail, WhatsApp, Shortcuts) need Supabase cloud sync.
      </section>
    );
  }

  return (
    <>
      {/* AI provider */}
      <section className="sos-card p-6 space-y-4">
        {sectionTitle(<Bot className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />, "AI provider", "Used to read emails and messages. Cheapest fast model of each provider; amounts from confidential projects are never sent.")}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
            {(["gemini", "claude"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateSettings({ ai_provider: p })}
                className="px-4 h-9 rounded-full text-[13px] font-medium"
                style={{ background: settings.ai_provider === p ? "var(--sos-ink)" : "transparent", color: settings.ai_provider === p ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
              >
                {p === "gemini" ? "Google Gemini" : "Anthropic Claude"}
              </button>
            ))}
          </div>
          {status && (
            <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              {settings.ai_provider === "gemini" ? status.geminiModel : status.claudeModel} ·{" "}
              {(settings.ai_provider === "gemini" ? status.gemini : status.claude)
                ? "key set"
                : (settings.ai_provider === "gemini" ? status.claude : status.gemini)
                ? "key missing — will fall back to the other provider"
                : "no AI key set in Vercel"}
            </span>
          )}
        </div>
      </section>

      {/* Gmail */}
      <section className="sos-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {sectionTitle(<Mail className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />, "Gmail accounts", "Read, label and send — only when you press Send. Synced every 15 minutes.")}
          <button
            type="button"
            disabled={busy === "connect" || status?.google === false}
            onClick={() => connectGmail()}
            className="sos-pill-btn h-9 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-45"
            style={{ background: "var(--sos-primary)" }}
          >
            {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect account
          </button>
        </div>
        <div className="p-3.5 rounded-[16px] space-y-2.5" style={{ background: "var(--sos-surface-2)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Scan client mail</p>
          <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
            Re-reads recent emails to and from your clients' contacts and domains, then matches them to clients, projects and tasks — promises, replies owed, approvals and delivery updates. Run it after adding clients. Each email uses one Gemini Flash-Lite request (500/day free).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={scanDays} onChange={(e) => setScanDays(Number(e.target.value))} disabled={scan?.running} className="h-9 px-3 rounded-full border text-[13px]" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} aria-label="How far back">
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button type="button" disabled={scan?.running || status?.google === false} onClick={scanClientMail} className="sos-pill-btn h-9 px-4 text-[13px] font-semibold border inline-flex items-center gap-1.5 disabled:opacity-50" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
              {scan?.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {scan?.running ? "Scanning…" : "Scan now"}
            </button>
            {scan && (
              <span className="text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                {scan.processed} emails read · {scan.items} suggestions{scan.note ? ` — ${scan.note}` : ""}
              </span>
            )}
          </div>
        </div>
        {gmailResult && (
          <div
            className="p-3.5 rounded-[14px] text-[13px] flex items-start justify-between gap-3"
            style={gmailResult.status === "connected" ? { background: "#E7F7EE", color: "#17663F" } : { background: "#FFF1E6", color: "#9A3412" }}
            role="status"
          >
            <span>{explain(gmailResult)}</span>
            <button
              type="button"
              onClick={() => {
                setGmailResult(null);
                try {
                  sessionStorage.removeItem("sos_gmail_result");
                } catch {
                  /* ignore */
                }
              }}
              className="shrink-0 text-[12px] font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy === "diag"}
            onClick={runDiagnose}
            className="min-h-[44px] px-4 rounded-full text-[12px] font-semibold border inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
          >
            {busy === "diag" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Check Google setup
          </button>
          {diag && (
            <span className="text-[12px] font-semibold" style={{ color: diag.ok ? "#17663F" : "#9A3412" }}>
              {diag.ok ? "Google setup looks right" : "Something needs fixing ↓"}
            </span>
          )}
        </div>
        {diag && (
          <ul className="space-y-1 text-[12px]">
            {diag.checks.map((c) => (
              <li key={c.check} className="flex gap-2">
                <span style={{ color: c.ok ? "#17663F" : "#9A3412" }}>{c.ok ? "✓" : "✕"}</span>
                <span style={{ color: "var(--sos-text-2)" }}>
                  <strong style={{ color: "var(--sos-text-1)" }}>{c.check}:</strong> <span className="break-all">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {status?.google === false && (
          <p className="text-[12px] px-3 py-2 rounded-[12px]" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
            Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel to enable Gmail.
          </p>
        )}

        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.last_error ? "var(--sos-text-3)" : "var(--sos-green)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                  {a.email}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
                  Synced {ago(a.last_sync_at)} · {a.messages_processed} read{a.last_error && !needsReconnect(a) ? ` · ${a.last_error}` : ""}
                </p>
              </div>
              {needsReconnect(a) && (
                <button
                  type="button"
                  onClick={() => connectGmail(a.email)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)", border: "1px solid var(--sos-border)" }}
                  title={
                    !a.granted_scopes || missingNewScopes(a)
                      ? "Reconnect once to grant the new Mail permissions (read/label, send)."
                      : a.is_personal
                      ? "Personal Gmail tokens expire every 7 days while the Google app is in testing mode."
                      : "Google asked to re-authorise this account."
                  }
                >
                  <RefreshCw className="w-3 h-3" /> Reconnect
                </button>
              )}
              <button
                type="button"
                disabled={busy === a.id}
                onClick={() => disconnect(a)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: "var(--sos-text-3)" }}
                aria-label={`Disconnect ${a.email}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {EXPECTED_ACCOUNTS.filter((e) => !accounts.some((a) => a.email === e)).map((e) => (
            <button
              key={e}
              type="button"
              disabled={status?.google === false}
              onClick={() => connectGmail(e)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] border border-dashed text-left disabled:opacity-50"
              style={{ borderColor: "var(--sos-border)" }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: "var(--sos-text-3)" }} />
              <span className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
                Connect {e}
              </span>
            </button>
          ))}
          {!accounts.some((a) => a.is_personal) && (
            <p className="text-[11px] px-1" style={{ color: "var(--sos-text-3)" }}>
              A personal @gmail.com can be added too — use “Connect account”.
            </p>
          )}
        </div>
        {accounts.length > 0 && <SignaturesEditor />}
      </section>

      {/* Claude connector (MCP) */}
      <section className="sos-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {sectionTitle(<Bot className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />, "Connect Claude", "Let Claude (claude.ai) read and update your clients, projects and tasks from your chats.")}
          <button
            type="button"
            disabled={busy === "claude"}
            onClick={createClaudeLink}
            className="sos-pill-btn h-9 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: "var(--sos-primary)" }}
          >
            {busy === "claude" ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Create Claude link
          </button>
        </div>
        {claudeUrl && (
          <div className="p-4 rounded-[16px] space-y-2" style={{ background: "var(--sos-violet-soft)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
              Copy this connector URL now — it won’t be shown again. Anyone with it can edit Studio OS, so keep it private.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[12px] px-3 py-2 rounded-[10px]" style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }}>
                {claudeUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(claudeUrl);
                  pushToast("Connector URL copied", "success");
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                aria-label="Copy connector URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <ol className="text-[12px] space-y-1.5 list-decimal pl-4" style={{ color: "var(--sos-text-2)" }}>
          <li>Click <strong>Create Claude link</strong> and copy the URL.</li>
          <li>On claude.ai: <strong>Settings → Connectors → Add custom connector</strong>. Name it “Studio OS”, paste the URL, click Add (no OAuth needed).</li>
          <li>In a chat, turn on Studio OS from the tools menu and ask, e.g. “Update Studio OS with every client and project we’ve discussed — current status, stages and open to-dos.”</li>
          <li>Claude shows each change before making it. Revoke the link below any time to cut access.</li>
        </ol>
      </section>

      {/* Ingest tokens & Shortcuts */}
      <section className="sos-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {sectionTitle(<Smartphone className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />, "Send to Studio OS", "Share WhatsApp messages, screenshots or notes from your phone.")}
          <button
            type="button"
            disabled={busy === "token"}
            onClick={createToken}
            className="sos-pill-btn h-9 px-4 text-[13px] font-medium border inline-flex items-center gap-1.5"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
          >
            {busy === "token" ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} New secret token
          </button>
        </div>

        {newToken && (
          <div className="p-4 rounded-[16px] space-y-2" style={{ background: "var(--sos-violet-soft)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
              Copy this token now — it won’t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[12px] px-3 py-2 rounded-[10px]" style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }}>
                {newToken}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(newToken);
                  pushToast("Token copied", "success");
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                aria-label="Copy token"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {tokens.length > 0 && (
          <div className="space-y-1.5">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
                <KeyRound className="w-3.5 h-3.5" style={{ color: "var(--sos-text-3)" }} />
                <span className="text-[13px] flex-1" style={{ color: "var(--sos-text-1)" }}>
                  {t.label} <span style={{ color: "var(--sos-text-3)" }}>{t.token_hint}</span>
                  {t.scope === "claude" && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>Claude</span>}
                </span>
                <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
                  used {ago(t.last_used_at)}
                </span>
                <button type="button" onClick={() => revokeToken(t.id)} className="text-[11px] font-medium" style={{ color: "var(--sos-text-3)" }}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-[16px] space-y-2" style={{ background: "var(--sos-surface-2)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              iPhone — Apple Shortcut
            </p>
            <ol className="text-[12px] space-y-1.5 list-decimal pl-4" style={{ color: "var(--sos-text-2)" }}>
              <li>Shortcuts app → + → name it “Send to Studio OS”.</li>
              <li>Tap ⓘ → turn on “Show in Share Sheet” (accept Text, URLs, Images).</li>
              <li>
                Add <strong>Get Contents of URL</strong>: <code className="break-all">{ingestUrl}</code>
              </li>
              <li>Method POST · Header <code>Authorization</code> = <code>Bearer &lt;your token&gt;</code></li>
              <li>
                Request Body JSON: <code>text</code> = Shortcut Input, <code>source</code> = <code>whatsapp</code>
              </li>
              <li>Add <strong>Show Notification</strong> with the result’s <code>summary</code>.</li>
            </ol>
            <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
              For screenshots: add “Base64 Encode” on the image and send it as <code>image_base64</code> with <code>image_mime</code> = image/jpeg.
            </p>
          </div>
          <div className="p-4 rounded-[16px] space-y-2" style={{ background: "var(--sos-surface-2)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Android — Share sheet
            </p>
            <ol className="text-[12px] space-y-1.5 list-decimal pl-4" style={{ color: "var(--sos-text-2)" }}>
              <li>Install Studio OS (Chrome menu → Install app).</li>
              <li>In WhatsApp, long-press a message → Share → Studio OS.</li>
              <li>Quick Add opens with the text split into tasks — tick and add.</li>
            </ol>
            <p className="text-[12px] pt-1 flex items-center gap-1.5" style={{ color: "var(--sos-text-3)" }}>
              <Check className="w-3.5 h-3.5" /> Same token works for scheduled tasks and scripts (POST {"{ text }"} to /api/ingest).
            </p>
          </div>
        </div>
      </section>
    </>
  );
};
