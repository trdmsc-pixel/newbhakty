import React, { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Award, Copy, Download, Eye, EyeOff, Image as ImageIcon, Link2, Loader2, MessageSquare, Play, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { thumbFor } from "../../review/ProjectThumb";
import { ReviewMedia, type ReviewMediaHandle, fmtTime, parseMedia, parseNote } from "../../review/ReviewMedia";
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
  is_final?: boolean;
  download_url?: string | null;
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
      .select("id, project_id, gate_id, title, url, version, shared_with_client, created_at, is_final, download_url")
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

/** Signed URL for a private review image (storage://studio-review/…). */
export const resolveStudioReviewUrl = async (url: string) => {
  if (!supabase || !url.startsWith("storage://studio-review/")) return null;
  const { data } = await supabase.storage.from("studio-review").createSignedUrl(url.replace("storage://studio-review/", ""), 3600);
  return data?.signedUrl || null;
};

/** Upload an image for client review to the private bucket; returns its storage:// url. */
export async function uploadReviewImage(projectId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Cloud sync is off");
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error("Use a JPG, PNG, WebP, GIF or AVIF image");
  if (file.size > 25 * 1024 * 1024) throw new Error("Images must be 25 MB or smaller");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("studio-review").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return `storage://studio-review/${path}`;
}

const KIND_LABEL: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", image: "Image", iframe: "Embed", link: "Link" };

/** Player + the client's timestamped / pinned notes for one deliverable. */
const DeliverableReview: React.FC<{ d: Deliverable }> = ({ d }) => {
  const { tasks, updateTask, toggleTaskDone } = useStudioOS();
  const player = useRef<ReviewMediaHandle>(null);
  const [active, setActive] = useState<string | null>(null);
  const notes = tasks
    .filter((t) => d.gate_id && t.gate_id === d.gate_id && t.source === "portal")
    .map((t) => ({ task: t, note: parseNote(t.title) }))
    .filter((x) => x.note)
    .sort((a, b) => (a.note!.time ?? a.note!.pin?.n ?? 0) - (b.note!.time ?? b.note!.pin?.n ?? 0));
  return (
    <div className="space-y-3 pt-1">
      <ReviewMedia
        ref={player}
        url={d.url}
        resolveUrl={resolveStudioReviewUrl}
        pins={notes.filter((n) => n.note!.pin).map((n) => ({ ...n.note!.pin!, active: n.task.id === active }))}
      />
      {notes.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "var(--sos-text-2)" }}>
            <MessageSquare className="w-3.5 h-3.5" /> Client notes ({notes.filter((n) => n.task.status !== "done").length} open)
          </p>
          {notes.map(({ task, note }) => (
            <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-[12px]" style={{ background: "var(--sos-surface)", opacity: task.status === "done" ? 0.55 : 1 }} onMouseEnter={() => setActive(task.id)} onMouseLeave={() => setActive(null)}>
              {note!.time !== undefined ? (
                <button type="button" onClick={() => player.current?.seek(note!.time!)} className="shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded-full text-[12px] font-semibold sos-tabular text-white" style={{ background: "var(--sos-primary)" }} title="Jump to this moment">
                  <Play className="w-3 h-3" /> {fmtTime(note!.time!)}
                </button>
              ) : (
                <span className="shrink-0 px-2 h-7 rounded-full text-[12px] font-semibold flex items-center text-white" style={{ background: task.id === active ? "#B42318" : "var(--sos-primary)" }}>
                  Pin {note!.pin!.n}
                </span>
              )}
              <span className="flex-1 min-w-0 text-[13px]" style={{ color: "var(--sos-text-1)", textDecoration: task.status === "done" ? "line-through" : undefined }}>
                {note!.text}
              </span>
              <span className="text-[11px] shrink-0" style={{ color: "var(--sos-text-3)" }}>{task.key}</span>
              <button
                type="button"
                onClick={() => (task.status === "done" ? updateTask(task.id, { status: "todo" }) : toggleTaskDone(task.id))}
                className="shrink-0 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                style={task.status === "done" ? { background: "#E7F7EE", color: "#17663F" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
              >
                {task.status === "done" ? "Fixed ✓" : "Mark fixed"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        d.gate_id && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Client notes with timestamps or pins appear here, live.</p>
      )}
    </div>
  );
};

export const portalLinkFor = (projectId: string) => `${window.location.origin}/portal?project=${projectId}`;

// ---------------------------------------------------------------------------
// Deliverables tab
// ---------------------------------------------------------------------------
export const ProjectDeliverablesTab: React.FC<{ project: StudioProject; gates: StudioGate[] }> = ({ project, gates }) => {
  const { pushToast, updateProject } = useStudioOS();
  const [isFinal, setIsFinal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const { items, loading, reload } = useProjectDeliverables(project.id);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("v1");
  const [gateId, setGateId] = useState("");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setBusy(true);
    try {
      const storageUrl = await uploadReviewImage(project.id, file);
      setUrl(storageUrl);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      pushToast("Image uploaded — add it below", "success");
    } catch (err: any) {
      pushToast(err?.message || "Upload failed", "warn");
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !title.trim() || !/^(https?:\/\/|storage:\/\/studio-review\/)/.test(url.trim())) {
      pushToast("Add a title and a link (or upload an image)", "warn");
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
      is_final: isFinal,
      download_url: downloadUrl.trim() || null,
    });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setTitle("");
    setUrl("");
    setDownloadUrl("");
    setIsFinal(false);
    pushToast(shared ? "Added & shared in the client portal" : "Added (internal only)", "success");
    reload();
  };

  const toggleFinal = async (d: Deliverable) => {
    await supabase?.from("studio_deliverables").update({ is_final: !d.is_final, ...(d.is_final ? {} : { shared_with_client: true }) }).eq("id", d.id);
    pushToast(d.is_final ? "No longer marked final" : "Marked as final delivery — visible in the client portal", "success");
    reload();
  };
  const editDownload = async (d: Deliverable) => {
    const next = window.prompt("Direct download link for the master file (Drive, Dropbox, WeTransfer…). Leave empty to remove.", d.download_url || "");
    if (next === null) return;
    await supabase?.from("studio_deliverables").update({ download_url: next.trim() || null }).eq("id", d.id);
    reload();
  };
  const useAsCover = (d: Deliverable) => {
    const t = thumbFor(d.url);
    const cover = t?.kind === "img" && !d.url.startsWith("storage://") ? t.src : null;
    if (!cover) return pushToast("This one can't be a cover — use a YouTube/Vimeo/Drive link or a public image.", "warn");
    updateProject(project.id, { cover_image_url: cover });
    pushToast("Project cover updated", "success");
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
            Shared items appear in the client portal. YouTube, Vimeo and images open in the review player; clients leave timestamped notes and pins.
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
        <div className="md:col-span-2 flex gap-1.5">
          <input value={url.startsWith("storage://") ? "🖼 Uploaded image" : url} readOnly={url.startsWith("storage://")} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube / Vimeo / image link" className="flex-1 min-w-0 h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
          <button type="button" onClick={() => (url.startsWith("storage://") ? setUrl("") : fileRef.current?.click())} className="shrink-0 h-10 px-3 rounded-[12px] border text-[12px] font-semibold inline-flex items-center gap-1" style={inputStyle} title="Upload an image for review">
            {url.startsWith("storage://") ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />} {url.startsWith("storage://") ? "" : "Image"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ""; }} />
        </div>
        <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1" className="h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
        <select value={gateId} onChange={(e) => setGateId(e.target.value)} className="h-10 px-2 rounded-[12px] border text-[13px]" style={inputStyle}>
          <option value="">No stage</option>
          {gates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} · {g.name}
            </option>
          ))}
        </select>
        <input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="Optional: master-file download link (Drive / Dropbox / WeTransfer)" className="md:col-span-6 h-10 px-3 rounded-[12px] border text-[13px]" style={inputStyle} />
        <div className="md:col-span-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="w-4 h-4 accent-[#5B3FE4]" />
            Share with client in the portal
          </label>
          <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            <input type="checkbox" checked={isFinal} onChange={(e) => { setIsFinal(e.target.checked); if (e.target.checked) setShared(true); }} className="w-4 h-4 accent-[#1F7A52]" />
            Final delivery (client can download)
          </label>
        </div>
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
              <div key={d.id} className="px-3.5 py-3 rounded-[14px] sos-tile">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {parseMedia(d.url)?.kind === "image" ? <ImageIcon className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} /> : ["youtube", "vimeo"].includes(parseMedia(d.url)?.kind || "") ? <Play className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} /> : <Link2 className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />}
                <div className="min-w-[55%] flex-1">
                  <button type="button" onClick={() => setOpenId(openId === d.id ? null : d.id)} className="text-[14px] font-semibold truncate block hover:underline text-left max-w-full" style={{ color: "var(--sos-text-1)" }} aria-expanded={openId === d.id}>
                    {d.is_final && <span className="inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold align-middle" style={{ background: "#E7F7EE", color: "#17663F" }}><Award className="w-3 h-3" /> FINAL</span>}
                    {d.title} {d.version && <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>{d.version}</span>}
                    <span className="text-[11px] font-medium ml-1.5" style={{ color: "var(--sos-text-3)" }}>{KIND_LABEL[parseMedia(d.url)?.kind || "link"]} · {openId === d.id ? "Hide" : "Review"}</span>
                  </button>
                  <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
                    {[gate ? `${gate.code} ${gate.name}` : null, format(parseISO(d.created_at), "d MMM yyyy")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFinal(d)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={d.is_final ? { background: "#1F7A52", color: "#FFFFFF" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                  title="The final delivery appears at the top of the client portal with a download button"
                >
                  <Award className="w-3 h-3" /> {d.is_final ? "Final" : "Mark final"}
                </button>
                <button
                  type="button"
                  onClick={() => editDownload(d)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={d.download_url ? { background: "var(--sos-violet-soft)", color: "var(--sos-primary)" } : { background: "var(--sos-surface)", color: "var(--sos-text-3)" }}
                  title={d.download_url || "Add a master-file download link"}
                >
                  <Download className="w-3 h-3" /> {d.download_url ? "Download link" : "Add download"}
                </button>
                <button
                  type="button"
                  onClick={() => useAsCover(d)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={project.cover_image_url && thumbFor(d.url)?.src === project.cover_image_url ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface)", color: "var(--sos-text-3)" }}
                  title="Use this as the project thumbnail"
                >
                  <ImageIcon className="w-3 h-3" /> Cover
                </button>
                <button
                  type="button"
                  onClick={() => toggleShare(d)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold"
                  style={d.shared_with_client ? { background: "#E7F7EE", color: "#17663F" } : { background: "var(--sos-surface)", color: "var(--sos-text-3)" }}
                  title="Toggle client visibility"
                >
                  {d.shared_with_client ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {d.shared_with_client ? "In portal" : "Internal"}
                </button>
                <button type="button" onClick={() => archive(d)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label="Remove">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {openId === d.id && <DeliverableReview d={d} />}
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (latest && !url) {
      setReuse(true);
    } else if (!latest && !url && project.review_link_url) {
      setUrl(project.review_link_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const send = async () => {
    if (!reuse && url.trim() && !/^(https?:\/\/|storage:\/\/studio-review\/)/.test(url.trim())) {
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
            <div className="flex gap-2">
              <input
                value={url.startsWith("storage://") ? "🖼 Image uploaded" : url}
                readOnly={url.startsWith("storage://")}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="YouTube or Vimeo link (plays in the portal)"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-[14px] border text-[14px]"
                style={inputStyle}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => (url.startsWith("storage://") ? setUrl("") : fileRef.current?.click())}
                className="shrink-0 h-11 px-3.5 rounded-[14px] border text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                style={inputStyle}
              >
                {url.startsWith("storage://") ? <X className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />} {url.startsWith("storage://") ? "Remove" : "Image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    setUrl(await uploadReviewImage(project.id, f));
                  } catch (err: any) {
                    pushToast(err?.message || "Upload failed", "warn");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
            {url && parseMedia(url) && parseMedia(url)!.kind !== "link" && (
              <div className="max-h-[260px] overflow-hidden rounded-[18px]">
                <ReviewMedia url={url} resolveUrl={resolveStudioReviewUrl} />
              </div>
            )}
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
