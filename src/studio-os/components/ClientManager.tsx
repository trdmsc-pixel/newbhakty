/**
 * Client + contact forms and portal-login management for Studio OS (owner only).
 * All writes go through owner-authenticated server routes; the portal login
 * (Client ID + password) is provisioned server-side in Supabase Auth.
 */
import React, { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, X } from "lucide-react";
import { studioApi } from "../api";
import { useStudioOS } from "../StudioOSContext";
import { SheetModal } from "../motion";
import type { ClientContact, StudioClient } from "../types";

export interface PortalLogin {
  login_id: string;
  password: string | null;
  email_login: string | null;
}

const inputCls = "w-full h-11 px-3.5 rounded-[14px] border text-[14px]";
const inputStyle: React.CSSProperties = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };
const panelCls = "w-full md:max-w-xl max-h-[94vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] p-5 md:p-6 shadow-2xl border space-y-4";
const panelStyle: React.CSSProperties = { background: "var(--sos-surface)", borderColor: "var(--sos-border)" };

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={`block ${className || ""}`}>
    <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>{label}</span>
    {children}
    {hint && <span className="block text-[11px] mt-1" style={{ color: "var(--sos-text-3)" }}>{hint}</span>}
  </label>
);

const Header: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex items-center justify-between">
    <h3 className="sos-display text-[19px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{title}</h3>
    <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
      <X className="w-4 h-4" />
    </button>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2.5">
    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>{title}</p>
    {children}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--sos-primary)]" />
    <span>
      <span className="block text-[13px] font-medium" style={{ color: "var(--sos-text-1)" }}>{label}</span>
      {hint && <span className="block text-[12px]" style={{ color: "var(--sos-text-3)" }}>{hint}</span>}
    </span>
  </label>
);

const Actions: React.FC<{ busy: boolean; label: string; onCancel: () => void }> = ({ busy, label, onCancel }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button type="button" onClick={onCancel} className="sos-pill-btn h-11 px-5 text-[14px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>Cancel</button>
    <button type="submit" disabled={busy} className="sos-pill-btn h-11 px-6 text-[14px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--sos-primary)" }}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />} {label}
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Portal access sub-form (shared by New client / Add contact)
// ---------------------------------------------------------------------------
interface PortalDraft {
  enabled: boolean;
  login_id: string;
  ownPassword: boolean;
  password: string;
  require_change: boolean;
}
const emptyPortal = (enabled: boolean): PortalDraft => ({ enabled, login_id: "", ownPassword: false, password: "", require_change: true });
function portalPayload(p: PortalDraft) {
  if (!p.enabled) return undefined;
  return {
    enabled: true,
    login_id: p.login_id.trim() || undefined,
    password: p.ownPassword && p.password ? p.password : undefined,
    require_change: p.ownPassword ? p.require_change : true,
  };
}

const PortalAccessFields: React.FC<{ value: PortalDraft; onChange: (p: PortalDraft) => void; email?: string }> = ({ value, onChange, email }) => (
  <Section title="Client portal access">
    <Toggle
      checked={value.enabled}
      onChange={(enabled) => onChange({ ...value, enabled })}
      label="Create a portal login"
      hint="They'll see only their own projects, stages, deliverables and invoices."
    />
    {value.enabled && (
      <div className="space-y-2.5 pl-7">
        <Field label="Client ID (username)" hint="Leave blank to generate one, like TCS-7KQ4M2.">
          <input value={value.login_id} onChange={(e) => onChange({ ...value, login_id: e.target.value.toUpperCase() })} placeholder="Auto-generate" className={inputCls} style={inputStyle} />
        </Field>
        <Toggle checked={value.ownPassword} onChange={(ownPassword) => onChange({ ...value, ownPassword })} label="Set the password myself" hint="Otherwise a temporary password is generated and shown once." />
        {value.ownPassword && (
          <>
            <Field label="Password" hint="At least 8 characters.">
              <input type="text" autoComplete="new-password" value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} className={inputCls} style={inputStyle} />
            </Field>
            <Toggle checked={value.require_change} onChange={(require_change) => onChange({ ...value, require_change })} label="Ask them to choose their own password at first sign-in" />
          </>
        )}
        <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
          {email ? `They can sign in with the Client ID or ${email}.` : "No email needed — they sign in with the Client ID."}
        </p>
      </div>
    )}
  </Section>
);

