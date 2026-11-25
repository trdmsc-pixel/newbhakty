import React, { useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  Check,
  CheckCheck,
  Globe,
  Inbox as InboxIcon,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { InboxItem, InboxItemAction, InboxItemSource, useInbox, gmailThreadUrl } from "../InboxContext";
import { studioApi } from "../api";

const HIGH = 0.85;

const ACTION_META: Record<InboxItemAction, { label: string; bg: string; text: string }> = {
  create_task: { label: "Create task", bg: "#E8F0FF", text: "#2F6BFF" },
  create_promise: { label: "Track promise", bg: "#FFF3E0", text: "#C26A00" },
  reply_owed: { label: "Reply owed", bg: "#FFF3E0", text: "#C26A00" },
  log_payment: { label: "Log payment note", bg: "#F1F2F4", text: "#5F6672" },
  update_payment: { label: "Mark paid", bg: "#E7F7EE", text: "#22875A" },
  approve_gate: { label: "Approve stage", bg: "#E7F7EE", text: "#22875A" },
  update_deadline: { label: "Move deadline", bg: "#FFF1E6", text: "#C2410C" },
  new_lead: { label: "New lead", bg: "#EEEBFD", text: "#5B3FE4" },
  ignore: { label: "No action", bg: "#F1F2F4", text: "#5F6672" },
};

const SourceIcon: React.FC<{ source: InboxItemSource }> = ({ source }) => {
  const cls = "w-4 h-4";
  const icon =
    source === "gmail" ? (
      <Mail className={cls} strokeWidth={1.75} />
    ) : source === "whatsapp" ? (
      <MessageCircle className={cls} strokeWidth={1.75} />
    ) : source === "website" ? (
      <Globe className={cls} strokeWidth={1.75} />
    ) : source === "portal" ? (
      <LayoutGrid className={cls} strokeWidth={1.75} />
    ) : (
      <Sparkles className={cls} strokeWidth={1.75} />
    );
  const label = { gmail: "Gmail", whatsapp: "WhatsApp", website: "Website", portal: "Portal", manual: "Quick capture", claude_task: "Scheduled task" }[source];
  return (
    <span
      title={label}
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
    >
      {icon}
    </span>
  );
};

export const ConfidenceMeter: React.FC<{ value: number }> = ({ value }) => {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  return (
    <span className="inline-flex items-end gap-[2px]" title={`AI confidence ${Math.round(value * 100)}%`} aria-label={`Confidence ${Math.round(value * 100)}%`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{ height: 5 + i * 2, background: i < filled ? "var(--sos-text-2)" : "var(--sos-border)" }}
        />
      ))}
      <span className="ml-1 text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
        {Math.round(value * 100)}%
      </span>
    </span>
  );
};

const ClientAvatar: React.FC<{ name?: string; color?: string }> = ({ name, color }) => {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
      style={{ background: color || "#9AA0AA" }}
    >
      {initials}
    </span>
  );
};

