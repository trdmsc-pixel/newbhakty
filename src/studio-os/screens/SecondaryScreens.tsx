import React, { useEffect, useState } from "react";
import { studioApi } from "../api";
import { AutomationSettings } from "../components/AutomationSettings";
import { ClientFormModal, ContactFormModal, CredentialsModal, PortalLoginModal, type PortalLogin } from "../components/ClientManager";
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

export const ClientsScreen: React.FC = () => {
  const { clients, projects, openProject, pushToast, reloadFromCloud, supabaseSyncStatus } = useStudioOS();
  const [inviting, setInviting] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<{ client: StudioClient | null } | null>(null);
  const [contactForm, setContactForm] = useState<{ clientId: string; contact: ClientContact | null } | null>(null);
  const [loginFor, setLoginFor] = useState<ClientContact | null>(null);
  const [creds, setCreds] = useState<{ login: PortalLogin; name: string } | null>(null);
  const live = supabaseSyncStatus === "synced";

  const emailLink = async (ct: ClientContact) => {
    if (!ct.email) return pushToast("Add an email to this contact first", "warn");
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
  };

  const revoke = async (ct: ClientContact) => {
    if (!window.confirm(`Turn off portal access for ${ct.name}? Their login stops showing any projects.`)) return;
    try {
      await studioApi("/api/studio-os/portal/revoke", { body: { contact_id: ct.id } });
      pushToast("Portal access turned off", "success");
      reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't revoke", "warn");
    }
  };

  const removeContact = async (ct: ClientContact) => {
    if (!window.confirm(`Remove ${ct.name} from this client?`)) return;
    try {
      await studioApi(`/api/studio-os/contacts/${ct.id}`, { method: "DELETE" });
      pushToast("Contact removed", "success");
      reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't remove", "warn");
    }
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

  const copyPortalLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/portal`);
    pushToast("Portal link copied", "info");
  };

  const smallBtn = "shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold disabled:opacity-50";
  const softStyle = { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sos-display text-[32px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Clients
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Contacts, portal logins, approval latency and productions per client.
          </p>
          <button type="button" onClick={copyPortalLink} className="mt-2 text-[12px] font-medium" style={{ color: "var(--sos-primary)" }}>
            Copy client portal link
          </button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {clients.map((c) => {
          const clientProjects = projects.filter((p) => p.client_id === c.id);
          return (
            <div key={c.id} className="sos-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: c.color }}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="sos-display text-[17px] font-semibold flex items-center gap-1.5 truncate" style={{ color: "var(--sos-text-1)" }}>
                      {c.name}
                      {c.is_confidential && <Lock className="w-3.5 h-3.5 text-[#5B3FE4]" />}
                    </h3>
                    <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                      <Globe className="w-3 h-3 inline mr-1" />
                      {c.timezone} · {c.currency}
                    </p>
                  </div>
                </div>
                {live && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setClientForm({ client: c })} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-2)" }} aria-label={`Edit ${c.name}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {clientProjects.length === 0 && (
                      <button type="button" onClick={() => archiveClient(c)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={`Archive ${c.name}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="sos-tile p-3 flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--sos-text-2)" }}>Avg approval latency</span>
                <span className="font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                  {c.avg_approval_latency_days} working days
                </span>
              </div>

              <div className="space-y-2">
                {c.contacts.map((ct) => (
                  <div key={ct.id} className="rounded-[14px] p-2.5 space-y-1.5" style={{ background: "var(--sos-surface-2)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" disabled={!live} onClick={() => setContactForm({ clientId: c.id, contact: ct })} className="text-left min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                          {ct.name} {ct.role ? <span className="font-normal" style={{ color: "var(--sos-text-3)" }}>· {ct.role}</span> : null}
                        </p>
                        <p className="text-[12px] truncate" style={{ color: ct.email ? "var(--sos-text-2)" : "var(--sos-text-3)" }}>
                          {ct.email || "No email"}{ct.phone ? ` · ${ct.phone}` : ""}
                        </p>
                      </button>
                      {ct.is_portal_user && ct.portal_login_id ? (
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#E7F7EE", color: "#17663F" }} title={ct.portal_last_login_at ? `Last signed in ${new Date(ct.portal_last_login_at).toLocaleString()}` : "Not signed in yet"}>
                          {ct.portal_login_id}
                        </span>
                      ) : ct.is_portal_user ? (
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#E7F7EE", color: "#17663F" }}>Portal ✓</span>
                      ) : null}
                    </div>
                    {live && (
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setLoginFor(ct)} className={smallBtn} style={softStyle}>
                          <KeyRound className="w-3 h-3" /> {ct.portal_login_id && ct.is_portal_user ? "Reset password" : "Create portal login"}
                        </button>
                        {ct.email && (
                          <button type="button" disabled={inviting === ct.id} onClick={() => emailLink(ct)} className={smallBtn} style={softStyle}>
                            <Send className="w-3 h-3" /> Email sign-in link
                          </button>
                        )}
                        {ct.is_portal_user && (
                          <button type="button" onClick={() => revoke(ct)} className={smallBtn} style={softStyle}>
                            Turn off portal
                          </button>
                        )}
                        <button type="button" onClick={() => removeContact(ct)} className={smallBtn} style={{ color: "var(--sos-text-3)" }} aria-label={`Remove ${ct.name}`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {live && (
                  <button type="button" onClick={() => setContactForm({ clientId: c.id, contact: null })} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--sos-primary)" }}>
                    <Plus className="w-3.5 h-3.5" /> Add contact
                  </button>
                )}
              </div>

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
                {clientProjects.length === 0 && <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>No projects yet</span>}
              </div>
            </div>
          );
        })}
      </div>

      {clientForm && (
        <ClientFormModal
          open
          client={clientForm.client}
          onClose={() => setClientForm(null)}
          onCreated={(login, name) => login && setCreds({ login, name })}
        />
      )}
      {contactForm && (
        <ContactFormModal
          open
          clientId={contactForm.clientId}
          contact={contactForm.contact}
          onClose={() => setContactForm(null)}
          onLogin={(login, name) => setCreds({ login, name })}
        />
      )}
      {loginFor && <PortalLoginModal open contact={loginFor} onClose={() => setLoginFor(null)} onDone={(login, name) => setCreds({ login, name })} />}
      {creds && <CredentialsModal login={creds.login} name={creds.name} onClose={() => setCreds(null)} />}
    </div>
  );
};

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
