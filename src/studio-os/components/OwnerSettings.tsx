import React, { useEffect, useState } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Download, FileJson, FileSpreadsheet, Loader2, Mail, Plus, Users, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { studioApi } from "../api";
import { StackedAvatars } from "./StatusChip";
import { ROLE_LABEL } from "./Team";
import { DEFAULT_INVOICE_URL } from "./Money";
import { StudioMember } from "../types";

const inputCls = "h-11 px-3 rounded-[12px] border text-[13px]";
const inputStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };
const COLORS = ["#5B3FE4", "#1D4FD8", "#17663F", "#B45309", "#BE123C", "#0E7490", "#7C3AED"];

const Title: React.FC<{ icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }> = ({ icon, title, sub, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 className="sos-display text-[18px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
        {icon}
        {title}
      </h3>
      <p className="text-[12px] mt-0.5" style={{ color: "var(--sos-text-3)" }}>
        {sub}
      </p>
    </div>
    {action}
  </div>
);

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------
export const TeamSettings: React.FC = () => {
  const { members, pushToast, reloadFromCloud, supabaseSyncStatus } = useStudioOS();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "artist" as StudioMember["role"], capacity: "7", color: COLORS[1] });
  const [busy, setBusy] = useState<string | null>(null);
  const cloud = supabaseSyncStatus === "synced" && supabase;

  const patch = async (id: string, values: Record<string, any>) => {
    if (!supabase) return;
    setBusy(id);
    const { error } = await supabase.from("studio_members").update(values).eq("id", id);
    setBusy(null);
    if (error) return pushToast(error.message, "warn");
    reloadFromCloud();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    const email = form.email.trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return pushToast("Enter a valid email", "warn");
    setBusy("new");
    const { error } = await supabase.from("studio_members").insert({
      name: form.name.trim(),
      email: email || null,
      role: form.role,
      hourly_capacity: Math.max(1, Math.min(12, parseFloat(form.capacity) || 7)),
      color: form.color,
      is_active: true,
    });
    setBusy(null);
    if (error) return pushToast(error.message, "warn");
    pushToast(`${form.name.trim()} added — invite them when ready`, "success");
    setForm({ name: "", email: "", role: "artist", capacity: "7", color: COLORS[(members.length + 1) % COLORS.length] });
    setAdding(false);
    reloadFromCloud();
  };

  const invite = async (m: StudioMember) => {
    if (!m.email) return pushToast("Add an email first", "warn");
    setBusy(m.id);
    try {
      await studioApi("/api/studio-os/team/invite", { body: { member_id: m.id } });
      pushToast(`Invite sent to ${m.email}`, "success");
      reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Invite failed", "warn");
    } finally {
      setBusy(null);
    }
  };

  if (!cloud) return null;

  return (
    <section className="sos-card p-6 space-y-4">
      <Title
        icon={<Users className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />}
        title="Team"
        sub="Members only see projects they're assigned to — never fees, invoices, expenses or confidential work unless you grant it."
        action={
          <button type="button" onClick={() => setAdding((a) => !a)} className="sos-pill-btn h-10 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5" style={{ background: "var(--sos-primary)" }}>
            <Plus className="w-4 h-4" /> Add member
          </button>
        }
      />

      {adding && (
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-6 gap-2.5 p-3 rounded-[18px]" style={{ background: "var(--sos-surface-2)" }}>
          <input aria-label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={`${inputCls} md:col-span-2`} style={inputStyle} />
          <input aria-label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@…" className={`${inputCls} md:col-span-2`} style={inputStyle} />
          <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StudioMember["role"] })} className={inputCls} style={inputStyle}>
            {(["producer", "artist", "editor", "music"] as const).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <input aria-label="Hours per day" inputMode="decimal" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="h/day" className={`${inputCls} sos-tabular`} style={inputStyle} />
          <div className="col-span-2 md:col-span-4 flex items-center gap-1.5" role="radiogroup" aria-label="Avatar colour">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={form.color === c} aria-label={`Colour ${c}`} onClick={() => setForm({ ...form, color: c })} className="w-11 h-11 rounded-full flex items-center justify-center">
                <span className="w-7 h-7 rounded-full" style={{ background: c, outline: form.color === c ? "2px solid var(--sos-text-1)" : "none", outlineOffset: 2 }} />
              </button>
            ))}
          </div>
          <button type="submit" disabled={busy === "new"} className="col-span-2 sos-pill-btn h-11 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}>
            {busy === "new" && <Loader2 className="w-4 h-4 animate-spin" />} Save member
          </button>
        </form>
      )}

      <div className="space-y-2">
        {members.map((m) => {
          const isOwnerRow = m.role === "owner";
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[16px]" style={{ background: "var(--sos-surface-2)", opacity: m.is_active ? 1 : 0.6 }}>
              <StackedAvatars items={[{ initials: m.initials, color: m.color, name: m.name }]} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{m.name}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
                  {m.email || "no email"} ·{" "}
                  {m.linked ? "signed in" : m.invited_at ? `invited ${formatDistanceToNowStrict(parseISO(m.invited_at), { addSuffix: true })}` : "not invited"}
                </p>
              </div>
              <select
                aria-label={`${m.name} role`}
                disabled={isOwnerRow}
                value={m.role}
                onChange={(e) => patch(m.id, { role: e.target.value })}
                className={inputCls}
                style={inputStyle}
              >
                {(isOwnerRow ? (["owner"] as const) : (["producer", "artist", "editor", "music"] as const)).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                <input
                  aria-label={`${m.name} hours per day`}
                  inputMode="decimal"
                  defaultValue={m.hourly_capacity}
                  onBlur={(e) => {
                    const v = Math.max(1, Math.min(12, parseFloat(e.target.value) || 7));
                    if (v !== m.hourly_capacity) patch(m.id, { hourly_capacity: v });
                  }}
                  className={`${inputCls} w-16 text-center sos-tabular`}
                  style={inputStyle}
                />
                h/day
              </label>
              {!isOwnerRow && (
                <>
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => invite(m)}
                    className="min-h-[44px] px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }}
                  >
                    {busy === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    {m.invited_at || m.linked ? "Resend" : "Invite"}
                  </button>
                  <label className="inline-flex items-center gap-2 min-h-[44px] text-[12px] font-medium" style={{ color: "var(--sos-text-2)" }}>
                    <input type="checkbox" checked={m.is_active} onChange={(e) => patch(m.id, { is_active: e.target.checked })} className="w-4 h-4 accent-[#5B3FE4]" />
                    Active
                  </label>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Money settings
// ---------------------------------------------------------------------------
export const MoneySettings: React.FC = () => {
  const { settings, updateSettings, pushToast } = useStudioOS();
  const [usd, setUsd] = useState(String(settings.usd_to_inr));
  const [eur, setEur] = useState(String(settings.eur_to_inr));
  const [url, setUrl] = useState(settings.invoice_generator_url || DEFAULT_INVOICE_URL);

  useEffect(() => {
    setUsd(String(settings.usd_to_inr));
    setEur(String(settings.eur_to_inr));
    setUrl(settings.invoice_generator_url || DEFAULT_INVOICE_URL);
  }, [settings.usd_to_inr, settings.eur_to_inr, settings.invoice_generator_url]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = url.trim() || DEFAULT_INVOICE_URL;
    if (!/^https:\/\//.test(clean)) return pushToast("Invoice generator URL must start with https://", "warn");
    updateSettings({
      usd_to_inr: Math.max(1, parseFloat(usd) || settings.usd_to_inr),
      eur_to_inr: Math.max(1, parseFloat(eur) || settings.eur_to_inr),
      invoice_generator_url: clean,
    });
  };

  return (
    <form onSubmit={save} className="sos-card p-6 space-y-4">
      <Title icon={<Wallet className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />} title="Money" sub="Manual exchange rates for INR equivalents, your invoice generator, and the Expenses module." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>1 USD = ₹</span>
          <input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} className={`${inputCls} w-full sos-tabular`} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>1 EUR = ₹</span>
          <input inputMode="decimal" value={eur} onChange={(e) => setEur(e.target.value)} className={`${inputCls} w-full sos-tabular`} style={inputStyle} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>Invoice generator URL (opens in a new tab)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={`${inputCls} w-full`} style={inputStyle} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: "var(--sos-border)" }}>
        <label className="inline-flex items-center gap-2.5 min-h-[44px] text-[13px] font-medium cursor-pointer" style={{ color: "var(--sos-text-1)" }}>
          <input type="checkbox" checked={settings.expenses_enabled} onChange={(e) => updateSettings({ expenses_enabled: e.target.checked })} className="w-5 h-5 accent-[#5B3FE4]" />
          Enable Expenses module (Money → Expenses)
        </label>
        <button type="submit" className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
          Save money settings
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Data export
// ---------------------------------------------------------------------------
function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    // Neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export const DataExport: React.FC = () => {
  const { projects, tasks, gates, payments, clients } = useStudioOS();
  const [busy, setBusy] = useState(false);
  const stamp = format(new Date(), "yyyy-MM-dd");
  const clientName = (id?: string) => clients.find((c) => c.id === id)?.name || "";
  const projectCode = (id?: string) => projects.find((p) => p.id === id)?.code || "";

  const datasets = async () => {
    let expenses: any[] = [];
    if (supabase) {
      const { data } = await supabase.from("studio_expenses").select("*").is("archived_at", null);
      expenses = data || [];
    }
    return {
      projects: projects.map((p) => ({ ...p, client: clientName(p.client_id) })),
      tasks: tasks.map(({ checklist, ...t }) => ({ ...t, project: projectCode(t.project_id), checklist_items: checklist.length })),
      gates: gates.map((g) => ({ ...g, project: projectCode(g.project_id) })),
      invoices: payments.map((p) => ({ ...p, project: projectCode(p.project_id) })),
      expenses,
    };
  };

  const exportOne = async (key: keyof Awaited<ReturnType<typeof datasets>>, kind: "csv" | "json") => {
    setBusy(true);
    const all = await datasets();
    const rows = all[key] as Record<string, any>[];
    if (kind === "csv") download(`studio-os-${key}-${stamp}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    else download(`studio-os-${key}-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
    setBusy(false);
  };

  const exportAll = async () => {
    setBusy(true);
    const all = await datasets();
    download(`studio-os-export-${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...all }, null, 2), "application/json");
    setBusy(false);
  };

  return (
    <section className="sos-card p-6 space-y-4">
      <Title
        icon={<Download className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />}
        title="Export data"
        sub="Download your data any time. A daily JSON backup also runs automatically to private Supabase Storage."
        action={
          <button type="button" disabled={busy} onClick={exportAll} className="sos-pill-btn h-10 px-4 text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />} Everything (JSON)
          </button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {(["projects", "tasks", "gates", "invoices", "expenses"] as const).map((k) => (
          <div key={k} className="p-3 rounded-[16px] space-y-2" style={{ background: "var(--sos-surface-2)" }}>
            <p className="text-[13px] font-semibold capitalize" style={{ color: "var(--sos-text-1)" }}>{k}</p>
            <div className="flex gap-1.5">
              <button type="button" disabled={busy} onClick={() => exportOne(k, "csv")} className="flex-1 min-h-[44px] rounded-full text-[12px] font-semibold inline-flex items-center justify-center gap-1" style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }} aria-label={`Export ${k} as CSV`}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
              </button>
              <button type="button" disabled={busy} onClick={() => exportOne(k, "json")} className="flex-1 min-h-[44px] rounded-full text-[12px] font-semibold inline-flex items-center justify-center gap-1" style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }} aria-label={`Export ${k} as JSON`}>
                <FileJson className="w-3.5 h-3.5" /> JSON
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
