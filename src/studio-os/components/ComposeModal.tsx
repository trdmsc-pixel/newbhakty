import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Send, X } from "lucide-react";
import { studioApi } from "../api";
import { useStudioOS } from "../StudioOSContext";

export interface MailAccountInfo {
  id: string;
  email: string;
  can_send: boolean;
  can_modify: boolean;
  has_signature: boolean;
}

const SIG_LABEL: Record<string, string> = {
  "shyam@thechantingstudio.in": "Shyam Default",
  "studio@thechantingstudio.in": "Studio Official",
  "accounts@thechantingstudio.in": "Accounts",
};

/** Signature picker options: each account's signature, studio default, or none. */
export function signatureOptions(accounts: MailAccountInfo[]) {
  return [
    ...accounts.filter((a) => a.has_signature).map((a) => ({ value: a.email, label: SIG_LABEL[a.email] || a.email })),
    { value: "default", label: "Studio default" },
    { value: "none", label: "No signature" },
  ];
}

let accountsCache: { at: number; data: MailAccountInfo[] } | null = null;
export async function loadMailAccounts(force = false): Promise<MailAccountInfo[]> {
  if (!force && accountsCache && Date.now() - accountsCache.at < 60_000) return accountsCache.data;
  const res = await studioApi<{ accounts: MailAccountInfo[] }>("/api/studio-os/mail/accounts");
  accountsCache = { at: Date.now(), data: res.accounts };
  return res.accounts;
}

const splitEmails = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

const inputCls = "w-full h-11 px-3.5 rounded-[14px] border text-[14px]";
const inputStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };

export const ComposeModal: React.FC<{
  onClose: () => void;
  initial?: { to?: string; subject?: string; body?: string; account?: string; projectId?: string };
}> = ({ onClose, initial }) => {
  const { pushToast } = useStudioOS();
  const [accounts, setAccounts] = useState<MailAccountInfo[]>([]);
  const [from, setFrom] = useState(initial?.account || "");
  const [to, setTo] = useState(initial?.to || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  const [signature, setSignature] = useState("account");
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);

  useEffect(() => {
    loadMailAccounts()
      .then((list) => {
        setAccounts(list);
        const pick = initial?.account || list.find((a) => a.email.startsWith("studio@"))?.email || list[0]?.email || "";
        setFrom(pick);
        setSignature(list.find((a) => a.email === pick)?.has_signature ? pick : "default");
      })
      .catch((err) => pushToast(err?.message || "Connect a Gmail account in Settings first", "warn"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (mode: "send" | "draft") => {
    const toList = splitEmails(to);
    if (!from || !toList.length) return pushToast("Choose a From account and at least one recipient", "warn");
    if (mode === "send" && !body.trim()) return pushToast("Write a message first", "warn");
    setBusy(mode);
    try {
      await studioApi("/api/studio-os/mail/send", {
        body: { account: from, to: toList, cc: splitEmails(cc), subject, body, signature, mode, project_id: initial?.projectId },
      });
      pushToast(mode === "send" ? "Sent" : "Saved to Gmail Drafts", "success");
      onClose();
    } catch (err: any) {
      pushToast(err?.message || "Couldn't send", "warn");
    } finally {
      setBusy(null);
    }
  };

  const fromAcct = accounts.find((a) => a.email === from);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Compose email"
        className="w-full md:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] p-5 md:p-6 shadow-2xl border space-y-3"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            New email
          </h3>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="block">
            <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} style={inputStyle}>
              {accounts.map((a) => (
                <option key={a.id} value={a.email}>{a.email}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold mb-1" style={{ color: "var(--sos-text-2)" }}>Signature</span>
            <select value={signature} onChange={(e) => setSignature(e.target.value)} className={inputCls} style={inputStyle}>
              {signatureOptions(accounts).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <input aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To — name@company.com" className={`${inputCls} sm:col-span-2`} style={inputStyle} />
          <input aria-label="Cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc (optional)" className={`${inputCls} sm:col-span-2`} style={inputStyle} />
          <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={`${inputCls} sm:col-span-2`} style={inputStyle} />
          <textarea
            aria-label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            placeholder="Write your message…"
            className="sm:col-span-2 w-full px-3.5 py-3 rounded-[14px] border text-[14px] leading-relaxed resize-y"
            style={inputStyle}
          />
        </div>
        {fromAcct && !fromAcct.can_send && (
          <p className="text-[12px] px-3 py-2 rounded-[12px]" style={{ background: "#FFF1E6", color: "#9A3412" }}>
            Reconnect {fromAcct.email} in Settings to allow sending — you can still save a draft.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" disabled={Boolean(busy)} onClick={() => submit("draft")} className="sos-pill-btn h-11 px-5 text-[14px] font-medium border disabled:opacity-50 inline-flex items-center gap-2" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
            {busy === "draft" && <Loader2 className="w-4 h-4 animate-spin" />} Save Draft
          </button>
          <button type="button" disabled={Boolean(busy) || (fromAcct && !fromAcct.can_send)} onClick={() => submit("send")} className="sos-pill-btn h-11 px-6 text-[14px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--sos-primary)" }}>
            {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
