import React, { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Copy, Eye, EyeOff, Link2, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { StudioGate, StudioProject } from "../types";

export interface Deliverable {
  id: string;
  project_id: string;
  gate_id: string | null;
  title: string;
  url: string;
  version: string | null;
  shared_with_client: boolean;
  created_at: string;
}

export function useProjectDeliverables(projectId: string) {
  const { supabaseSyncStatus } = useStudioOS();
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (supabaseSyncStatus !== "synced" || !supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("studio_deliverables")
      .select("id, project_id, gate_id, title, url, version, shared_with_client, created_at")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    setItems((data || []) as Deliverable[]);
    setLoading(false);
  }, [projectId, supabaseSyncStatus]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return { items, loading, reload: load };
}

const inputStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };

export const portalLinkFor = (projectId: string) => `${window.location.origin}/portal?project=${projectId}`;

// ---------------------------------------------------------------------------
// Deliverables tab
// ---------------------------------------------------------------------------
export const ProjectDeliverablesTab: React.FC<{ project: StudioProject; gates: StudioGate[] }> = ({ project, gates }) => {
  const { pushToast } = useStudioOS();
  const { items, loading, reload } = useProjectDeliverables(project.id);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("v1");
  const [gateId, setGateId] = useState("");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !title.trim() || !/^https?:\/\//.test(url.trim())) {
      pushToast("Add a title and a full https:// link", "warn");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("studio_deliverables").insert({
      project_id: project.id,
      gate_id: gateId || null,
      title: title.trim(),
      url: url.trim(),
      version: version.trim() || null,
      shared_with_client: shared,
    });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setTitle("");
    setUrl("");
    pushToast(shared ? "Added & shared in the client portal" : "Added (internal only)", "success");
    reload();
  };

  const toggleShare = async (d: Deliverable) => {
    await supabase?.from("studio_deliverables").update({ shared_with_client: !d.shared_with_client }).eq("id", d.id);
    reload();
  };
  const archive = async (d: Deliverable) => {
    if (!window.confirm(`Remove “${d.title}”?`)) return;
    await supabase?.from("studio_deliverables").update({ archived_at: new Date().toISOString() }).eq("id", d.id);
    reload();
  };

  return (
    <div className="sos-card p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Deliverables &amp; versions
          </h2>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            Shared items appear in the client portal. Vimeo, YouTube and Google Drive links play inline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(portalLinkFor(project.id));
            pushToast("Portal link copied", "info");
          }}
          className="sos-pill-btn h-9 px-3.5 text-[12px] font-medium border inline-flex items-center gap-1.5"
          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
        >
          <Copy className="w-3.5 h-3.5" /> Copy portal link
        </button>
      </div>

      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-6 gap-2.5 p-3 rounded-[18px]" style={{ background: "var(--sos-surface-2)" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Fine cut)" className="md:col-span-2 h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://vimeo.com/…" className="md:col-span-2 h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
        <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1" className="h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
        <select value={gateId} onChange={(e) => setGateId(e.target.value)} className="h-10 px-2 rounded-[12px] border text-[13px]" style={inputStyle}>
          <option value="">No stage</option>
          {gates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} · {g.name}
            </option>
          ))}
        </select>
        <label className="md:col-span-4 inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="w-4 h-4 accent-[#5B3FE4]" />
          Share with client in the portal
        </label>
        <button type="submit" disabled={busy} className="md:col-span-2 sos-pill-btn h-10 text-[13px] font-semibold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-primary)" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add deliverable
        </button>
      </form>

      {loading ? (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No deliverables yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((d) => {
            const gate = gates.find((g) => g.id === d.gate_id);
            return (
              <div key={d.id} className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] sos-tile">
                <Link2 className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
                <div className="min-w-0 flex-1">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold truncate block hover:underline" style={{ color: "var(--sos-text-1)" }}>
                    {d.title} {d.version && <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>{d.version}</span>}
                  </a>
                  <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
                    {[gate ? `${gate.code} ${gate.name}` : null, format(parseISO(d.created_at), "d MMM yyyy")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleShare(d)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={d.shared_with_client ? { background: "#E7F7EE", color: "#22875A" } : { background: "var(--sos-surface)", color: "var(--sos-text-3)" }}
                  title="Toggle client visibility"
                >
                  {d.shared_with_client ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {d.shared_with_client ? "In portal" : "Internal"}
                </button>
                <button type="button" onClick={() => archive(d)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label="Remove">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Send for approval
// ---------------------------------------------------------------------------
export const SendForApprovalModal: React.FC<{ project: StudioProject; gate: StudioGate; onClose: () => void }> = ({ project, gate, onClose }) => {
  const { updateGate, pushToast } = useStudioOS();
  const { items } = useProjectDeliverables(project.id);
  const latest = items.find((d) => d.gate_id === gate.id);
  const nextVersion = `v${gate.revision_round + 1}`;
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState(`${gate.name} ${nextVersion}`);
  const [reuse, setReuse] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (latest && !url) {
      setReuse(true);
    } else if (!latest && !url && project.review_link_url) {
      setUrl(project.review_link_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const send = async () => {
    if (!reuse && url.trim() && !/^https?:\/\//.test(url.trim())) {
      pushToast("Use a full https:// review link", "warn");
      return;
    }
    setBusy(true);
    try {
      if (!reuse && url.trim() && supabase) {
        const { error } = await supabase.from("studio_deliverables").insert({
          project_id: project.id,
          gate_id: gate.id,
          title: title.trim() || `${gate.name} ${nextVersion}`,
          url: url.trim(),
          version: nextVersion,
          shared_with_client: true,
        });
        if (error) throw new Error(error.message);
      }
      updateGate(gate.id, { status: "waiting_on_client", portal_visible: true });
      navigator.clipboard?.writeText(portalLinkFor(project.id)).catch(() => {});
      pushToast(`${gate.name} sent for approval — portal link copied`, "success");
      onClose();
    } catch (err: any) {
      pushToast(err?.message || "Could not send", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4" onClick={onClose}>
      <div className="w-full md:max-w-lg rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl border space-y-4" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Send {gate.name} for approval
            </h3>
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              Appears instantly in the client portal with Approve / Request changes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {latest && (
          <label className="flex items-start gap-2 text-[13px] p-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
            <input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#5B3FE4]" />
            <span>
              Use the latest shared version: <strong style={{ color: "var(--sos-text-1)" }}>{latest.title}</strong>
            </span>
          </label>
        )}
        {!reuse && (
          <div className="space-y-2.5">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Review link — Vimeo, YouTube, Google Drive or Frame.io" className="w-full h-11 px-3.5 rounded-[14px] border text-[14px]" style={inputStyle} />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title shown to the client" className="w-full h-11 px-3.5 rounded-[14px] border text-[14px]" style={inputStyle} />
          </div>
        )}
        <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
          Revision rounds used: {gate.revision_round} of {gate.revisions_included} included.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="sos-pill-btn px-4 h-11 text-[14px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={send} className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50" style={{ background: "var(--sos-blue)" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to client
          </button>
        </div>
      </div>
    </div>
  );
};
