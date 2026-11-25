import React, { useEffect, useState } from "react";
import { Download, Globe, Inbox, Lock, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";

export const ClientsScreen: React.FC = () => {
  const { clients, projects, openProject } = useStudioOS();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Clients
        </h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
          Approval latency, time zones, and active productions per client.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {clients.map((c) => {
          const clientProjects = projects.filter((p) => p.client_id === c.id);
          return (
            <div key={c.id} className="sos-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
                    style={{ background: c.color }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="sos-display text-[17px] font-semibold flex items-center gap-1.5" style={{ color: "var(--sos-text-1)" }}>
                      {c.name}
                      {c.is_confidential && <Lock className="w-3.5 h-3.5 text-[#5B3FE4]" />}
                    </h3>
                    <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                      <Globe className="w-3 h-3 inline mr-1" />
                      {c.timezone} · {c.currency}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sos-tile p-3 flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--sos-text-2)" }}>Avg approval latency</span>
                <span className="font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                  {c.avg_approval_latency_days} working days
                </span>
              </div>

              {c.contacts.length > 0 && (
                <div className="space-y-1">
                  {c.contacts.map((ct) => (
                    <p key={ct.id} className="text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                      <strong>{ct.name}</strong> {ct.role ? `· ${ct.role}` : ""}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: "var(--sos-border)" }}>
                {clientProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p.id)}
                    className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
                    style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}
                  >
                    {p.emoji} {p.code}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SettingsScreen: React.FC<{ onInstallPWA?: () => void; canInstallPWA?: boolean }> = ({
  onInstallPWA,
  canInstallPWA,
}) => {
  const { settings, updateSettings, resetDemoData, supabaseSyncStatus } = useStudioOS();
  const [overrun, setOverrun] = useState(String(settings.overrun_factor));
  const [latency, setLatency] = useState(String(settings.default_approval_latency_days));
  const [hours, setHours] = useState(String(settings.work_hours_per_day));
  const [closesAt, setClosesAt] = useState(settings.studio_closes_at);
  const [wipLimit, setWipLimit] = useState(String(settings.wip_limit));

  useEffect(() => {
    setOverrun(String(settings.overrun_factor));
    setLatency(String(settings.default_approval_latency_days));
    setHours(String(settings.work_hours_per_day));
    setClosesAt(settings.studio_closes_at);
    setWipLimit(String(settings.wip_limit));
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      overrun_factor: Math.max(1, parseFloat(overrun) || 1.6),
      default_approval_latency_days: Math.max(0, parseInt(latency, 10) || 2),
      work_hours_per_day: Math.max(1, parseFloat(hours) || 7),
      studio_closes_at: closesAt,
      wip_limit: Math.min(5, Math.max(1, parseInt(wipLimit, 10) || 3)),
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Settings
        </h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
          Tune forecast assumptions, studio hours, and PWA install.
        </p>
      </div>

      <form onSubmit={handleSave} className="sos-card p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Overrun Factor (multiplier)
            </label>
            <input
              type="number"
              step="0.1"
              value={overrun}
              onChange={(e) => setOverrun(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Default Approval Latency (days)
            </label>
            <input
              type="number"
              value={latency}
              onChange={(e) => setLatency(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Work Hours / Day
            </label>
            <input
              type="number"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Studio Closes At (IST)
            </label>
            <input
              type="time"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Now WIP Limit (recommended: 3)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: "var(--sos-border)" }}>
          <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
            Storage:{" "}
            <strong>
              {supabaseSyncStatus === "synced"
                ? "Supabase Cloud Connected"
                : supabaseSyncStatus === "schema_pending"
                ? "Local Persistence (run SQL migration for cloud sync)"
                : "Local Browser Persistence"}
            </strong>
          </span>
          <button
            type="submit"
            className="sos-pill-btn px-6 h-11 text-[14px] font-semibold text-white"
            style={{ background: "var(--sos-primary)" }}
          >
            Save Settings
          </button>
        </div>
      </form>

      <div className="sos-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Install Studio OS (PWA) &amp; Seed Data
          </h3>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            Add Studio OS to your phone or desktop dock for native one-tap launch.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canInstallPWA && onInstallPWA && (
            <button
              type="button"
              onClick={onInstallPWA}
              className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
              style={{ background: "var(--sos-green)" }}
            >
              <Download className="w-4 h-4" /> Install App
            </button>
          )}
          <button
            type="button"
            onClick={resetDemoData}
            className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-medium border"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
          >
            <RotateCcw className="w-4 h-4" /> Reset Seed Data
          </button>
        </div>
      </div>
    </div>
  );
};

export const OverviewPreviewScreen: React.FC = () => {
  const { tasks, projects, payments, openProject } = useStudioOS();
  const openCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const usdPending = payments
    .filter((p) => p.currency === "USD" && p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Overview
        </h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
          High-level studio pulse. Full Gantt timeline &amp; weekly analytics charts arrive in Phase 2.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[24px] p-6" style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}>
          <p className="text-[13px] opacity-75">Open Tasks</p>
          <p className="sos-num text-[56px] font-semibold leading-none mt-2">{openCount}</p>
          <p className="text-[12px] opacity-70 mt-2">{doneCount} completed</p>
        </div>

        <div className="sos-card p-6">
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>Active Productions</p>
          <p className="sos-num text-[56px] font-semibold leading-none mt-2" style={{ color: "var(--sos-text-1)" }}>
            {projects.filter((p) => p.status === "active").length}
          </p>
          <p className="text-[12px] mt-2" style={{ color: "var(--sos-text-3)" }}>
            {projects.filter((p) => p.status === "lead" || p.status === "quoted").length} in pipeline
          </p>
        </div>

        <div className="rounded-[24px] p-6" style={{ background: "var(--sos-yellow-card)", color: "#0F1115" }}>
          <p className="text-[13px] font-medium">USD Pipeline / Invoiced</p>
          <p className="sos-num text-[48px] font-semibold leading-none mt-2">${usdPending.toLocaleString()}</p>
          <p className="text-[12px] opacity-75 mt-2">Owner-only snapshot</p>
        </div>
      </div>

      <div className="sos-card p-6 space-y-4">
        <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Projects Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects
            .filter((p) => p.status === "active")
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openProject(p.id)}
                className="sos-tile p-4 text-left flex items-center justify-between gap-2"
              >
                <span className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                  {p.emoji} {p.title}
                </span>
                <HealthPill health={p.health} />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export const PhasePlaceholderScreen: React.FC<{
  title: string;
  phase: string;
  description: string;
  icon: "inbox" | "money";
}> = ({ title, phase, description, icon }) => (
  <div className="sos-card p-8 md:p-12 text-center max-w-xl mx-auto mt-8 space-y-4">
    <div
      className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
      style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
    >
      {icon === "inbox" ? <Inbox className="w-7 h-7" /> : <Wallet className="w-7 h-7" />}
    </div>
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
      style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
    >
      <Sparkles className="w-3.5 h-3.5" /> Scheduled for {phase}
    </span>
    <h1 className="sos-display text-[28px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
      {title}
    </h1>
    <p className="text-[14px] leading-relaxed" style={{ color: "var(--sos-text-2)" }}>
      {description}
    </p>
  </div>
);
