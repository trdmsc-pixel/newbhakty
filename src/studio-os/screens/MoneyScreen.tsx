import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { effectiveStatus, ExpensesPanel, GenerateInvoiceButton, InvoicesTable, LogInvoiceModal, MoneySummary, PayStatus } from "../components/Money";

/** Owner-only Money screen (also enforced by RLS on studio_payments / studio_expenses). */
export const MoneyScreen: React.FC = () => {
  const { payments, settings, isOwner } = useStudioOS();
  const [tab, setTab] = useState<"invoices" | "expenses">("invoices");
  const [filter, setFilter] = useState<"all" | PayStatus>("all");
  const [logOpen, setLogOpen] = useState(false);
  const filtered = useMemo(() => (filter === "all" ? payments : payments.filter((p) => effectiveStatus(p) === filter)), [payments, filter]);

  if (!isOwner) return null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            Money
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Invoices, receipts and TDS — owner only. INR equivalents use 1 USD = ₹{settings.usd_to_inr} · 1 EUR = ₹{settings.eur_to_inr}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="sos-pill-btn px-4 h-11 text-[14px] font-semibold border inline-flex items-center gap-1.5"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
          >
            <Plus className="w-4 h-4" /> Log Invoice
          </button>
          <GenerateInvoiceButton />
        </div>
      </div>

      <MoneySummary payments={payments} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }} role="tablist">
          {(["invoices", "expenses"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="px-5 min-h-[40px] rounded-full text-[13px] font-medium capitalize"
              style={{ background: tab === t ? "var(--sos-ink)" : "transparent", color: tab === t ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "invoices" && (
          <div className="flex flex-wrap gap-1.5" aria-label="Filter invoices">
            {(["all", "draft", "sent", "partly_paid", "overdue", "paid"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className="min-h-[36px] px-3 rounded-full text-[12px] font-medium capitalize"
                style={{ background: filter === f ? "var(--sos-violet-soft)" : "transparent", color: filter === f ? "var(--sos-primary)" : "var(--sos-text-2)" }}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "invoices" ? <InvoicesTable payments={filtered} /> : <ExpensesPanel />}
      {logOpen && <LogInvoiceModal onClose={() => setLogOpen(false)} />}
    </div>
  );
};
