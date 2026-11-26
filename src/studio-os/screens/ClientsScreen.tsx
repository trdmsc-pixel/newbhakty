/**
 * Clients — three views over the same data:
 *  - Cards (collapsible), List (compact rows that expand), Directory (search +
 *    full client file with portal messages). Search and filters apply to all.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  ChevronDown,
  Globe,
  KeyRound,
  LayoutGrid,
  List as ListIcon,
  Lock,
  MessageSquare,
  PanelsTopLeft,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { studioApi } from "../api";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { ClientFormModal, ContactFormModal, CredentialsModal, PortalLoginModal, type PortalLogin } from "../components/ClientManager";
import { ActivePill, EASE } from "../motion";
import type { ClientContact, StudioClient } from "../types";

type View = "cards" | "list" | "directory";
type Filter = "all" | "active" | "portal" | "waiting" | "unread";
const VIEW_KEY = "sos_clients_view";
import { CLIENT_FOCUS_KEY } from "../components/ClientPulse";

interface PortalMessage {
  id: string;
  client_id: string;
  project_id: string | null;
  body: string;
  from_studio: boolean;
  author_name: string | null;
  created_at: string;
  read_by_studio_at: string | null;
  read_by_client_at: string | null;
}

// ---------------------------------------------------------------------------
// Shared: one client's details (contacts + portal logins + projects)
// ---------------------------------------------------------------------------
interface Actions {
  live: boolean;
  onEditContact: (clientId: string, ct: ClientContact | null) => void;
  onLogin: (ct: ClientContact) => void;
  onEmailLink: (ct: ClientContact) => void;
  onRevoke: (ct: ClientContact) => void;
  onRemoveContact: (ct: ClientContact) => void;
  inviting: string | null;
}

const smallBtn = "shrink-0 inline-flex items-center gap-1 px-2.5 h-8 rounded-full text-[11px] font-semibold disabled:opacity-50";
const softStyle = { background: "var(--sos-surface)", color: "var(--sos-text-2)" };

const ClientDetail: React.FC<{ client: StudioClient; actions: Actions }> = ({ client: c, actions: a }) => {
  const { projects, openProject } = useStudioOS();
  const clientProjects = projects.filter((p) => p.client_id === c.id);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="sos-tile p-3">
          <p style={{ color: "var(--sos-text-3)" }}>Approval time</p>
          <p className="font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{c.avg_approval_latency_days} working days</p>
        </div>
        <div className="sos-tile p-3">
          <p style={{ color: "var(--sos-text-3)" }}>Time zone</p>
          <p className="font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{c.timezone} · {c.currency}</p>
        </div>
      </div>

      <div className="space-y-2">
        {c.contacts.length === 0 && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>No contacts yet.</p>}
        {c.contacts.map((ct) => (
          <div key={ct.id} className="rounded-[14px] p-2.5 space-y-1.5" style={{ background: "var(--sos-surface-2)" }}>
            <div className="flex items-start justify-between gap-2">
              <button type="button" disabled={!a.live} onClick={() => a.onEditContact(c.id, ct)} className="text-left min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                  {ct.name} {ct.role ? <span className="font-normal" style={{ color: "var(--sos-text-3)" }}>· {ct.role}</span> : null}
                </p>
                <p className="text-[12px] truncate" style={{ color: ct.email ? "var(--sos-text-2)" : "var(--sos-text-3)" }}>
                  {ct.email || "No email"}
                  {ct.phone ? ` · ${ct.phone}` : ""}
                </p>
              </button>
              {ct.is_portal_user && (
                <span
                  className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#E7F7EE", color: "#17663F" }}
                  title={ct.portal_last_login_at ? `Last signed in ${formatDistanceToNowStrict(parseISO(ct.portal_last_login_at), { addSuffix: true })}` : "Not signed in yet"}
                >
                  {ct.portal_login_id || "Portal ✓"}
                </span>
              )}
            </div>
            {a.live && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => a.onLogin(ct)} className={smallBtn} style={softStyle}>
                  <KeyRound className="w-3 h-3" /> {ct.portal_login_id && ct.is_portal_user ? "Reset password" : "Create portal login"}
                </button>
                {ct.email && (
                  <button type="button" disabled={a.inviting === ct.id} onClick={() => a.onEmailLink(ct)} className={smallBtn} style={softStyle}>
                    <Send className="w-3 h-3" /> Email link
                  </button>
                )}
                {ct.is_portal_user && (
                  <button type="button" onClick={() => a.onRevoke(ct)} className={smallBtn} style={softStyle}>
                    Turn off portal
                  </button>
                )}
                <button type="button" onClick={() => a.onRemoveContact(ct)} className={smallBtn} style={{ color: "var(--sos-text-3)" }} aria-label={`Remove ${ct.name}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
        {a.live && (
          <button type="button" onClick={() => a.onEditContact(c.id, null)} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--sos-primary)" }}>
            <Plus className="w-3.5 h-3.5" /> Add contact
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: "var(--sos-border)" }}>
        {clientProjects.map((p) => (
          <button key={p.id} type="button" onClick={() => openProject(p.id)} className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
            {p.emoji} {p.code}
          </button>
        ))}
        {clientProjects.length === 0 && <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>No projects yet</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Messages with a client (Directory view)
// ---------------------------------------------------------------------------
const ClientMessages: React.FC<{ client: StudioClient; messages: PortalMessage[]; onSent: () => void }> = ({ client, messages, onSent }) => {
  const { pushToast, projects } = useStudioOS();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const thread = messages.filter((m) => m.client_id === client.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const hasPortal = client.contacts.some((c) => c.is_portal_user);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
    const unread = thread.filter((m) => !m.from_studio && !m.read_by_studio_at).map((m) => m.id);
    if (unread.length && supabase) {
      supabase.from("studio_portal_messages").update({ read_by_studio_at: new Date().toISOString() }).in("id", unread).then(() => onSent());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, thread.length]);

  const send = async () => {
    if (!supabase || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("studio_portal_messages").insert({ client_id: client.id, body: text.trim(), from_studio: true, author_name: "The Chanting Studio" });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setText("");
    onSent();
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
        {thread.length === 0 && (
          <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
            {hasPortal ? "No messages yet. Clients can write to you from the portal; your replies show there." : "Give a contact a portal login to start messaging."}
          </p>
        )}
        {thread.map((m) => {
          const proj = projects.find((p) => p.id === m.project_id);
          return (
            <div key={m.id} className={`flex ${m.from_studio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-[16px] text-[13px] ${m.from_studio ? "rounded-br-[6px] text-white" : "rounded-bl-[6px]"}`}
                style={m.from_studio ? { background: "var(--sos-primary)" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.from_studio ? "text-white/70" : ""}`} style={m.from_studio ? undefined : { color: "var(--sos-text-3)" }}>
                  {m.from_studio ? "You" : m.author_name || "Client"}
                  {proj ? ` · ${proj.code}` : ""} · {formatDistanceToNowStrict(parseISO(m.created_at), { addSuffix: true })}
                  {m.from_studio && m.read_by_client_at ? " · Seen" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {hasPortal && (
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={2}
            placeholder={`Reply to ${client.name}… (⌘↵ to send)`}
            className="flex-1 px-3.5 py-2.5 rounded-[14px] border text-[14px] resize-none"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          />
          <button type="button" disabled={busy || !text.trim()} onClick={send} className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 shrink-0" style={{ background: "var(--sos-primary)" }} aria-label="Send reply">
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export const ClientsScreen: React.FC = () => {
  const { clients, projects, gates, pushToast, reloadFromCloud, supabaseSyncStatus } = useStudioOS();
  const live = supabaseSyncStatus === "synced";
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || "cards";
    } catch {
      return "cards";
    }
  });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<{ client: StudioClient | null } | null>(null);
  const [contactForm, setContactForm] = useState<{ clientId: string; contact: ClientContact | null } | null>(null);
  const [loginFor, setLoginFor] = useState<ClientContact | null>(null);
  const [creds, setCreds] = useState<{ login: PortalLogin; name: string } | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Deep link from a "Message from …" update: open that client in Directory.
  useEffect(() => {
    try {
      const focus = sessionStorage.getItem(CLIENT_FOCUS_KEY);
      if (focus) {
        sessionStorage.removeItem(CLIENT_FOCUS_KEY);
        setView("directory");
        setSelected(focus);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = async () => {
    if (!supabase || !live) return;
    const { data } = await supabase
      .from("studio_portal_messages")
      .select("id, client_id, project_id, body, from_studio, author_name, created_at, read_by_studio_at, read_by_client_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    setMessages((data || []) as PortalMessage[]);
  };
  useEffect(() => {
    loadMessages();
    if (!supabase || !live) return;
    const ch = supabase.channel("clients-messages").on("postgres_changes", { event: "*", schema: "public", table: "studio_portal_messages" }, () => loadMessages()).subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const stats = useMemo(() => {
    const m = new Map<string, { active: number; waiting: number; portal: boolean; unread: number; lastMsg?: string }>();
    for (const c of clients) {
      const ps = projects.filter((p) => p.client_id === c.id);
      const active = ps.filter((p) => ["active", "on_hold", "quoted"].includes(p.status)).length;
      const waiting = gates.filter((g) => g.status === "waiting_on_client" && ps.some((p) => p.id === g.project_id)).length;
      const msgs = messages.filter((x) => x.client_id === c.id);
      m.set(c.id, {
        active,
        waiting,
        portal: c.contacts.some((ct) => ct.is_portal_user),
        unread: msgs.filter((x) => !x.from_studio && !x.read_by_studio_at).length,
        lastMsg: msgs[0]?.created_at,
      });
    }
    return m;
  }, [clients, projects, gates, messages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => {
        const s = stats.get(c.id)!;
        if (filter === "active" && !s.active) return false;
        if (filter === "portal" && !s.portal) return false;
        if (filter === "waiting" && !s.waiting) return false;
        if (filter === "unread" && !s.unread) return false;
        if (!q) return true;
        const hay = [
          c.name,
          c.organisation,
          c.notes,
          ...c.contacts.flatMap((ct) => [ct.name, ct.email, ct.phone, ct.portal_login_id, ct.role]),
          ...projects.filter((p) => p.client_id === c.id).flatMap((p) => [p.code, p.title]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const sa = stats.get(a.id)!;
        const sb = stats.get(b.id)!;
        return sb.unread - sa.unread || sb.waiting - sa.waiting || sb.active - sa.active || a.name.localeCompare(b.name);
      });
  }, [clients, stats, filter, query, projects]);

  useEffect(() => {
    if (view === "directory" && (!selected || !filtered.some((c) => c.id === selected))) setSelected(filtered[0]?.id || null);
  }, [view, filtered, selected]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ---- actions ----
  const actions: Actions = {
    live,
    inviting,
    onEditContact: (clientId, contact) => setContactForm({ clientId, contact }),
    onLogin: (ct) => setLoginFor(ct),
    onEmailLink: async (ct) => {
      if (!ct.email) return;
      setInviting(ct.id);
      try {
        const res = await studioApi<{ email: string }>("/api/studio-os/portal/invite", { body: { contact_id: ct.id, email: ct.email } });
        pushToast(`Sign-in link emailed to ${res.email}`, "success");
        reloadFromCloud();
      } catch (err: any) {
        pushToast(err?.message || "Could not send the link", "warn");
      } finally {
        setInviting(null);
      }
    },
    onRevoke: async (ct) => {
      if (!window.confirm(`Turn off portal access for ${ct.name}?`)) return;
      try {
        await studioApi("/api/studio-os/portal/revoke", { body: { contact_id: ct.id } });
        pushToast("Portal access turned off", "success");
        reloadFromCloud();
      } catch (err: any) {
        pushToast(err?.message || "Couldn't revoke", "warn");
      }
    },
    onRemoveContact: async (ct) => {
      if (!window.confirm(`Remove ${ct.name} from this client?`)) return;
      try {
        await studioApi(`/api/studio-os/contacts/${ct.id}`, { method: "DELETE" });
        pushToast("Contact removed", "success");
        reloadFromCloud();
      } catch (err: any) {
        pushToast(err?.message || "Couldn't remove", "warn");
      }
    },
  };

  const archiveClient = async (c: StudioClient) => {
    if (!window.confirm(`Archive ${c.name}? Their portal logins stop working.`)) return;
    try {
      await studioApi(`/api/studio-os/clients/${c.id}`, { method: "DELETE" });
      pushToast("Client archived", "success");
      reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't archive", "warn");
    }
  };

  const Badges: React.FC<{ c: StudioClient }> = ({ c }) => {
    const s = stats.get(c.id)!;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {s.unread > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#B42318] text-white sos-pulse-badge">{s.unread} new</span>}
        {s.waiting > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FFF3E0] text-[#9A4A00]">{s.waiting} awaiting</span>}
        {s.active > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>{s.active} active</span>}
        {s.portal && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E7F7EE] text-[#17663F]">Portal</span>}
      </span>
    );
  };

  const Avatar: React.FC<{ c: StudioClient; size?: number }> = ({ c, size = 36 }) => (
    <span className="rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: c.color, width: size, height: size, fontSize: size * 0.36 }}>
      {c.name.slice(0, 2).toUpperCase()}
    </span>
  );

  const ClientHeaderActions: React.FC<{ c: StudioClient }> = ({ c }) =>
    live ? (
      <span className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setClientForm({ client: c })} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-2)" }} aria-label={`Edit ${c.name}`}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {projects.every((p) => p.client_id !== c.id) && (
          <button type="button" onClick={() => archiveClient(c)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={`Archive ${c.name}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    ) : null;

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All" },
    { id: "active", label: "Active work" },
    { id: "waiting", label: "Awaiting approval" },
    { id: "portal", label: "Portal access" },
    { id: "unread", label: "Unread messages" },
  ];
  const VIEWS: Array<{ id: View; label: string; icon: React.ReactNode }> = [
    { id: "cards", label: "Cards", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: "list", label: "List", icon: <ListIcon className="w-3.5 h-3.5" /> },
    { id: "directory", label: "Directory", icon: <PanelsTopLeft className="w-3.5 h-3.5" /> },
  ];
  const selectedClient = clients.find((c) => c.id === selected) || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Clients</h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            {clients.length} clients · contacts, portal logins and messages.{" "}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/portal`);
                pushToast("Portal link copied", "info");
              }}
              className="font-medium"
              style={{ color: "var(--sos-primary)" }}
            >
              Copy portal link
            </button>
          </p>
        </div>
        {live && (
          <button type="button" onClick={() => setClientForm({ client: null })} className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
            <Plus className="w-4 h-4" /> New client
          </button>
        )}
      </div>

      {!live && (
        <p className="text-[13px] px-4 py-3 rounded-[14px]" style={{ background: "#FFF1E6", color: "#9A3412" }}>
          Sign in with cloud sync on to add clients and manage portal logins.
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 px-4 h-11 rounded-full flex-1 border" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, contact, email, Client ID or project code…"
            className="w-full bg-transparent outline-none text-[14px]"
            style={{ color: "var(--sos-text-1)" }}
            aria-label="Search clients"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ color: "var(--sos-text-3)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative inline-flex p-1 rounded-full self-start" style={{ background: "var(--sos-surface-2)" }} role="tablist" aria-label="Client view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="relative px-3.5 h-9 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5"
              style={{ color: view === v.id ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
            >
              {view === v.id && <ActivePill layoutId="clients-view-pill" style={{ background: "var(--sos-ink)" }} />}
              <span className="relative z-[1] inline-flex items-center gap-1.5">
                {v.icon} {v.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="px-3 h-8 rounded-full text-[12px] font-semibold border"
            style={filter === f.id ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)", borderColor: "var(--sos-ink)" } : { borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}
          >
            {f.label}
          </button>
        ))}
        {view === "cards" && filtered.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(expanded.size >= filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))}
            className="ml-auto text-[12px] font-semibold"
            style={{ color: "var(--sos-primary)" }}
          >
            {expanded.size >= filtered.length ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="sos-card p-8 text-center text-[14px]" style={{ color: "var(--sos-text-3)" }}>
          No clients match. {query && <button type="button" onClick={() => setQuery("")} style={{ color: "var(--sos-primary)" }}>Clear search</button>}
        </div>
      )}

      {/* Cards */}
      {view === "cards" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {filtered.map((c) => {
            const open = expanded.has(c.id);
            return (
              <motion.div key={c.id} layout transition={{ duration: 0.22, ease: EASE }} className="sos-card overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(c.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(c.id))}
                  className="w-full p-4 flex items-center gap-3 text-left cursor-pointer"
                  aria-expanded={open}
                >
                  <Avatar c={c} />
                  <div className="min-w-0 flex-1">
                    <p className="sos-display text-[16px] font-semibold flex items-center gap-1.5 truncate" style={{ color: "var(--sos-text-1)" }}>
                      {c.name} {c.is_confidential && <Lock className="w-3.5 h-3.5 text-[#5B3FE4]" />}
                    </p>
                    <div className="mt-1"><Badges c={c} /></div>
                  </div>
                  <ClientHeaderActions c={c} />
                  <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" style={{ color: "var(--sos-text-3)", transform: open ? "rotate(180deg)" : undefined }} />
                </div>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                      <div className="px-4 pb-4">
                        <ClientDetail client={c} actions={actions} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* List */}
      {view === "list" && filtered.length > 0 && (
        <div className="sos-card overflow-hidden divide-y" style={{ borderColor: "var(--sos-border)" }}>
          {filtered.map((c) => {
            const open = expanded.has(c.id);
            const s = stats.get(c.id)!;
            return (
              <div key={c.id} style={{ borderColor: "var(--sos-border)" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(c.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(c.id))}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:brightness-[0.985]"
                  style={{ background: open ? "var(--sos-surface-2)" : undefined }}
                  aria-expanded={open}
                >
                  <Avatar c={c} size={30} />
                  <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-[1.4fr_1.2fr_auto] md:items-center gap-x-4 gap-y-0.5">
                    <p className="text-[14px] font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--sos-text-1)" }}>
                      {c.name} {c.is_confidential && <Lock className="w-3 h-3 text-[#5B3FE4]" />}
                    </p>
                    <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
                      {c.contacts[0] ? `${c.contacts[0].name}${c.contacts[0].email ? ` · ${c.contacts[0].email}` : ""}` : "No contact"}
                      {c.contacts.length > 1 ? ` +${c.contacts.length - 1}` : ""}
                    </p>
                    <Badges c={c} />
                  </div>
                  <span className="hidden lg:inline text-[12px] sos-tabular shrink-0" style={{ color: "var(--sos-text-3)" }}>
                    <Globe className="w-3 h-3 inline mr-1" />
                    {c.timezone.split("/").pop()?.replace("_", " ")}
                  </span>
                  {s.lastMsg && (
                    <span className="hidden xl:inline text-[11px] shrink-0" style={{ color: "var(--sos-text-3)" }}>
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      {formatDistanceToNowStrict(parseISO(s.lastMsg), { addSuffix: true })}
                    </span>
                  )}
                  <ClientHeaderActions c={c} />
                  <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" style={{ color: "var(--sos-text-3)", transform: open ? "rotate(180deg)" : undefined }} />
                </div>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 md:pl-[58px]" style={{ background: "var(--sos-surface-2)" }}>
                        <div className="max-w-3xl">
                          <ClientDetail client={c} actions={actions} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Directory */}
      {view === "directory" && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <div className="sos-card p-2 lg:max-h-[calc(100vh-260px)] overflow-y-auto">
            {filtered.map((c) => {
              const s = stats.get(c.id)!;
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left"
                  aria-current={active ? "true" : undefined}
                >
                  {active && <ActivePill layoutId="clients-dir-pill" className="!rounded-[14px]" style={{ background: "var(--sos-surface-2)", borderRadius: 14 }} />}
                  <span className="relative z-[1] flex items-center gap-3 min-w-0 w-full">
                    <Avatar c={c} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{c.name}</span>
                      <span className="block text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
                        {[s.active ? `${s.active} active` : null, s.waiting ? `${s.waiting} awaiting` : null, c.contacts[0]?.name].filter(Boolean).join(" · ") || "No activity"}
                      </span>
                    </span>
                    {s.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#B42318] text-white text-[10px] font-bold flex items-center justify-center sos-pulse-badge">{s.unread}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            {selectedClient && (
              <motion.div key={selectedClient.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2, ease: EASE }} className="space-y-4">
                <div className="sos-card p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar c={selectedClient} size={48} />
                    <div className="min-w-0 flex-1">
                      <h2 className="sos-display text-[22px] font-semibold flex items-center gap-2 truncate" style={{ color: "var(--sos-text-1)" }}>
                        {selectedClient.name} {selectedClient.is_confidential && <Lock className="w-4 h-4 text-[#5B3FE4]" />}
                      </h2>
                      <p className="text-[13px] truncate" style={{ color: "var(--sos-text-3)" }}>{selectedClient.organisation}</p>
                      <div className="mt-1.5"><Badges c={selectedClient} /></div>
                    </div>
                    <ClientHeaderActions c={selectedClient} />
                  </div>
                  {selectedClient.notes && (
                    <p className="text-[13px] mb-3 p-3 rounded-[14px] whitespace-pre-wrap" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>{selectedClient.notes}</p>
                  )}
                  <ClientDetail client={selectedClient} actions={actions} />
                </div>
                <div className="sos-card p-5">
                  <h3 className="sos-display text-[18px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
                    <MessageSquare className="w-4 h-4" /> Messages
                  </h3>
                  <ClientMessages client={selectedClient} messages={messages} onSent={loadMessages} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {clientForm && <ClientFormModal open client={clientForm.client} onClose={() => setClientForm(null)} onCreated={(login, name) => login && setCreds({ login, name })} />}
      {contactForm && <ContactFormModal open clientId={contactForm.clientId} contact={contactForm.contact} onClose={() => setContactForm(null)} onLogin={(login, name) => setCreds({ login, name })} />}
      {loginFor && <PortalLoginModal open contact={loginFor} onClose={() => setLoginFor(null)} onDone={(login, name) => setCreds({ login, name })} />}
      {creds && <CredentialsModal login={creds.login} name={creds.name} onClose={() => setCreds(null)} />}
    </div>
  );
};
