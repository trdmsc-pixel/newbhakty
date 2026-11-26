import React, { useEffect, useState } from "react";
import { studioApi } from "../api";
import { AutomationSettings } from "../components/AutomationSettings";
import { DataExport, MoneySettings, TeamSettings } from "../components/OwnerSettings";
import {
  Bell,
  BellOff,
  Calendar,
  Download,
  Globe,
  Inbox,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { supabase } from "../../lib/supabase";
import { syncRemovePushSubscription, syncSavePushSubscription } from "../supabaseSync";
import { ClientContact, HolidayRegion, StudioClient } from "../types";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export { ClientsScreen } from "./ClientsScreen";

export const SettingsScreen: React.FC<{ onInstallPWA?: () => void; canInstallPWA?: boolean }> = ({
  onInstallPWA,
  canInstallPWA,
}) => {
  const {
    settings,
    members,
    holidays,
    realOverrunCalibration,
    applyCalibratedOverrunFactor,
    updateSettings,
    addHoliday,
    deleteHoliday,
    resetDemoData,
    supabaseSyncStatus,
    pushToast,
    isOwner,
  } = useStudioOS();

  const [overrun, setOverrun] = useState(String(settings.overrun_factor));
  const [latency, setLatency] = useState(String(settings.default_approval_latency_days));
  const [hours, setHours] = useState(String(settings.work_hours_per_day));
  const [closesAt, setClosesAt] = useState(settings.studio_closes_at);
  const [opensAt, setOpensAt] = useState(settings.studio_opens_at || "10:00");
  const [workDays, setWorkDays] = useState<number[]>(settings.work_days || [1, 2, 3, 4, 5, 6]);
  const [wipLimit, setWipLimit] = useState(String(settings.wip_limit));
  const [takesPerKeeper, setTakesPerKeeper] = useState(String(settings.takes_per_keeper));

  // Holidays form
  const [holDate, setHolDate] = useState("");
  const [holName, setHolName] = useState("");
  const [holRegion, setHolRegion] = useState<HolidayRegion>("IN");

  // Push subscription state
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setOverrun(String(settings.overrun_factor));
    setLatency(String(settings.default_approval_latency_days));
    setHours(String(settings.work_hours_per_day));
    setClosesAt(settings.studio_closes_at);
    setOpensAt(settings.studio_opens_at || "10:00");
    setWorkDays(settings.work_days || [1, 2, 3, 4, 5, 6]);
    setWipLimit(String(settings.wip_limit));
    setTakesPerKeeper(String(settings.takes_per_keeper));
  }, [settings]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setPushEndpoint(sub.endpoint);
      })
      .catch(() => {});
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      overrun_factor: Math.max(1, parseFloat(overrun) || 1.6),
      default_approval_latency_days: Math.max(0, parseInt(latency, 10) || 2),
      work_hours_per_day: Math.max(1, parseFloat(hours) || 7),
      studio_closes_at: closesAt,
      studio_opens_at: opensAt,
      work_days: workDays.length ? [...workDays].sort() : [1, 2, 3, 4, 5, 6],
      wip_limit: Math.min(5, Math.max(1, parseInt(wipLimit, 10) || 3)),
      takes_per_keeper: Math.max(1, parseFloat(takesPerKeeper) || 3),
    });
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      pushToast("Web Push is not supported on this browser.", "warn");
      return;
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        pushToast("Notification permission was not granted.", "warn");
        return;
      }

      let publicKey =
        (typeof import.meta !== "undefined" && import.meta.env
          ? import.meta.env.VITE_VAPID_PUBLIC_KEY
          : "") || "";

      if (!publicKey) {
        const res = await fetch("/api/studio-os/push-public-key").catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          publicKey = data?.publicKey || "";
        }
      }

      if (!publicKey) {
        pushToast("Set VAPID_PUBLIC_KEY in Vercel env vars to register Web Push.", "warn");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const json = sub.toJSON();
      const keys = {
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      };
      const err = await syncSavePushSubscription(sub.endpoint, keys, members[0]?.id);
      if (err) {
        pushToast(`Saved locally — cloud warning: ${err}`, "warn");
      } else {
        setPushEndpoint(sub.endpoint);
        pushToast("Web Push enabled & stored in Supabase.", "success");
      }
    } catch (err: any) {
      pushToast(err?.message || "Failed to enable Web Push.", "warn");
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await syncRemovePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushEndpoint(null);
      pushToast("Web Push disabled.", "info");
    } catch {
      // ignore
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
      const res = await fetch("/api/studio-os/test-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Test push failed");
      pushToast(`Sent test push to ${data.sent ?? 1} device(s).`, "success");
    } catch (err: any) {
      pushToast(err?.message || "Could not send test push.", "warn");
    }
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holDate || !holName.trim()) return;
    addHoliday({ holiday_date: holDate, name: holName.trim(), region: holRegion });
    setHolDate("");
    setHolName("");
  };

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Settings
        </h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
          Forecast calibration, AI & Gmail inputs, regional holidays, Web Push, and PWA installation.
        </p>
      </div>

      {isOwner && (
        <>
      {/* Forecast & Calibration Form */}
      <form onSubmit={handleSave} className="sos-card p-6 space-y-5">
        <div
          className="p-4 rounded-[18px] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ background: "var(--sos-violet-soft)" }}
        >
          <div className="space-y-0.5">
            <p className="text-[13px] font-semibold" style={{ color: "var(--sos-primary)" }}>
              Your real overrun factor: {realOverrunCalibration.ratio}× (from {realOverrunCalibration.gateCount} gates)
            </p>
            <p className="text-[12px]" style={{ color: "var(--sos-text-2)" }}>
              Based on actual vs estimated days recorded whenever a gate is marked Approved.
            </p>
          </div>
          <button
            type="button"
            onClick={applyCalibratedOverrunFactor}
            disabled={realOverrunCalibration.gateCount === 0}
            className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-9 text-[12px] font-semibold text-white shrink-0 disabled:opacity-45"
            style={{ background: "var(--sos-primary)" }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Apply {realOverrunCalibration.ratio}×
          </button>
        </div>

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
              Studio Opens At (IST)
            </label>
            <input
              type="time"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[14px] border sos-tabular"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
            />
          </div>
          <div className="md:col-span-2">
            <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Working days (shown to clients in the portal)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
                const on = workDays.includes(i + 1);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWorkDays((w) => (on ? w.filter((x) => x !== i + 1) : [...w, i + 1]))}
                    className="h-9 px-3 rounded-full text-[12px] font-semibold border"
                    style={on ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)", borderColor: "var(--sos-ink)" } : { borderColor: "var(--sos-border)", color: "var(--sos-text-3)" }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
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
          <div>
            <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>
              Takes per Keeper (Generation Block Calibration)
            </label>
            <input
              type="number"
              step="0.5"
              min={1}
              max={20}
              value={takesPerKeeper}
              onChange={(e) => setTakesPerKeeper(e.target.value)}
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

      {/* Phase 5 — Team & Money */}
      <TeamSettings />
      <MoneySettings />

      {/* Phase 3 — Automatic inputs */}
      <AutomationSettings />

      {/* Studio Holidays Manager (IN + US + AR + GLOBAL) */}
      <section className="sos-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="sos-display text-[18px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
              <Calendar className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />
              Regional Holidays ({holidays.length})
            </h3>
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              Included in `computeProjectForecast()` based on studio (IN) and each client&apos;s timezone (US / AR).
            </p>
          </div>
        </div>

        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="date"
            required
            value={holDate}
            onChange={(e) => setHolDate(e.target.value)}
            className="sm:col-span-3 h-10 px-3 rounded-[12px] border text-[13px] sos-tabular"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          />
          <input
            type="text"
            required
            placeholder="Holiday name..."
            value={holName}
            onChange={(e) => setHolName(e.target.value)}
            className="sm:col-span-5 h-10 px-3 rounded-[12px] border text-[13px]"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          />
          <select
            value={holRegion}
            onChange={(e) => setHolRegion(e.target.value as HolidayRegion)}
            className="sm:col-span-2 h-10 px-2.5 rounded-[12px] border text-[13px]"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          >
            <option value="IN">IN</option>
            <option value="US">US</option>
            <option value="AR">AR</option>
            <option value="GLOBAL">GLOBAL</option>
          </select>
          <button
            type="submit"
            className="sm:col-span-2 sos-pill-btn h-10 text-[13px] font-semibold text-white inline-flex items-center justify-center gap-1"
            style={{ background: "var(--sos-green)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {holidays.map((h) => (
            <div key={h.id} className="sos-tile p-3 flex items-center justify-between gap-2 text-[12px]">
              <div className="min-w-0">
                <span className="font-bold sos-tabular" style={{ color: "var(--sos-primary)" }}>
                  {h.holiday_date}
                </span>{" "}
                <span className="px-1.5 py-0.5 rounded bg-black/5 text-[10px] font-bold mr-1">
                  {h.region}
                </span>
                <span className="font-medium truncate" style={{ color: "var(--sos-text-1)" }}>
                  {h.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => deleteHoliday(h.id)}
                className="p-1.5 rounded-full hover:opacity-70 shrink-0"
                style={{ color: "var(--sos-text-3)" }}
                aria-label={`Delete ${h.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

          <DataExport />
        </>
      )}

      {/* Web Push Notifications (VAPID) */}
      <section className="sos-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="sos-display text-[18px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
            <Bell className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />
            Calm Push Notifications (VAPID)
          </h3>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            Fires ONLY for promises due in 3h, client portal approvals/change requests, or a project forecast turning late.
          </p>
          {pushEndpoint && (
            <p className="text-[11px] font-medium" style={{ color: "var(--sos-green)" }}>
              Subscribed on this device
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pushEndpoint ? (
            <>
              <button
                type="button"
                onClick={handleSendTestPush}
                className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-blue)" }}
              >
                <Send className="w-3.5 h-3.5" /> Send Test
              </button>
              <button
                type="button"
                disabled={pushBusy}
                onClick={handleDisablePush}
                className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-medium border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              >
                <BellOff className="w-3.5 h-3.5" /> Disable
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pushBusy}
              onClick={handleEnablePush}
              className="sos-pill-btn inline-flex items-center gap-1.5 px-5 h-10 text-[13px] font-semibold text-white"
              style={{ background: "var(--sos-primary)" }}
            >
              <Bell className="w-3.5 h-3.5" /> {pushBusy ? "Subscribing..." : "Enable Push Alerts"}
            </button>
          )}
        </div>
      </section>

      {/* PWA Install & Reset Seed Data */}
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
          {isOwner && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset ALL Studio OS data to the demo seed? This deletes your real projects, tasks and invoices.")) resetDemoData();
            }}
            className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-medium border"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
          >
            <RotateCcw className="w-4 h-4" /> Reset Seed Data
          </button>
          )}
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
