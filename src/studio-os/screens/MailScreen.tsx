import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format, formatDistanceToNowStrict, isToday, parseISO } from "date-fns";
import {
  Archive,
  ArrowLeft,
  Download,
  ExternalLink,
  ListPlus,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { studioApi } from "../api";
import { supabase } from "../../lib/supabase";
import { ComposeModal, loadMailAccounts, MailAccountInfo, signatureOptions } from "../components/ComposeModal";
import { gmailThreadUrl } from "../InboxContext";

type Filter = "important" | "unread" | "needs_reply" | "has_task" | "all";

interface ThreadRow {
  account: string;
  thread_id: string;
  subject: string;
  from_name: string;
  from_email: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  important: boolean;
  message_count: number;
  needs_reply: boolean;
  project: { id: string; code: string; emoji: string } | null;
  tasks: Array<{ id: string; key: string; title: string }>;
}

interface ThreadMessage {
  id: string;
  message_id_header: string;
  references: string;
  from: { name: string; email: string };
  to: string;
  cc: string;
  date: string | null;
  subject: string;
  text: string;
  attachments: Array<{ filename: string; mimeType: string; size: number; attachment_id?: string }>;
  unread: boolean;
  sent: boolean;
}

interface ThreadDetail {
  thread_id: string;
  account: string;
  important: boolean;
  unread: boolean;
  messages: ThreadMessage[];
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "important", label: "Important" },
  { id: "unread", label: "Unread" },
  { id: "needs_reply", label: "Needs Reply" },
  { id: "has_task", label: "Has Pending Task" },
  { id: "all", label: "All" },
];

const shortDate = (iso: string | null) => {
  if (!iso) return "";
  const d = parseISO(iso);
  return isToday(d) ? format(d, "h:mm a") : format(d, "d MMM");
};

const ease = [0.22, 1, 0.36, 1] as const;

// ---------------------------------------------------------------------------
// Mail cache: lists and threads stay in memory while Studio OS is open, so
// switching tabs is instant. Lists refresh in the background every 10 minutes.
// ---------------------------------------------------------------------------
const REFRESH_MS = 10 * 60 * 1000;
type ListEntry = { threads: ThreadRow[]; errors: string[]; at: number };
const listCache = new Map<string, ListEntry>();
const inflight = new Map<string, Promise<ListEntry>>();
const detailCache = new Map<string, ThreadDetail>();
let accountsCache: MailAccountInfo[] | null = null;
const listeners = new Set<() => void>();

const listKey = (filter: Filter, account: string, q: string) => JSON.stringify([filter, account, q]);