// ---------------------------------------------------------------------------
// New / edit client
// ---------------------------------------------------------------------------
export const ClientFormModal: React.FC<{
  open: boolean;
  client?: StudioClient | null;
  onClose: () => void;
  onCreated?: (login: PortalLogin | null, name: string) => void;
}> = ({ open, client, onClose, onCreated }) => {
  const { pushToast, reloadFromCloud } = useStudioOS();
  const editing = Boolean(client);
  const [f, setF] = useState(() => ({
    name: client?.name || "",
    organisation: client?.organisation || "",
    timezone: client?.timezone || "Asia/Kolkata",
    currency: client?.currency || "INR",
    avg_approval_latency_days: client?.avg_approval_latency_days ?? 2,
    is_confidential: client?.is_confidential || false,
    notes: client?.notes || "",
  }));
  const [ct, setCt] = useState({ name: "", email: "", phone: "", whatsapp: "", role: "" });
  const [portal, setPortal] = useState<PortalDraft>(emptyPortal(true));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return pushToast("Client name is required", "warn");
    if (!editing && portal.enabled && !ct.name.trim()) return pushToast("Add a contact person for the portal login", "warn");
    setBusy(true);
    try {
      const clientBody = { ...f, organisation: f.organisation || f.name, avg_approval_latency_days: Number(f.avg_approval_latency_days) || 0 };
      if (editing) {
        await studioApi(`/api/studio-os/clients/${client!.id}`, { method: "PATCH", body: clientBody });
        pushToast("Client updated", "success");
        onClose();
      } else {
        const res = await studioApi<{ login: PortalLogin | null; warning?: string }>("/api/studio-os/clients", {
          body: { client: clientBody, contact: ct.name.trim() ? ct : undefined, portal: ct.name.trim() ? portalPayload(portal) : undefined },
        });
        if (res.warning) pushToast(res.warning, "warn");
        else pushToast("Client added", "success");
        onClose();
        onCreated?.(res.login, ct.name || f.name);
      }
      await reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't save the client", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal open={open} onClose={onClose} label={editing ? "Edit client" : "New client"} panelClassName={panelCls} panelStyle={panelStyle}>
      <form onSubmit={submit} className="space-y-4">
        <Header title={editing ? `Edit ${client!.name}` : "New client"} onClose={onClose} />
        <Section title="Client">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Client name *"><input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Arculus" className={inputCls} style={inputStyle} /></Field>
            <Field label="Organisation"><input value={f.organisation} onChange={(e) => set("organisation", e.target.value)} placeholder="Legal / company name" className={inputCls} style={inputStyle} /></Field>
            <Field label="Time zone"><input value={f.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls} style={inputStyle} /></Field>
            <Field label="Currency">
              <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls} style={inputStyle}>
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </Field>
            <Field label="Avg approval time (working days)"><input type="number" min={0} step={0.5} value={f.avg_approval_latency_days} onChange={(e) => set("avg_approval_latency_days", e.target.value)} className={inputCls} style={inputStyle} /></Field>
            <div className="flex items-end pb-2"><Toggle checked={f.is_confidential} onChange={(v) => set("is_confidential", v)} label="Confidential" hint="Fees never go to AI." /></div>
            <Field label="Notes" className="sm:col-span-2"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3.5 py-2.5 rounded-[14px] border text-[14px]" style={inputStyle} /></Field>
          </div>
        </Section>
        {!editing && (
          <>
            <Section title="Main contact">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label="Name"><input value={ct.name} onChange={(e) => setCt({ ...ct, name: e.target.value })} placeholder="Contact person" className={inputCls} style={inputStyle} /></Field>
                <Field label="Role"><input value={ct.role} onChange={(e) => setCt({ ...ct, role: e.target.value })} placeholder="Producer, Marketing lead…" className={inputCls} style={inputStyle} /></Field>
                <Field label="Email" hint="Optional — enables email updates and email sign-in."><input type="email" value={ct.email} onChange={(e) => setCt({ ...ct, email: e.target.value })} className={inputCls} style={inputStyle} /></Field>
                <Field label="Phone / WhatsApp"><input value={ct.phone} onChange={(e) => setCt({ ...ct, phone: e.target.value, whatsapp: e.target.value })} className={inputCls} style={inputStyle} /></Field>
              </div>
            </Section>
            {ct.name.trim() ? <PortalAccessFields value={portal} onChange={setPortal} email={ct.email} /> : <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Add a contact to create their portal login.</p>}
          </>
        )}
        <Actions busy={busy} label={editing ? "Save" : "Add client"} onCancel={onClose} />
      </form>
    </SheetModal>
  );
};

