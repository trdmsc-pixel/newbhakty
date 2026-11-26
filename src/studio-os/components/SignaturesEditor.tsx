import React, { useEffect, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";

interface SigRow {
  id: string;
  email: string;
  signature_text: string | null;
  signature_enabled: boolean;
}

const areaCls = "w-full px-3.5 py-3 rounded-[14px] border text-[13px] leading-relaxed resize-y min-h-[84px]";
const areaStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };

/** Per-account email signatures + the studio default. Plain text → HTML on send. */
export const SignaturesEditor: React.FC = () => {
  const { pushToast } = useStudioOS();
  const [rows, setRows] = useState<SigRow[]>([]);
  const [def, setDef] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("studio_gmail_accounts")
      .select("id, email, signature_text, signature_enabled")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("email")
      .then(({ data }) => setRows((data || []) as SigRow[]));
    supabase
      .from("studio_settings")
      .select("id, default_signature_text")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setSettingsId(data?.id || null);
        setDef(data?.default_signature_text || "");
      });
  }, []);

  const save = async (row: SigRow) => {
    if (!supabase) return;
    setBusy(row.id);
    const { error } = await supabase
      .from("studio_gmail_accounts")
      .update({ signature_text: row.signature_text?.trim() || null, signature_html: null, signature_enabled: row.signature_enabled })
      .eq("id", row.id);
    setBusy(null);
    pushToast(error ? error.message : `Signature saved for ${row.email}`, error ? "warn" : "success");
  };
  const saveDefault = async () => {
    if (!supabase || !settingsId) return;
    setBusy("default");
    const { error } = await supabase.from("studio_settings").update({ default_signature_text: def.trim(), default_signature_html: null }).eq("id", settingsId);
    setBusy(null);
    pushToast(error ? error.message : "Studio default signature saved", error ? "warn" : "success");
  };

  return (
    <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--sos-border)" }}>
      <p className="text-[14px] font-semibold flex items-center gap-2 pt-2" style={{ color: "var(--sos-text-1)" }}>
        <PenLine className="w-4 h-4" style={{ color: "var(--sos-primary)" }} /> Signatures
      </p>
      <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
        Added below “--” when you send from Studio OS Mail. Links become clickable automatically.
      </p>
      {rows.map((r) => (
        <div key={r.id} className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{r.email}</span>
            <label className="inline-flex items-center gap-2 min-h-[44px] text-[12px] font-medium" style={{ color: "var(--sos-text-2)" }}>
              <input
                type="checkbox"
                checked={r.signature_enabled}
                onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, signature_enabled: e.target.checked } : x)))}
                className="w-4 h-4 accent-[#5B3FE4]"
              />
              Use signature
            </label>
          </div>
          <textarea
            aria-label={`Signature for ${r.email}`}
            value={r.signature_text || ""}
            onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, signature_text: e.target.value } : x)))}
            className={areaCls}
            style={{ ...areaStyle, background: "var(--sos-surface)" }}
          />
          <div className="flex justify-end">
            <button type="button" disabled={busy === r.id} onClick={() => save(r)} className="sos-pill-btn min-h-[40px] px-4 text-[12px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-primary)" }}>
              {busy === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>
      ))}
      <div className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
        <span className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Studio default</span>
        <textarea aria-label="Studio default signature" value={def} onChange={(e) => setDef(e.target.value)} className={areaCls} style={{ ...areaStyle, background: "var(--sos-surface)" }} />
        <div className="flex justify-end">
          <button type="button" disabled={busy === "default"} onClick={saveDefault} className="sos-pill-btn min-h-[40px] px-4 text-[12px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-primary)" }}>
            {busy === "default" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save default
          </button>
        </div>
      </div>
    </div>
  );
};