function fetchList(filter: Filter, account: string, q: string): Promise<ListEntry> {
  const key = listKey(filter, account, q);
  const running = inflight.get(key);
  if (running) return running;
  const params = new URLSearchParams({ filter });
  if (account) params.set("account", account);
  if (q) params.set("q", q);
  const p = studioApi<{ threads: ThreadRow[]; errors: string[] }>(`/api/studio-os/mail/threads?${params}`)
    .then((res) => {
      const entry = { threads: res.threads, errors: res.errors || [], at: Date.now() };
      listCache.set(key, entry);
      listeners.forEach((l) => l());
      return entry;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

let refreshTimer: number | null = null;
/** Load the default mail view once (call after sign-in) and keep it fresh every 10 minutes. */
export function prefetchMail() {
  if (!listCache.has(listKey("important", "", ""))) fetchList("important", "", "").catch(() => {});
  if (!accountsCache) loadMailAccounts().then((a) => (accountsCache = a)).catch(() => {});
  if (refreshTimer === null && typeof window !== "undefined") {
    refreshTimer = window.setInterval(() => {
      // Refresh every list that has been opened, quietly.
      for (const k of listCache.keys()) {
        const [f, a, q] = JSON.parse(k);
        fetchList(f, a, q).catch(() => {});
      }
    }, REFRESH_MS);
  }
}

/** Turn URLs and email addresses in plain text into clickable links. */
const LINK_RE = /(https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?\]])|(www\.[^\s<>()"']+[^\s<>()"'.,;:!?\]])|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
export function Linkified({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const raw = m[0];
    const href = m[3] ? `mailto:${raw}` : m[2] ? `https://${raw}` : raw;
    out.push(
      <a key={m.index} href={href} target={m[3] ? undefined : "_blank"} rel="noopener noreferrer" className="underline break-all" style={{ color: "var(--sos-primary)" }}>
        {raw}
      </a>
    );
    last = m.index + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

/** Download a Gmail attachment through the server (in 4 MB parts for big files). */
async function downloadAttachment(account: string, messageId: string, a: { filename: string; mimeType: string; attachment_id?: string }, open = false) {
  if (!a.attachment_id) throw new Error("This attachment can't be downloaded.");
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
  const parts: ArrayBuffer[] = [];
  let total = 1;
  for (let part = 0; part < total; part++) {
    const r = await fetch(`/api/studio-os/mail/attachment?${new URLSearchParams({ account, message_id: messageId, attachment_id: a.attachment_id, part: String(part) })}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Download failed (${r.status})`);
    }
    total = Number(r.headers.get("X-Total-Parts") || 1);
    parts.push(await r.arrayBuffer());
  }
  const url = URL.createObjectURL(new Blob(parts, { type: a.mimeType || "application/octet-stream" }));
  if (open) window.open(url, "_blank", "noopener");
  else {
    const link = document.createElement("a");
    link.href = url;
    link.download = a.filename || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const MailScreen: React.FC = () => {
  const { pushToast, openQuickAdd, isOwner } = useStudioOS();
  const [filter, setFilter] = useState<Filter>("important");
  const [account, setAccount] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const initial = listCache.get(listKey("important", "", ""));
  const [threads, setThreads] = useState<ThreadRow[]>(initial?.threads || []);
  const [errors, setErrors] = useState<string[]>(initial?.errors || []);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<MailAccountInfo[]>(accountsCache || []);
  const [selected, setSelected] = useState<ThreadRow | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (accountsCache) return;
    loadMailAccounts()
      .then((a) => {
        accountsCache = a;
        setAccounts(a);
      })
      .catch(() => setAccounts([]));
  }, []);

  /** force=true → always hit Gmail; otherwise show the cache and refresh only if older than 10 min. */
  const load = useCallback(
    async (force = false) => {
      const key = listKey(filter, account, submittedQuery);
      const hit = listCache.get(key);
      if (hit) {
        setThreads(hit.threads);
        setErrors(hit.errors);
        if (!force && Date.now() - hit.at < REFRESH_MS) return;
      }
      setLoading(true);
      try {
        const res = await fetchList(filter, account, submittedQuery);
        setThreads(res.threads);
        setErrors(res.errors);
      } catch (err: any) {
        if (!hit) setErrors([err?.message || "Could not load mail"]);
      } finally {
        setLoading(false);
      }
    },
    [filter, account, submittedQuery]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Background refreshes (every 10 min) update the open list without a spinner.
  useEffect(() => {
    prefetchMail();
    const onUpdate = () => {
      const hit = listCache.get(listKey(filter, account, submittedQuery));
      if (hit) {
        setThreads(hit.threads);
        setErrors(hit.errors);
      }
    };
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [filter, account, submittedQuery]);

  const openThread = async (t: ThreadRow) => {
    setSelected(t);
    const dkey = `${t.account}:${t.thread_id}:${t.message_count}`;
    const cachedDetail = detailCache.get(dkey);
    setDetail(cachedDetail || null);
    setDetailLoading(!cachedDetail);
    try {
      const d = cachedDetail || (await studioApi<ThreadDetail>(`/api/studio-os/mail/thread/${t.thread_id}?account=${encodeURIComponent(t.account)}`));
      detailCache.set(dkey, d);
      if (detailCache.size > 80) detailCache.delete(detailCache.keys().next().value as string);
      setDetail(d);
      if (t.unread && accounts.find((a) => a.email === t.account)?.can_modify) {
        studioApi("/api/studio-os/mail/modify", { body: { account: t.account, thread_id: t.thread_id, action: "read" } }).catch(() => {});
        setThreads((prev) => prev.map((x) => (x.thread_id === t.thread_id ? { ...x, unread: false } : x)));
      }
    } catch (err: any) {
      pushToast(err?.message || "Couldn't open this email", "warn");
    } finally {
      setDetailLoading(false);
    }
  };

  const modify = async (action: "read" | "unread" | "important" | "unimportant" | "archive") => {
    if (!selected) return;
    try {
      await studioApi("/api/studio-os/mail/modify", { body: { account: selected.account, thread_id: selected.thread_id, action } });
      if (action === "archive") {
        setThreads((prev) => prev.filter((x) => x.thread_id !== selected.thread_id));
        setSelected(null);
        setDetail(null);
        pushToast("Archived", "info");
        return;
      }
      setThreads((prev) =>
        prev.map((x) =>
          x.thread_id === selected.thread_id
            ? { ...x, unread: action === "unread" ? true : action === "read" ? false : x.unread, important: action === "important" ? true : action === "unimportant" ? false : x.important }
            : x
        )
      );
      setDetail((d) => (d ? { ...d, important: action === "important" ? true : action === "unimportant" ? false : d.important, unread: action === "unread" } : d));
      pushToast(action === "unread" ? "Marked unread" : action === "read" ? "Marked read" : action === "important" ? "Marked important" : "Removed from important", "info");
    } catch (err: any) {
      pushToast(err?.message || "Gmail update failed", "warn");
    }
  };

  const visible = useMemo(() => threads, [threads]);

  if (!isOwner) return null;

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            Mail
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Important and unread first. Nothing is ever sent without you pressing Send.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => load(true)} className="sos-pill-btn h-11 w-11 inline-flex items-center justify-center border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }} aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={() => setComposeOpen(true)} className="sos-pill-btn h-11 px-5 text-[14px] font-semibold text-white inline-flex items-center gap-2" style={{ background: "var(--sos-primary)" }}>
            <PenSquare className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Thread list */}
        <section className={`lg:col-span-5 space-y-3 ${selected ? "hidden lg:block" : ""}`} aria-label="Threads">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter mail">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className="relative min-h-[40px] px-3.5 rounded-full text-[13px] font-medium"
                style={{ color: filter === f.id ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
              >
                {filter === f.id && <motion.span layoutId="mail-filter-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--sos-ink)" }} transition={{ duration: 0.2, ease }} />}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)} className="h-11 px-3 rounded-full border text-[13px] max-w-[45%]" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.email}>{a.email}</option>
              ))}
            </select>
            <form
              className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full border"
              style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
              onSubmit={(e) => {
                e.preventDefault();
                setSubmittedQuery(query.trim());
              }}
            >
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
              <input aria-label="Search mail" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" className="w-full bg-transparent outline-none text-[13px]" style={{ color: "var(--sos-text-1)" }} />
            </form>
          </div>

          {errors.length > 0 && (
            <p className="text-[12px] px-3 py-2 rounded-[12px]" style={{ background: "#FFF1E6", color: "#9A3412" }}>
              {errors.join(" · ")}
            </p>
          )}

          <div className="sos-card p-1.5 md:p-2 max-h-[70vh] overflow-y-auto">
            {loading && !visible.length && (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--sos-primary)" }} />
              </div>
            )}
            {!loading && !visible.length && (
              <div className="py-12 text-center space-y-1">
                <Mail className="w-5 h-5 mx-auto" style={{ color: "var(--sos-text-3)" }} />
                <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                  {accounts.length ? "Nothing here — calm inbox." : "Connect a Gmail account in Settings."}
                </p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {visible.map((t, i) => {
                const active = selected?.thread_id === t.thread_id;
                return (
                  <motion.button
                    key={`${t.account}:${t.thread_id}`}
                    layout
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease, delay: Math.min(i, 10) * 0.03 } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                    onClick={() => openThread(t)}
                    className="w-full text-left px-3 py-3 rounded-[16px] flex gap-3 items-start"
                    style={{ background: active ? "var(--sos-violet-soft)" : "transparent" }}
                  >
                    <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: t.unread ? "var(--sos-primary)" : "transparent" }} aria-label={t.unread ? "Unread" : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-[13px] truncate ${t.unread ? "font-bold" : "font-medium"}`} style={{ color: "var(--sos-text-1)" }}>
                          {t.from_name}
                          {t.message_count > 1 && <span className="font-normal" style={{ color: "var(--sos-text-3)" }}> · {t.message_count}</span>}
                        </span>
                        <span className="text-[11px] shrink-0 sos-tabular" style={{ color: "var(--sos-text-3)" }}>{shortDate(t.date)}</span>
                      </span>
                      <span className={`block text-[13px] truncate ${t.unread ? "font-semibold" : ""}`} style={{ color: "var(--sos-text-1)" }}>
                        {t.important && <Star className="inline w-3 h-3 mr-1 -mt-0.5" style={{ color: "#9A4A00", fill: "#F6CB45" }} aria-label="Important" />}
                        {t.subject}
                      </span>
                      <span className="block text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>{t.snippet}</span>
                      {(t.project || t.tasks.length > 0 || t.needs_reply) && (
                        <span className="flex flex-wrap gap-1.5 mt-1.5">
                          {t.project && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                              {t.project.emoji} {t.project.code}
                            </span>
                          )}
                          {t.needs_reply && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "#FFF3E0", color: "#9A4A00" }}>Reply owed</span>
                          )}
                          {t.tasks.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "#E8F0FF", color: "#1D4FD8" }}>
                              {t.tasks.length} task{t.tasks.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Reader */}
        <section className={`lg:col-span-7 ${selected ? "" : "hidden lg:block"}`} aria-label="Conversation">
          {!selected ? (
            <div className="sos-card p-10 text-center text-[13px]" style={{ color: "var(--sos-text-3)" }}>
              Select a conversation to read it here.
            </div>
          ) : (
            <motion.div key={selected.thread_id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease }} className="space-y-3">
              <div className="sos-card p-4 md:p-5 space-y-3">
                <button type="button" onClick={() => setSelected(null)} className="lg:hidden text-[13px] font-medium inline-flex items-center gap-1.5 min-h-[44px]" style={{ color: "var(--sos-text-2)" }}>
                  <ArrowLeft className="w-4 h-4" /> All mail
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="sos-display text-[20px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>{selected.subject}</h2>
                    <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                      {selected.account}
                      {selected.project ? ` · ${selected.project.emoji} ${selected.project.code}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ActionBtn onClick={() => modify(detail?.unread ? "read" : "unread")} icon={detail?.unread ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />} label={detail?.unread ? "Mark read" : "Mark unread"} />
                  <ActionBtn onClick={() => modify(detail?.important ? "unimportant" : "important")} icon={<Star className="w-4 h-4" style={detail?.important ? { fill: "#F6CB45", color: "#9A4A00" } : undefined} />} label={detail?.important ? "Important" : "Mark important"} />
                  <ActionBtn onClick={() => modify("archive")} icon={<Archive className="w-4 h-4" />} label="Archive" />
                  <ActionBtn
                    onClick={() => openQuickAdd(`${selected.subject} — reply to ${selected.from_name}${selected.project ? ` #${selected.project.code}` : ""}`)}
                    icon={<ListPlus className="w-4 h-4" />}
                    label="Create task"
                  />
                  <a href={gmailThreadUrl(selected.account, selected.thread_id)} target="_blank" rel="noopener noreferrer" className="min-h-[44px] px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                    <ExternalLink className="w-4 h-4" /> Gmail
                  </a>
                </div>
              </div>

              {detailLoading && (
                <div className="sos-card py-12 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--sos-primary)" }} />
                </div>
              )}

              {detail?.messages.map((m, idx) => (
                <MessageCard key={m.id} m={m} account={detail.account} defaultOpen={idx >= detail.messages.length - 2} />
              ))}

              {detail && <QuickReply detail={detail} row={selected} accounts={accounts} onSent={() => load(true)} />}
            </motion.div>
          )}
        </section>
      </div>

      <AnimatePresence>{composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}</AnimatePresence>
    </div>
  );
};

const ActionBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button type="button" onClick={onClick} className="sos-pill-btn min-h-[44px] px-3.5 text-[12px] font-semibold inline-flex items-center gap-1.5 border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
    {icon} {label}
  </button>
);

const MessageCard: React.FC<{ m: ThreadMessage; account: string; defaultOpen: boolean }> = ({ m, account, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [busyAtt, setBusyAtt] = useState<number | null>(null);
  const [attError, setAttError] = useState("");
  const grab = async (i: number, openIt: boolean) => {
    setBusyAtt(i);
    setAttError("");
    try {
      await downloadAttachment(account, m.id, m.attachments[i], openIt);
    } catch (e: any) {
      setAttError(e?.message || "Download failed");
    } finally {
      setBusyAtt(null);
    }
  };
  return (
    <div className="sos-card p-4 md:p-5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-start justify-between gap-3" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
            {m.sent ? "You" : m.from.name || m.from.email}
            <span className="font-normal text-[12px]" style={{ color: "var(--sos-text-3)" }}> &lt;{m.from.email}&gt;</span>
          </span>
          <span className="block text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
            to {m.to}
            {m.cc ? ` · cc ${m.cc}` : ""}
          </span>
        </span>
        <span className="text-[12px] shrink-0 sos-tabular" style={{ color: "var(--sos-text-3)" }}>
          {m.date ? formatDistanceToNowStrict(parseISO(m.date), { addSuffix: true }) : ""}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
            <pre className="mt-3 whitespace-pre-wrap break-words font-[inherit] text-[14px] leading-relaxed" style={{ color: "var(--sos-text-1)" }}>
              {m.text ? <Linkified text={m.text} /> : "(no text content)"}
            </pre>
            {m.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.attachments.map((a, i) => {
                  const viewable = /^(image\/|application\/pdf|text\/|video\/|audio\/)/.test(a.mimeType || "");
                  return (
                    <span key={i} className="inline-flex items-center rounded-full text-[12px] overflow-hidden" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                      <button type="button" disabled={busyAtt !== null} onClick={() => grab(i, false)} className="inline-flex items-center gap-1.5 pl-3 pr-2.5 h-8 hover:opacity-80 disabled:opacity-60" title={`Download ${a.filename}`}>
                        {busyAtt === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" style={{ color: "var(--sos-primary)" }} />}
                        <span className="max-w-[220px] truncate">{a.filename}</span>
                        <span style={{ color: "var(--sos-text-3)" }}>{fmtSize(a.size)}</span>
                      </button>
                      {viewable && (
                        <button type="button" disabled={busyAtt !== null} onClick={() => grab(i, true)} className="h-8 px-2.5 border-l text-[11px] font-semibold hover:opacity-80" style={{ borderColor: "var(--sos-border)", color: "var(--sos-primary)" }} title="Open in a new tab">
                          Open
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {attError && <p className="mt-2 text-[12px]" style={{ color: "#B42318" }}>{attError}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuickReply: React.FC<{ detail: ThreadDetail; row: ThreadRow; accounts: MailAccountInfo[]; onSent: () => void }> = ({ detail, row, accounts, onSent }) => {
  const { pushToast } = useStudioOS();
  const [body, setBody] = useState("");
  const acct = accounts.find((a) => a.email === detail.account);
  const [signature, setSignature] = useState(acct?.has_signature ? detail.account : "default");
  const [busy, setBusy] = useState<"ai" | "send" | "draft" | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastInbound = [...detail.messages].reverse().find((m) => !m.sent) || detail.messages[detail.messages.length - 1];
  const replyTo = lastInbound?.from.email || row.from_email;

  const aiDraft = async () => {
    setBusy("ai");
    try {
      const res = await studioApi<{ text: string }>("/api/studio-os/mail/ai-draft", { body: { account: detail.account, thread_id: detail.thread_id } });
      setBody(res.text);
      setTimeout(() => ref.current?.focus(), 30);
    } catch (err: any) {
      pushToast(err?.message || "AI draft unavailable", "warn");
    } finally {
      setBusy(null);
    }
  };

  const submit = async (mode: "send" | "draft") => {
    if (!body.trim()) return pushToast("Write a reply first", "warn");
    setBusy(mode);
    try {
      await studioApi("/api/studio-os/mail/send", {
        body: {
          account: detail.account,
          to: [replyTo],
          subject: lastInbound?.subject || row.subject,
          body,
          thread_id: detail.thread_id,
          in_reply_to: lastInbound?.message_id_header || undefined,
          references: [lastInbound?.references, lastInbound?.message_id_header].filter(Boolean).join(" ") || undefined,
          signature,
          mode,
          project_id: row.project?.id,
        },
      });
      pushToast(mode === "send" ? `Reply sent to ${replyTo}` : "Draft saved in Gmail", "success");
      setBody("");
      if (mode === "send") onSent();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't send", "warn");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sos-card p-4 md:p-5 space-y-3">
      <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-2)" }}>
        Reply to {replyTo} from {detail.account}
      </p>
      <textarea
        ref={ref}
        aria-label="Quick reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Write a reply…"
        className="w-full px-3.5 py-3 rounded-[14px] border text-[14px] leading-relaxed resize-y"
        style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={aiDraft} className="sos-pill-btn min-h-[44px] px-4 text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
            {busy === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Draft Reply
          </button>
          <select aria-label="Signature" value={signature} onChange={(e) => setSignature(e.target.value)} className="h-11 px-3 rounded-full border text-[13px]" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
            {signatureOptions(accounts).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => submit("draft")} className="sos-pill-btn h-11 px-4 text-[13px] font-medium border inline-flex items-center gap-1.5 disabled:opacity-50" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
            {busy === "draft" && <Loader2 className="w-4 h-4 animate-spin" />} Save Draft
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || (acct && !acct.can_send)}
            title={acct && !acct.can_send ? "Reconnect this account in Settings to allow sending" : undefined}
            onClick={() => submit("send")}
            className="sos-pill-btn h-11 px-5 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: "var(--sos-primary)" }}
          >
            {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Reply
          </button>
        </div>
      </div>
    </div>
  );
};