// ---------------------------------------------------------------------------
// Add / edit contact
// ---------------------------------------------------------------------------
export const ContactFormModal: React.FC<{
  open: boolean;
  clientId: string;
  contact?: ClientContact | null;
  onClose: () => void;
  onLogin?: (login: PortalLogin, name: string) => void;
}> = ({ open, clientId, contact, onClose, onLogin }) => {
  const { pushToast, reloadFromCloud } = useStudioOS();
  const editing = Boolean(contact);
  const [ct, setCt] = useState({ name: contact?.name || "", email: contact?.email || "", phone: contact?.phone || "", whatsapp: contact?.whatsapp || "", role: contact?.role || "" });
  const [portal, setPortal] = useState<PortalDraft>(emptyPortal(false));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ct.name.trim()) return pushToast("Name is required", "warn");
    setBusy(true);
    try {
      if (editing) {
        const res = await studioApi<{ warning?: string }>(`/api/studio-os/contacts/${contact!.id}`, { method: "PATCH", body: ct });
        pushToast(res.warning || "Contact updated", res.warning ? "warn" : "success");
      } else {
        const res = await studioApi<{ login: PortalLogin | null; warning?: string }>(`/api/studio-os/clients/${clientId}/contacts`, { body: { contact: ct, portal: portalPayload(portal) } });
        pushToast(res.warning || "Contact added", res.warning ? "warn" : "success");
        if (res.login) onLogin?.(res.login, ct.name);
      }
      onClose();
      await reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't save the contact", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal open={open} onClose={onClose} label={editing ? "Edit contact" : "Add contact"} panelClassName={panelCls} panelStyle={panelStyle}>
      <form onSubmit={submit} className="space-y-4">
        <Header title={editing ? `Edit ${contact!.name}` : "Add contact"} onClose={onClose} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Name *"><input required value={ct.name} onChange={(e) => setCt({ ...ct, name: e.target.value })} className={inputCls} style={inputStyle} /></Field>
          <Field label="Role"><input value={ct.role} onChange={(e) => setCt({ ...ct, role: e.target.value })} className={inputCls} style={inputStyle} /></Field>
          <Field label="Email" hint={contact?.has_portal_login ? "Changing it also changes their sign-in email." : "Optional."}><input type="email" value={ct.email} onChange={(e) => setCt({ ...ct, email: e.target.value })} className={inputCls} style={inputStyle} /></Field>
          <Field label="Phone"><input value={ct.phone} onChange={(e) => setCt({ ...ct, phone: e.target.value })} className={inputCls} style={inputStyle} /></Field>
          <Field label="WhatsApp"><input value={ct.whatsapp} onChange={(e) => setCt({ ...ct, whatsapp: e.target.value })} className={inputCls} style={inputStyle} /></Field>
        </div>
        {!editing && <PortalAccessFields value={portal} onChange={setPortal} email={ct.email} />}
        <Actions busy={busy} label={editing ? "Save" : "Add contact"} onCancel={onClose} />
      </form>
    </SheetModal>
  );
};

