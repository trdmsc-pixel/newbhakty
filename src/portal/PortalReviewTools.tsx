/**
 * Portal review helpers (Gemini fast tier on the server):
 *  - VoiceNoteButton: speak a note (any language, incl. Hindi/Hinglish) → clean written note
 *  - SketchOverlay:   draw on the paused frame → the studio gets the drawing + an AI description
 */
import React, { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, Mic, Send, Square, Undo2, X } from "lucide-react";
import { supabase } from "./portalSupabase";

async function token() {
  return supabase ? (await supabase.auth.getSession()).data.session?.access_token || "" : "";
}

const MAX_SECONDS = 120;

export const VoiceNoteButton: React.FC<{
  stage?: string;
  /** Called right before recording starts; return the timestamp label (e.g. "1:23") if any. */
  onStart?: () => Promise<string | undefined> | string | undefined;
  onText: (text: string, time?: string) => void;
  onError: (msg: string) => void;
}> = ({ stage, onStart, onText, onError }) => {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timeLabel = useRef<string | undefined>(undefined);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const supported = typeof window !== "undefined" && typeof (window as any).MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  if (!supported) return null;

  const start = async () => {
    try {
      timeLabel.current = (await onStart?.()) || undefined;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => (window as any).MediaRecorder.isTypeSupported?.(m)) || "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) window.clearInterval(timer.current);
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        if (blob.size < 800) {
          setState("idle");
          return onError("That recording was too short — hold on and speak your note.");
        }
        setState("busy");
        try {
          const b64 = await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result).split(",")[1] || "");
            fr.onerror = () => rej(new Error("read failed"));
            fr.readAsDataURL(blob);
          });
          const resp = await fetch("/api/portal/ai/voice-note", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
            body: JSON.stringify({ audio: b64, mime: blob.type, stage, time: timeLabel.current }),
          });
          const j = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(j.error || "Couldn't turn that into a note.");
          onText(j.text, timeLabel.current);
        } catch (e: any) {
          onError(e?.message || "Couldn't turn that into a note.");
        } finally {
          setState("idle");
        }
      };
      rec.current = r;
      r.start();
      setSecs(0);
      setState("rec");
      timer.current = window.setInterval(() => {
        setSecs((s) => {
          if (s + 1 >= MAX_SECONDS) r.state === "recording" && r.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setState("idle");
      onError("Microphone access was blocked — allow the mic for this site, or type your note.");
    }
  };

  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={() => (state === "rec" ? rec.current?.stop() : start())}
      className="sos-pill-btn h-10 px-4 text-[13px] font-semibold border inline-flex items-center gap-2 disabled:opacity-60"
      style={state === "rec" ? { background: "#B42318", color: "#fff", borderColor: "#B42318" } : { borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
      title="Speak your note — any language. AI writes it up clearly."
    >
      {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : state === "rec" ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
      {state === "rec" ? `Stop · 0:${String(secs).padStart(2, "0")}` : state === "busy" ? "Writing it up…" : "Speak a note"}
    </button>
  );
};

const COLORS = ["#FF3B30", "#FFD60A", "#34C759", "#0A84FF", "#FFFFFF"];

/** Drawing layer laid over the player (absolute, fills the parent). */
export const SketchOverlay: React.FC<{
  gateId: string;
  mediaUrl?: string | null;
  time?: number;
  timeLabel?: string;
  onDone: (note: string) => void;
  onCancel: () => void;
  /** The paused player / image the sketch is drawn over. */
  children: React.ReactNode;
}> = ({ gateId, mediaUrl, time, timeLabel, onDone, onCancel, children }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Array<{ color: string; w: number; pts: Array<[number, number]> }>>([]);
  const drawing = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  const redraw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes.current) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.w * (c.width / 960);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.width, y * c.height) : ctx.moveTo(x * c.width, y * c.height)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * c.width + 0.1, s.pts[0][1] * c.height);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.round(r.width * Math.min(2, window.devicePixelRatio || 1));
      c.height = Math.round(r.height * Math.min(2, window.devicePixelRatio || 1));
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const send = async () => {
    if (!strokes.current.length) return setError("Draw on the frame first.");
    setBusy(true);
    setError("");
    try {
      // Export a compact transparent PNG (max 960 px wide).
      const out = document.createElement("canvas");
      const src = canvas.current!;
      const scale = Math.min(1, 960 / src.width);
      out.width = Math.round(src.width * scale);
      out.height = Math.round(src.height * scale);
      out.getContext("2d")!.drawImage(src, 0, 0, out.width, out.height);
      const image = out.toDataURL("image/png");
      const r = await fetch("/api/portal/ai/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ gate_id: gateId, image, time, comment: comment.trim() || undefined, media_url: mediaUrl || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send the sketch.");
      onDone(String(j.note || comment || "See my sketch on this frame."));
    } catch (e: any) {
      setError(e?.message || "Couldn't send the sketch.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
      {children}
      <div className="absolute inset-0 z-10 rounded-[18px] overflow-hidden" style={{ cursor: "crosshair", touchAction: "none" }}>
        <canvas
          ref={canvas}
          className="w-full h-full block"
          style={{ background: "rgba(0,0,0,0.08)" }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drawing.current = true;
            strokes.current.push({ color, w: 6, pts: [pt(e)] });
            redraw();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1].pts.push(pt(e));
            redraw();
          }}
          onPointerUp={() => {
            drawing.current = false;
            setCount(strokes.current.length);
          }}
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className="w-6 h-6 rounded-full" style={{ background: c, outline: color === c ? "2px solid #fff" : "none", outlineOffset: 2 }} aria-label={`Colour ${c}`} />
          ))}
          <button type="button" onClick={() => { strokes.current.pop(); setCount(strokes.current.length); redraw(); }} className="w-7 h-7 rounded-full flex items-center justify-center text-white" aria-label="Undo stroke"><Undo2 className="w-4 h-4" /></button>
          <button type="button" onClick={() => { strokes.current = []; setCount(0); redraw(); }} className="w-7 h-7 rounded-full flex items-center justify-center text-white" aria-label="Clear"><Eraser className="w-4 h-4" /></button>
        </div>
        {timeLabel && <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[12px] font-semibold text-white sos-tabular" style={{ background: "rgba(0,0,0,0.6)" }}>✏️ {timeLabel}</span>}
      </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)" className="flex-1 min-w-0 h-10 px-3 rounded-[12px] border text-[14px]" style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />
        <div className="flex gap-2">
          <button type="button" disabled={busy || !count} onClick={send} className="sos-pill-btn h-10 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--sos-primary)" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Add sketch
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className="sos-pill-btn h-10 px-3 text-[13px] font-medium border inline-flex items-center gap-1" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
      {error && <p className="text-[12px]" style={{ color: "#B42318" }}>{error}</p>}
    </div>
  );
};
