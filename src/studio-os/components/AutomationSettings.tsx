import React, { useCallback, useEffect, useState } from "react";
import { differenceInDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bot, Check, Copy, KeyRound, Loader2, Mail, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { GmailAccount } from "../InboxContext";
import { studioApi } from "../api";

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
  const { settings, updateSettings, pushToast, supabaseSyncStatus } = useStudioOS();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [tokens, setTokens] = useState<IngestToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cloud = supabaseSyncStatus === "synced" && supabase;

  const load = useCallback(async () => {
    if (!cloud || !supabase) return;
    studioApi<AIStatus>("/api/studio-os/ai/status").then(setStatus).catch(() => setStatus(null));
    const [{ data: acc }, { data: tok }] = await Promise.all([
      supabase
        .from("studio_gmail_accounts")
        .select("id, email, label, is_personal, connected_at, needs_reconnect, last_sync_at, last_error, messages_processed, is_active")
        .is("archived_at", null)
        .order("email"),
      supabase.from("studio_ingest_tokens").select("id, label, token_hint, last_used_at, created_at").is("revoked_at", null).order("created_at", { ascending: false }),
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

  const revokeToken = async (id: string) => {
    if (!window.confirm("Revoke this token? Shortcuts using it will stop working.")) return;
    await studioApi(`/api/studio-os/ingest-tokens/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const needsReconnect = (a: GmailAccount) =>
    a.needs_reconnect || (a.is_personal && a.connected_at ? differenceInDays(new Date(), parseISO(a.connected_at)) >= 7 : false);

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
          {sectionTitle(<Mail className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />, "Gmail accounts", "Read-only + drafts. Studio OS never sends email. Synced every 15 minutes.")}
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
                  title={a.is_personal ? "Personal Gmail tokens expire every 7 days while the Google app is in testing mode." : "Google asked to re-authorise this account."}
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