// ---------------------------------------------------------------------------
// Create / reset a portal login for an existing contact
// ---------------------------------------------------------------------------
export const PortalLoginModal: React.FC<{
  open: boolean;
  contact: ClientContact | null;
  onClose: () => void;
  onDone: (login: PortalLogin, name: string) => void;
}> = ({ open, contact, onClose, onDone }) => {
  const { pushToast, reloadFromCloud } = useStudioOS();
  const [loginId, setLoginId] = useState(contact?.portal_login_id || "");
  const [ownPassword, setOwnPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [requireChange, setRequireChange] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!contact) return null;
  const existing = Boolean(contact.has_portal_login && contact.portal_login_id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await studioApi<{ login: PortalLogin }>("/api/studio-os/portal/account", {
        body: { contact_id: contact.id, login_id: loginId.trim() || undefined, password: ownPassword && password ? password : undefined, require_change: ownPassword ? requireChange : true },
      });
      onClose();
      onDone(res.login, contact.name);
      await reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't set up the login", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal open={open} onClose={onClose} label="Portal login" panelClassName={panelCls} panelStyle={panelStyle}>
      <form onSubmit={submit} className="space-y-4">
        <Header title={existing ? `Reset login · ${contact.name}` : `Portal login · ${contact.name}`} onClose={onClose} />
        <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          {existing ? "Issue a new password (the old one stops working). You can also change the Client ID." : "Creates a client-only account. It can open the portal and nothing else."}
        </p>
        <Field label="Client ID (username)" hint="Leave blank to keep the current one, or to generate one.">
          <input value={loginId} onChange={(e) => setLoginId(e.target.value.toUpperCase())} placeholder="Auto-generate" className={inputCls} style={inputStyle} />
        </Field>
        <Toggle checked={ownPassword} onChange={setOwnPassword} label="Set the password myself" hint="Otherwise a temporary password is generated and shown once." />
        {ownPassword && (
          <>
            <Field label="Password" hint="At least 8 characters.">
              <input type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Toggle checked={requireChange} onChange={setRequireChange} label="Ask them to choose their own password at first sign-in" />
          </>
        )}
        <Actions busy={busy} label={existing ? "Reset login" : "Create login"} onCancel={onClose} />
      </form>
    </SheetModal>
  );
};

// ---------------------------------------------------------------------------
// One-time credentials card
// ---------------------------------------------------------------------------
export const CredentialsModal: React.FC<{ login: PortalLogin | null; name: string; onClose: () => void }> = ({ login, name, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);
  if (!login) return null;
  const portalUrl = `${window.location.origin}/portal`;
  const message = [
    `Hi ${name.split(" ")[0]},`,
    ``,
    `You can follow your productions with The Chanting Studio here:`,
    portalUrl,
    ``,
    `Client ID: ${login.login_id}`,
    login.password ? `Temporary password: ${login.password}` : `Password: (shared separately)`,
    login.email_login ? `You can also sign in with ${login.email_login}.` : ``,
    login.password ? `You'll be asked to choose your own password when you first sign in.` : ``,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n")
    .trim();
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };
  const Row: React.FC<{ k: string; label: string; value: string }> = ({ k, label, value }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>{label}</p>
        <p className="text-[16px] font-semibold sos-tabular break-all" style={{ color: "var(--sos-text-1)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{value}</p>
      </div>
      <button type="button" onClick={() => copy(k, value)} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ color: "var(--sos-text-2)", background: "var(--sos-surface)" }} aria-label={`Copy ${label}`}>
        {copied === k ? <Check className="w-4 h-4" style={{ color: "var(--sos-green)" }} /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
  return (
    <SheetModal open onClose={onClose} label="Portal login details" panelClassName={panelCls} panelStyle={panelStyle}>
      <div className="space-y-4">
        <Header title="Portal login ready" onClose={onClose} />
        <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          <KeyRound className="w-4 h-4 inline mr-1 -mt-0.5" /> Share these with {name}.{login.password ? " The temporary password is shown only now." : ""}
        </p>
        <Row k="url" label="Portal" value={portalUrl} />
        <Row k="id" label="Client ID" value={login.login_id} />
        {login.password && <Row k="pw" label="Temporary password" value={login.password} />}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={() => copy("msg", message)} className="sos-pill-btn h-11 px-5 text-[14px] font-medium border inline-flex items-center gap-2" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
            {copied === "msg" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy message for client
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer" className="sos-pill-btn h-11 px-5 text-[14px] font-semibold text-white inline-flex items-center gap-2" style={{ background: "var(--sos-primary)" }}>
            <RefreshCw className="w-4 h-4" /> Open portal
          </a>
        </div>
      </div>
    </SheetModal>
  );
};
