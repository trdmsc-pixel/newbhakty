/**
 * "✨ Write with AI" for admin text fields (Meta Muse via /api/admin/ai/write).
 * Shows three suggestions; one click applies a suggestion to the field.
 */
import React, { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface AIWriteConfig {
  /** Human name of the field, e.g. "Hero headline". */
  field: string;
  value: string;
  onApply: (text: string) => void;
  /** Extra context for the model (e.g. the film's title/category). */
  context?: string;
  maxChars?: number;
}

export const AIWriteButton: React.FC<AIWriteConfig> = ({ field, value, onApply, context, maxChars }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
      let adminKey = "";
      try {
        adminKey = sessionStorage.getItem("bhakty_admin_password") || "";
      } catch {
        /* ignore */
      }
      const r = await fetch("/api/admin/ai/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({ field, current: value || undefined, context, instruction: instruction.trim() || undefined, maxChars }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `AI request failed (${r.status})`);
      setSuggestions(j.suggestions || []);
    } catch (e: any) {
      setError(e?.message || "AI request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold bg-[var(--a-accent-soft)] text-[var(--a-accent)] hover:brightness-95 cursor-pointer"
        aria-expanded={open}
        title={`Write ${field} with AI (Meta Muse)`}
      >
        <Sparkles className="w-3 h-3" /> Write with AI
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-[90] w-[min(92vw,380px)] rounded-[1.25rem] border border-[var(--a-line)] bg-[var(--a-surface-1)] shadow-[var(--a-shadow-floating)] p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--a-text)] truncate">✨ {field}</p>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), generate())}
              placeholder={value ? "e.g. shorter, more premium, add urgency" : "What should it say?"}
              className="flex-1 min-w-0 h-9 px-3 rounded-full border border-[var(--a-line)] bg-[var(--a-surface-2)] text-[13px] text-[var(--a-text)] outline-none focus:border-[var(--a-accent)]"
              aria-label="Instruction for AI"
            />
            <button type="button" disabled={busy} onClick={generate} className="h-9 px-3.5 rounded-full text-[12px] font-semibold text-white bg-[var(--a-accent)] disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {suggestions.length ? "Again" : "Generate"}
            </button>
          </div>
          {error && <p className="text-[12px] text-[var(--a-danger-text)]">{error}</p>}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onApply(s);
                setOpen(false);
              }}
              className="w-full text-left p-3 rounded-[14px] bg-[var(--a-surface-2)] hover:bg-[var(--a-surface-3)] text-[13px] text-[var(--a-text)] leading-snug cursor-pointer"
              title="Use this"
            >
              {s}
            </button>
          ))}
          {!suggestions.length && !busy && !error && <p className="text-[12px] text-[var(--a-text-3)]">Three on-brand options. Click one to use it — then Save.</p>}
        </div>
      )}
    </div>
  );
};
