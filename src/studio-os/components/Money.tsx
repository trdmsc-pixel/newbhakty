import React, { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ArrowUpRight, Check, FileText, Loader2, Paperclip, Plus, Receipt, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { CurrencyCode, StudioPayment, StudioProject, StudioSettings } from "../types";
import { newUuid } from "../uuid";

export const DEFAULT_INVOICE_URL = "https://invoice-gen-blond.vercel.app/";
export type PayStatus = StudioPayment["status"];

const today = () => format(new Date(), "yyyy-MM-dd");

export function effectiveStatus(p: StudioPayment): PayStatus {
  if ((p.status === "sent" || p.status === "partly_paid") && p.due_at && p.due_at < today()) return "overdue";
  return p.status;
}

export function receivedOf(p: StudioPayment): number {
  if (p.received_amount !== undefined && p.received_amount !== null) return p.received_amount;
  return p.status === "paid" ? Math.max(0, p.amount - (p.tds_amount || 0)) : 0;
}

export function outstandingOf(p: StudioPayment): number {
  if (p.status === "draft" || p.status === "paid") return 0;
  return Math.max(0, p.amount - receivedOf(p) - (p.tds_amount || 0));
}

export function toINR(amount: number, currency: CurrencyCode | string, s: StudioSettings): number {
  if (currency === "USD") return amount * (s.usd_to_inr || 0);
  if (currency === "EUR") return amount * (s.eur_to_inr || 0);
  return amount;
}

export function fmtMoney(amount: number, currency: CurrencyCode | string = "INR"): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0)}`;
  }
}

/** Chips meet WCAG AA (≥4.5:1) on their tinted backgrounds. */
export const PAY_CHIP: Record<PayStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#F1F2F4", text: "#4B5260" },
  sent: { label: "Sent", bg: "#E8F0FF", text: "#1D4FD8" },
  partly_paid: { label: "Partly paid", bg: "#EEEBFD", text: "#4C2FD4" },
  paid: { label: "Paid", bg: "#E7F7EE", text: "#17663F" },
  overdue: { label: "Overdue", bg: "#FFF1E6", text: "#9A3412" },
};

export const PayChip: React.FC<{ status: PayStatus }> = ({ status }) => {
  const c = PAY_CHIP[status] || PAY_CHIP.draft;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
};

export const GenerateInvoiceButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { settings } = useStudioOS();
  const url = settings.invoice_generator_url || DEFAULT_INVOICE_URL;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`sos-pill-btn inline-flex items-center justify-center gap-1.5 ${compact ? "px-4 h-10 text-[13px]" : "px-5 h-11 text-[14px]"} font-semibold text-white`}
      style={{ background: "var(--sos-primary)" }}
    >
      Generate Invoice <ArrowUpRight className="w-4 h-4" />
    </a>
  );
};

const inputCls = "w-full h-11 px-3.5 rounded-[14px] border text-[14px]";
const inputStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };
const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={`block ${className || ""}`}>
    <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
      {label}
    </span>
    {children}
  </label>
);

const ModalShell: React.FC<{ title: string; sub?: string; onClose: () => void; children: React.ReactNode }> = ({ title, sub, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl border space-y-4"
      style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            {title}
          </h3>
          {sub && (
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              {sub}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Log invoice
// ---------------------------------------------------------------------------
export const LogInvoiceModal: React.FC<{ projectId?: string; onClose: () => void }> = ({ projectId, onClose }) => {
  const { projects, payments, pushToast, reloadFromCloud } = useStudioOS();
  const year = new Date().getFullYear();
  const nextNo = useMemo(() => {
    const nums = payments.map((p) => parseInt((p.invoice_no || "").split("-").pop() || "0", 10)).filter(Number.isFinite);
    return `TCS-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  }, [payments, year]);
  const [pid, setPid] = useState(projectId || projects.find((p) => p.status === "active")?.id || projects[0]?.id || "");
  const project = projects.find((p) => p.id === pid);
  const [invoiceNo, setInvoiceNo] = useState(nextNo);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(project?.currency || "INR");
  const [tds, setTds] = useState("");
  const [sentAt, setSentAt] = useState(today());
  const [dueAt, setDueAt] = useState(format(addDays(new Date(), 15), "yyyy-MM-dd"));
  const [status, setStatus] = useState<"draft" | "sent">("sent");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project) setCurrency(project.currency || "INR");
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const amt = parseFloat(amount);
    if (!pid || !Number.isFinite(amt) || amt <= 0) return pushToast("Pick a project and enter an amount", "warn");
    if (fileUrl && !/^https?:\/\//.test(fileUrl)) return pushToast("Invoice link must start with https://", "warn");
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("studio_payments").insert({
      id: newUuid(),
      project_id: pid,
      invoice_no: invoiceNo.trim() || null,
      amount: amt,
      currency,
      tds_amount: parseFloat(tds) || 0,
      sent_at: status === "sent" ? sentAt : null,
      due_at: dueAt || null,
      status,
      file_url: fileUrl.trim() || null,
    });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    pushToast(`Logged ${invoiceNo}`, "success");
    reloadFromCloud();
    onClose();
  };

  return (
    <ModalShell title="Log invoice" sub="Record an invoice you generated or sent. Amounts never leave Studio OS." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" className="col-span-2">
          <select value={pid} onChange={(e) => setPid(e.target.value)} className={inputCls} style={inputStyle}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.code} · {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Invoice number">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls} style={inputStyle}>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
        <Field label="Amount">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className={inputCls} style={inputStyle}>
            <option>INR</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
        <Field label="TDS expected">
          <input inputMode="decimal" value={tds} onChange={(e) => setTds(e.target.value)} placeholder="0" className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        <Field label="Due date">
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        {status === "sent" && (
          <Field label="Sent on">
            <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className={`${inputCls} sos-tabular`} style={inputStyle} />
          </Field>
        )}
        <Field label="Invoice PDF link (optional)" className="col-span-2">
          <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" className={inputCls} style={inputStyle} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <GenerateInvoiceButton compact />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="sos-pill-btn px-4 h-11 text-[14px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={save} className="sos-pill-btn px-5 h-11 text-[14px] font-semibold inline-flex items-center gap-2 disabled:opacity-50" style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Log invoice
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Mark received
// ---------------------------------------------------------------------------
export const MarkReceivedModal: React.FC<{ payment: StudioPayment; onClose: () => void }> = ({ payment, onClose }) => {
  const { pushToast, reloadFromCloud } = useStudioOS();
  const [tds, setTds] = useState(String(payment.tds_amount || 0));
  const [received, setReceived] = useState(String(Math.max(0, payment.amount - (payment.tds_amount || 0))));
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const rec = parseFloat(received) || 0;
  const t = parseFloat(tds) || 0;
  const settles = rec + t >= payment.amount * 0.999;
  const remaining = Math.max(0, payment.amount - rec - t);

  const save = async () => {
    if (!supabase || rec <= 0) return pushToast("Enter the amount received", "warn");
    setBusy(true);
    const { error } = await supabase
      .from("studio_payments")
      .update({ received_amount: rec, tds_amount: t, received_at: new Date(`${date}T12:00:00`).toISOString(), status: settles ? "paid" : "partly_paid" })
      .eq("id", payment.id);
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    pushToast(settles ? `${payment.invoice_no || "Invoice"} marked paid` : `Part payment recorded — ${fmtMoney(remaining, payment.currency)} still due`, "success");
    reloadFromCloud();
    onClose();
  };

  return (
    <ModalShell title={`Mark received · ${payment.invoice_no || "Invoice"}`} sub={`Invoiced ${fmtMoney(payment.amount, payment.currency)}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Total received to date (${payment.currency})`}>
          <input inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} className={`${inputCls} sos-tabular`} style={inputStyle} autoFocus />
        </Field>
        <Field label={`TDS deducted (${payment.currency})`}>
          <input inputMode="decimal" value={tds} onChange={(e) => setTds(e.target.value)} className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        <Field label="Received on" className="col-span-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
      </div>
      <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: settles ? "#E7F7EE" : "#FFF1E6", color: settles ? "#17663F" : "#9A3412" }}>
        {settles ? "This settles the invoice → Paid." : `Partly paid — ${fmtMoney(remaining, payment.currency)} remains outstanding.`}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="sos-pill-btn px-4 h-11 text-[14px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={save} className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50" style={{ background: "#17663F" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// Invoices table
// ---------------------------------------------------------------------------
export const InvoicesTable: React.FC<{ payments: StudioPayment[]; showProject?: boolean }> = ({ payments, showProject = true }) => {
  const { projects, clients, pushToast, reloadFromCloud } = useStudioOS();
  const [receiving, setReceiving] = useState<StudioPayment | null>(null);
  const sorted = [...payments].sort((a, b) => (b.due_at || b.sent_at || "").localeCompare(a.due_at || a.sent_at || ""));

  const markSent = async (p: StudioPayment) => {
    await supabase?.from("studio_payments").update({ status: "sent", sent_at: today() }).eq("id", p.id);
    reloadFromCloud();
  };
  const archive = async (p: StudioPayment) => {
    if (!window.confirm(`Remove ${p.invoice_no || "this invoice"}?`)) return;
    await supabase?.from("studio_payments").update({ archived_at: new Date().toISOString() }).eq("id", p.id);
    pushToast("Invoice removed", "info");
    reloadFromCloud();
  };

  if (!sorted.length) {
    return (
      <div className="sos-card p-8 text-center text-[13px]" style={{ color: "var(--sos-text-3)" }}>
        No invoices yet. Generate one, then “Log invoice” to track it here.
      </div>
    );
  }

  return (
    <div className="sos-card overflow-x-auto">
      <table className="w-full text-left min-w-[860px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
            {["Invoice", ...(showProject ? ["Project", "Client"] : []), "Amount", "TDS", "Due", "Status", ""].map((h) => (
              <th key={h} scope="col" className="py-3 px-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const project = projects.find((x) => x.id === p.project_id);
            const client = clients.find((c) => c.id === project?.client_id);
            const st = effectiveStatus(p);
            const out = outstandingOf(p);
            return (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--sos-border)" }}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                      {p.invoice_no || "—"}
                    </span>
                    {p.file_url && (
                      <a href={p.file_url} target="_blank" rel="noopener noreferrer" aria-label="Open invoice PDF" className="w-8 h-8 inline-flex items-center justify-center rounded-full" style={{ color: "var(--sos-text-3)" }}>
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                {showProject && (
                  <>
                    <td className="py-3 px-3 text-[13px]" style={{ color: "var(--sos-text-1)" }}>
                      {project ? `${project.emoji} ${project.code}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-[13px] max-w-[160px] truncate" style={{ color: "var(--sos-text-2)" }}>
                      {client?.name || "—"}
                    </td>
                  </>
                )}
                <td className="py-3 px-3">
                  <p className="text-[13px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                    {fmtMoney(p.amount, p.currency)}
                  </p>
                  {out > 0 && (
                    <p className="text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                      {fmtMoney(out, p.currency)} due
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-[13px] sos-tabular" style={{ color: "var(--sos-text-2)" }}>
                  {p.tds_amount ? fmtMoney(p.tds_amount, p.currency) : "—"}
                </td>
                <td className="py-3 px-3 text-[13px] sos-tabular whitespace-nowrap" style={{ color: "var(--sos-text-2)" }}>
                  {p.due_at ? format(parseISO(p.due_at), "d MMM yyyy") : "—"}
                </td>
                <td className="py-3 px-3">
                  <PayChip status={st} />
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {p.status === "draft" && (
                      <button type="button" onClick={() => markSent(p)} className="min-h-[44px] px-3 rounded-full text-[12px] font-semibold" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                        Mark sent
                      </button>
                    )}
                    {p.status !== "draft" && p.status !== "paid" && (
                      <button type="button" onClick={() => setReceiving(p)} className="min-h-[44px] px-3 rounded-full text-[12px] font-semibold text-white" style={{ background: "#17663F" }}>
                        Mark received
                      </button>
                    )}
                    <button type="button" onClick={() => archive(p)} className="w-11 h-11 rounded-full inline-flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={`Remove ${p.invoice_no || "invoice"}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {receiving && <MarkReceivedModal payment={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------
export const MoneySummary: React.FC<{ payments: StudioPayment[] }> = ({ payments }) => {
  const { settings } = useStudioOS();
  const live = payments.filter((p) => p.status !== "draft");
  const byCur = (fn: (p: StudioPayment) => number) => {
    const m = new Map<string, number>();
    for (const p of live) m.set(p.currency, (m.get(p.currency) || 0) + fn(p));
    const inr = [...m.entries()].reduce((s, [c, v]) => s + toINR(v, c, settings), 0);
    return { m, inr };
  };
  const cards = [
    { label: "Invoiced", accent: false, ...byCur((p) => p.amount) },
    { label: "Received", accent: false, ...byCur(receivedOf) },
    { label: "Outstanding", accent: true, ...byCur(outstandingOf) },
    { label: "TDS pending (16A)", accent: false, ...byCur((p) => (p.status === "paid" || p.status === "partly_paid" ? p.tds_amount || 0 : 0)) },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((c) => (
        <div key={c.label} className="sos-card p-4 md:p-5 space-y-1.5" style={c.accent ? { background: "var(--sos-ink)", borderColor: "transparent" } : undefined}>
          <p className="text-[12px] font-semibold" style={{ color: c.accent ? "var(--sos-ink-text)" : "var(--sos-text-2)", opacity: c.accent ? 0.75 : 1 }}>
            {c.label}
          </p>
          <p className="sos-num text-[22px] md:text-[26px] font-semibold leading-none" style={{ color: c.accent ? "var(--sos-ink-text)" : "var(--sos-text-1)" }}>
            {fmtMoney(c.inr, "INR")}
          </p>
          <p className="text-[11px] sos-tabular" style={{ color: c.accent ? "var(--sos-ink-text)" : "var(--sos-text-3)", opacity: c.accent ? 0.75 : 1 }}>
            {[...c.m.entries()].filter(([cur]) => cur !== "INR").map(([cur, v]) => fmtMoney(v, cur)).join(" + ") || "INR only"}
          </p>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Project → Money tab
// ---------------------------------------------------------------------------
export const ProjectMoneyTab: React.FC<{ project: StudioProject }> = ({ project }) => {
  const { payments } = useStudioOS();
  const [logOpen, setLogOpen] = useState(false);
  const mine = payments.filter((p) => p.project_id === project.id);
  return (
    <div className="space-y-4">
      <div className="sos-card p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Money · {project.code}
          </h2>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            Fee {project.fee_amount ? fmtMoney(project.fee_amount, project.currency) : "not set"} · owner only
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateInvoiceButton compact />
          <button type="button" onClick={() => setLogOpen(true)} className="sos-pill-btn px-4 h-10 text-[13px] font-semibold border inline-flex items-center gap-1.5" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
            <Plus className="w-4 h-4" /> Log Invoice
          </button>
        </div>
      </div>
      <MoneySummary payments={mine} />
      <InvoicesTable payments={mine} showProject={false} />
      {logOpen && <LogInvoiceModal projectId={project.id} onClose={() => setLogOpen(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expenses (feature-flagged)
// ---------------------------------------------------------------------------
interface Expense {
  id: string;
  project_id: string | null;
  category: "ai_subscription" | "software" | "freelancer" | "hardware" | "office" | "other";
  vendor: string;
  amount: number;
  currency: string;
  paid_on: string;
  is_company: boolean;
  receipt_path: string | null;
  notes: string | null;
}

const CATEGORY_LABEL: Record<Expense["category"], string> = {
  ai_subscription: "AI subscription",
  software: "Software",
  freelancer: "Freelancer",
  hardware: "Hardware",
  office: "Office",
  other: "Other",
};

/** Indian FY (Apr–Mar) containing `d`. */
export function fyOf(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { label: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`, start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

export const ExpensesPanel: React.FC = () => {
  const { settings, updateSettings, projects, pushToast } = useStudioOS();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vendor: "", amount: "", currency: "INR", category: "software" as Expense["category"], paid_on: today(), is_company: true, project_id: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const fy = fyOf(new Date());

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("studio_expenses")
      .select("id, project_id, category, vendor, amount, currency, paid_on, is_company, receipt_path, notes")
      .is("archived_at", null)
      .order("paid_on", { ascending: false })
      .limit(300);
    setItems(((data || []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (settings.expenses_enabled) load();
  }, [settings.expenses_enabled, load]);

  if (!settings.expenses_enabled) {
    return (
      <div className="sos-card p-8 md:p-10 text-center max-w-xl mx-auto space-y-3">
        <span className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
          <Receipt className="w-5 h-5" />
        </span>
        <h3 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Expenses — coming soon
        </h3>
        <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          Track company and personal spend with receipts for your FY balance sheet. Turn it on when you're ready.
        </p>
        <button type="button" onClick={() => updateSettings({ expenses_enabled: true })} className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
          Enable Expenses
        </button>
      </div>
    );
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!supabase || !form.vendor.trim() || !Number.isFinite(amt) || amt <= 0) return pushToast("Vendor and amount are required", "warn");
    setBusy(true);
    let receipt_path: string | null = null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setBusy(false);
        return pushToast("Receipt must be under 10 MB", "warn");
      }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      receipt_path = `${fy.label.replace(/\s/g, "")}/${newUuid()}-${safe}`;
      const up = await supabase.storage.from("studio-receipts").upload(receipt_path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) {
        setBusy(false);
        return pushToast(`Receipt upload failed: ${up.error.message}`, "warn");
      }
    }
    const { error } = await supabase.from("studio_expenses").insert({
      vendor: form.vendor.trim(),
      amount: amt,
      currency: form.currency,
      category: form.category,
      paid_on: form.paid_on,
      is_company: form.is_company,
      project_id: form.project_id || null,
      notes: form.notes.trim() || null,
      receipt_path,
    });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setForm({ ...form, vendor: "", amount: "", notes: "" });
    setFile(null);
    pushToast("Expense logged", "success");
    load();
  };

  const openReceipt = async (path: string) => {
    const { data } = (await supabase?.storage.from("studio-receipts").createSignedUrl(path, 120)) || { data: null };
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const remove = async (x: Expense) => {
    if (!window.confirm(`Remove ${x.vendor} expense?`)) return;
    await supabase?.from("studio_expenses").update({ archived_at: new Date().toISOString() }).eq("id", x.id);
    load();
  };

  const inFy = items.filter((x) => x.paid_on >= fy.start && x.paid_on <= fy.end);
  const sumInr = (arr: Expense[]) => arr.reduce((s, x) => s + toINR(x.amount, x.currency, settings), 0);
  const companyTotal = sumInr(inFy.filter((x) => x.is_company));
  const personalTotal = sumInr(inFy.filter((x) => !x.is_company));
  const byCat = (Object.keys(CATEGORY_LABEL) as Expense["category"][])
    .map((c) => ({ c, v: sumInr(inFy.filter((x) => x.category === c && x.is_company)) }))
    .filter((r) => r.v > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="sos-card p-4 md:p-5">
          <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-2)" }}>{fy.label} · Company</p>
          <p className="sos-num text-[24px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{fmtMoney(companyTotal)}</p>
        </div>
        <div className="sos-card p-4 md:p-5">
          <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-2)" }}>{fy.label} · Personal</p>
          <p className="sos-num text-[24px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{fmtMoney(personalTotal)}</p>
        </div>
        <div className="sos-card p-4 md:p-5 col-span-2">
          <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--sos-text-2)" }}>Company spend by category</p>
          <div className="flex flex-wrap gap-1.5">
            {byCat.length === 0 && <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Nothing logged this FY</span>}
            {byCat.map((r) => (
              <span key={r.c} className="px-2.5 py-1 rounded-full text-[12px] sos-tabular" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                {CATEGORY_LABEL[r.c]} · {fmtMoney(r.v)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={add} className="sos-card p-4 md:p-5 grid grid-cols-2 md:grid-cols-6 gap-3">
        <Field label="Vendor" className="col-span-2">
          <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Runway" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Amount">
          <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls} style={inputStyle}>
            <option>INR</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })} className={inputCls} style={inputStyle}>
            {(Object.keys(CATEGORY_LABEL) as Expense["category"][]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="Paid on">
          <input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} className={`${inputCls} sos-tabular`} style={inputStyle} />
        </Field>
        <Field label="Project (optional)" className="col-span-2">
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={inputCls} style={inputStyle}>
            <option value="">— General —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.title}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 md:col-span-2 flex items-end">
          <div className="inline-flex p-1 rounded-full w-full" style={{ background: "var(--sos-surface-2)" }} role="radiogroup" aria-label="Company or personal">
            {[
              { v: true, l: "Company" },
              { v: false, l: "Personal" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={form.is_company === o.v}
                onClick={() => setForm({ ...form, is_company: o.v })}
                className="flex-1 min-h-[40px] rounded-full text-[13px] font-medium"
                style={{ background: form.is_company === o.v ? "var(--sos-ink)" : "transparent", color: form.is_company === o.v ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <label className="col-span-2 md:col-span-1 flex items-end">
          <span className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed text-[13px] cursor-pointer px-2 truncate" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{file ? file.name : "Receipt"}</span>
          </span>
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="col-span-2 md:col-span-1 flex items-end">
          <button type="submit" disabled={busy} className="sos-pill-btn w-full h-11 text-[14px] font-semibold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-primary)" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </form>

      <div className="sos-card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--sos-text-3)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--sos-text-3)" }}>No expenses yet.</p>
        ) : (
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                {["Date", "Vendor", "Category", "Type", "Amount", ""].map((h) => (
                  <th key={h} scope="col" className="py-3 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className="border-t" style={{ borderColor: "var(--sos-border)" }}>
                  <td className="py-3 px-3 text-[13px] sos-tabular" style={{ color: "var(--sos-text-2)" }}>{format(parseISO(x.paid_on), "d MMM yyyy")}</td>
                  <td className="py-3 px-3 text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{x.vendor}</td>
                  <td className="py-3 px-3 text-[13px]" style={{ color: "var(--sos-text-2)" }}>{CATEGORY_LABEL[x.category]}</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={x.is_company ? { background: "#E8F0FF", color: "#1D4FD8" } : { background: "#F1F2F4", color: "#4B5260" }}>
                      {x.is_company ? "Company" : "Personal"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[13px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{fmtMoney(x.amount, x.currency)}</td>
                  <td className="py-3 px-3">
                    <div className="flex justify-end gap-1">
                      {x.receipt_path && (
                        <button type="button" onClick={() => openReceipt(x.receipt_path!)} className="w-11 h-11 rounded-full inline-flex items-center justify-center" style={{ color: "var(--sos-text-2)" }} aria-label="Open receipt">
                          <Paperclip className="w-4 h-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => remove(x)} className="w-11 h-11 rounded-full inline-flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={`Remove ${x.vendor}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