const timeAgo = (iso: string) => {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------------------
// Suggestion card (with inline edit + swipe)
// ---------------------------------------------------------------------------
const SuggestionCard: React.FC<{ item: InboxItem }> = ({ item }) => {
  const { clients, projects } = useStudioOS();
  const { accept, dismiss, busyIds } = useInbox();
  const busy = busyIds.has(item.id);
  const client = clients.find((c) => c.id === item.matched_client_id);
  const project = projects.find((p) => p.id === (item.payload?.project_id || item.matched_project_id));
  const action = (item.suggested_action || "ignore") as InboxItemAction;
  const meta = ACTION_META[action];

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.payload?.title || item.title || "");
  const [projectId, setProjectId] = useState<string>(item.payload?.project_id || item.matched_project_id || "");
  const [date, setDate] = useState<string>(item.payload?.due_date || item.payload?.new_date || "");
  const [actionChoice, setActionChoice] = useState<InboxItemAction>(action);

  // Swipe (touch): right = accept, left = dismiss
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (editing) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const ddx = e.touches[0].clientX - startX.current;
    const ddy = e.touches[0].clientY - startY.current;
    if (Math.abs(ddy) > Math.abs(ddx) && Math.abs(dx) < 10) return; // vertical scroll
    setDx(Math.max(-140, Math.min(140, ddx)));
  };
  const onTouchEnd = () => {
    if (dx > 96) accept(item.id);
    else if (dx < -96) dismiss(item.id);
    setDx(0);
    startX.current = null;
    startY.current = null;
  };

  const needsProject = ["approve_gate", "update_deadline", "update_payment"].includes(actionChoice);
  const editable = ["create_task", "create_promise", "reply_owed"].includes(actionChoice);

  const saveEdit = () => {
    const edits: Record<string, any> = { project_id: projectId || null };
    if (actionChoice !== action) edits.action = actionChoice;
    if (editable) {
      edits.title = title.trim() || item.title;
      edits.due_date = date || null;
    }
    if (actionChoice === "update_deadline") edits.new_date = date || null;
    accept(item.id, edits);
  };

  return (
    <div className="relative overflow-hidden rounded-[22px]">
      {/* Swipe hint backgrounds */}
      {dx !== 0 && (
        <div
          className="absolute inset-0 flex items-center justify-between px-6 text-[13px] font-semibold"
          style={{ background: dx > 0 ? "#E7F7EE" : "var(--sos-surface-2)", color: dx > 0 ? "#22875A" : "var(--sos-text-2)" }}
        >
          <span className="flex items-center gap-1.5">{dx > 0 && <><Check className="w-4 h-4" /> Accept</>}</span>
          <span className="flex items-center gap-1.5">{dx < 0 && <>Dismiss <X className="w-4 h-4" /></>}</span>
        </div>
      )}
      <div
        className="sos-card p-4 md:p-5 relative"
        style={{ transform: `translateX(${dx}px)`, transition: startX.current === null ? "transform 180ms ease" : "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-start gap-3">
          <div className="flex -space-x-2 shrink-0">
            <SourceIcon source={item.source} />
            <ClientAvatar name={client?.name || item.sender || undefined} color={client?.color} />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                {item.summary || item.title}
              </p>
            </div>
            <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
              {[client?.name || item.sender, project ? `${project.emoji} ${project.code}` : null, timeAgo(item.received_at)].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: meta.bg, color: meta.text }}>
                {meta.label}
              </span>
              <span className="text-[12px] truncate max-w-[280px]" style={{ color: "var(--sos-text-2)" }}>
                {item.title}
              </span>
              <ConfidenceMeter value={Number(item.confidence) || 0} />
              {item.gmail_account && item.thread_id && (
                <a
                  href={gmailThreadUrl(item.gmail_account, item.thread_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] underline-offset-2 hover:underline"
                  style={{ color: "var(--sos-text-3)" }}
                >
                  Open email
                </a>
              )}
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => accept(item.id)}
              className="sos-pill-btn h-8 px-3.5 text-[12px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
              style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
            </button>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="w-8 h-8 rounded-full flex items-center justify-center border"
              style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => dismiss(item.id)}
              className="w-8 h-8 rounded-full flex items-center justify-center border"
              style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-3)" }}
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile actions */}
        <div className="flex sm:hidden items-center gap-2 mt-3">
          <button type="button" disabled={busy} onClick={() => accept(item.id)} className="sos-pill-btn flex-1 h-9 text-[13px] font-semibold" style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}>
            Accept
          </button>
          <button type="button" onClick={() => setEditing((e) => !e)} className="sos-pill-btn flex-1 h-9 text-[13px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            Edit
          </button>
          <button type="button" disabled={busy} onClick={() => dismiss(item.id)} className="sos-pill-btn flex-1 h-9 text-[13px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-3)" }}>
            Dismiss
          </button>
        </div>

        {editing && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderColor: "var(--sos-border)" }}>
            <label className="block sm:col-span-2">
              <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--sos-text-3)" }}>Action</span>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value as InboxItemAction)}
                className="w-full h-10 px-3 rounded-[12px] border text-[13px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              >
                {(["create_task", "create_promise", "reply_owed", "approve_gate", "update_deadline", "update_payment", "log_payment", "new_lead"] as InboxItemAction[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTION_META[a].label}
                  </option>
                ))}
              </select>
            </label>
            {editable && (
              <label className="block sm:col-span-2">
                <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--sos-text-3)" }}>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border text-[13px]"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
              </label>
            )}
            <label className="block">
              <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--sos-text-3)" }}>
                Project{needsProject ? " (required)" : ""}
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 px-3 rounded-[12px] border text-[13px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              >
                <option value="">— Internal / none —</option>
                {projects
                  .filter((p) => !["lost", "paid"].includes(p.status))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.code} · {p.title}
                    </option>
                  ))}
              </select>
            </label>
            {(editable || actionChoice === "update_deadline") && (
              <label className="block">
                <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--sos-text-3)" }}>
                  {actionChoice === "update_deadline" ? "New deadline" : "Due"}
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border text-[13px] sos-tabular"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
              </label>
            )}
            {item.raw_text && (
              <p className="sm:col-span-2 text-[12px] leading-relaxed whitespace-pre-wrap line-clamp-6 p-3 rounded-[12px]" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
                {item.raw_text}
              </p>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="sos-pill-btn h-9 px-4 text-[13px] border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (needsProject && !projectId)}
                onClick={saveEdit}
                className="sos-pill-btn h-9 px-4 text-[13px] font-semibold text-white disabled:opacity-45"
                style={{ background: "var(--sos-primary)" }}
              >
                Save &amp; apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Auto-update row
// ---------------------------------------------------------------------------
const AutoUpdateRow: React.FC<{ item: InboxItem }> = ({ item }) => {
  const { clients, projects } = useStudioOS();
  const { undo, busyIds } = useInbox();
  const client = clients.find((c) => c.id === item.matched_client_id);
  const project = projects.find((p) => p.id === (item.payload?.project_id || item.matched_project_id));
  const meta = ACTION_META[(item.suggested_action || "ignore") as InboxItemAction];
  const statusLabel = item.status === "auto_applied" ? "Auto" : item.status === "accepted" ? "Accepted" : "Undone";

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[18px]" style={{ background: "var(--sos-surface)", opacity: item.status === "undone" ? 0.55 : 1 }}>
      <SourceIcon source={item.source} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium truncate" style={{ color: "var(--sos-text-1)", textDecoration: item.status === "undone" ? "line-through" : undefined }}>
          {item.title}
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
          {[meta.label, client?.name || item.sender, project?.code, timeAgo(item.resolved_at || item.received_at)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}>
        {statusLabel}
      </span>
      {item.status !== "undone" && (
        <button
          type="button"
          disabled={busyIds.has(item.id)}
          onClick={() => undo(item.id)}
          className="sos-pill-btn h-8 px-3 text-[12px] font-medium border inline-flex items-center gap-1 disabled:opacity-50"
          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Undo
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export const InboxScreen: React.FC = () => {
  const { setWhatsAppImportOpen, pushToast } = useStudioOS();
  const { pending, autoUpdates, available, loading, refresh, acceptAllHigh } = useInbox();
  const [tab, setTab] = useState<"pending" | "auto">("pending");
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const highCount = useMemo(() => pending.filter((i) => Number(i.confidence) >= HIGH).length, [pending]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await studioApi<any>("/api/studio-os/gmail/sync-now", { body: {} });
      if (res.skippedReason) pushToast(res.skippedReason, "warn");
      else {
        const n = (res.accounts || []).reduce((s: number, a: any) => s + (a.items || 0), 0);
        pushToast(n ? `${n} new item(s) from Gmail` : "Gmail is up to date", "info");
      }
      await refresh();
    } catch (err: any) {
      pushToast(err?.message || "Sync failed", "warn");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Inbox
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Email, WhatsApp and website inquiries — sorted into suggestions you approve.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWhatsAppImportOpen(true)}
            className="sos-pill-btn h-9 px-4 text-[13px] font-medium border inline-flex items-center gap-1.5"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}
          >
            <Upload className="w-4 h-4" /> Import WhatsApp chat
          </button>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing || !available}
            className="sos-pill-btn h-9 px-4 text-[13px] font-medium border inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync Gmail
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
          {(
            [
              { id: "pending", label: "Pending", count: pending.length },
              { id: "auto", label: "Auto-updates", count: autoUpdates.filter((i) => i.status !== "undone").length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-4 h-9 rounded-full text-[13px] font-medium inline-flex items-center gap-2"
              style={{ background: tab === t.id ? "var(--sos-ink)" : "transparent", color: tab === t.id ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
            >
              {t.label}
              <span className="text-[11px] sos-tabular opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        {tab === "pending" && highCount > 0 && (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={async () => {
              setBulkBusy(true);
              await acceptAllHigh();
              setBulkBusy(false);
            }}
            className="sos-pill-btn h-9 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: "var(--sos-primary)" }}
          >
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />} Accept all high-confidence ({highCount})
          </button>
        )}
      </div>

      {!available && (
        <div className="sos-card p-5 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          The inbox needs Supabase cloud sync. Sign in with an owner account to see suggestions.
        </div>
      )}

      {available && tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 && !loading && (
            <div className="sos-card p-10 text-center space-y-2">
              <span className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}>
                <InboxIcon className="w-5 h-5" />
              </span>
              <p className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                All clear
              </p>
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                Nothing waiting for a decision. Routine updates are applied automatically and listed under Auto-updates.
              </p>
            </div>
          )}
          {pending.map((item) => (
            <SuggestionCard key={item.id} item={item} />
          ))}
          {pending.length > 0 && (
            <p className="md:hidden text-center text-[11px]" style={{ color: "var(--sos-text-3)" }}>
              Swipe right to accept · left to dismiss
            </p>
          )}
        </div>
      )}

      {available && tab === "auto" && (
        <div className="space-y-2">
          {autoUpdates.length === 0 && (
            <div className="sos-card p-8 text-center text-[13px]" style={{ color: "var(--sos-text-3)" }}>
              No automatic updates in the last 7 days.
            </div>
          )}
          {autoUpdates.map((item) => (
            <AutoUpdateRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
