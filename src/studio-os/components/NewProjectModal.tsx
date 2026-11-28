import React, { useEffect, useMemo, useState } from "react";
import { SheetModal } from "../motion";
import { addDays, format } from "date-fns";
import { Calendar, Copy, Check, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { GATE_TEMPLATES } from "../seedData";
import { CurrencyCode, GateTemplateKey, ProjectType } from "../types";

export const NewProjectModal: React.FC = () => {
  const { newProjectOpen, setNewProjectOpen, clients, settings, addProject, openProject } = useStudioOS();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [emoji, setEmoji] = useState("🎬");
  const [clientId, setClientId] = useState(clients[0]?.id || "");

  useEffect(() => {
    if (!clients.some((c) => c.id === clientId) && clients[0]?.id) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);
  const [type, setType] = useState<ProjectType>("ad_film");
  const [template, setTemplate] = useState<GateTemplateKey>("film");
  const [episodes, setEpisodes] = useState(8);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [fee, setFee] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);

  const selectedClient = clients.find((c) => c.id === clientId);

  // "When can I deliver?" Quote helper (Section 5.1)
  const quoteForecast = useMemo(() => {
    const def = GATE_TEMPLATES[template];
    const deliveryGates = def.gates.filter((g) => !["G9", "G10"].includes(g.code));
    const rawWork = deliveryGates.reduce((s, g) => s + g.estimate_days, 0);
    const approvals = deliveryGates.filter((g) => g.needs_client_approval).length;
    const latency = selectedClient?.avg_approval_latency_days ?? settings.default_approval_latency_days;
    const totalDays = Math.ceil(rawWork * settings.overrun_factor + approvals * latency);
    const dt = addDays(new Date(), totalDays);
    const formatted = format(dt, "d MMM yyyy");
    return {
      dateLabel: formatted,
      iso: format(dt, "yyyy-MM-dd"),
      sentence: `We can deliver the final by ${format(dt, "d MMM")}, assuming feedback within ${latency} working days at each approval stage.`,
    };
  }, [template, selectedClient, settings]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;
    const created = addProject({
      code: code.trim().toUpperCase().slice(0, 5),
      title: title.trim(),
      client_id: clientId,
      type,
      status: "active",
      fee_amount: fee ? parseFloat(fee) : undefined,
      currency,
      versions: 1,
      hard_deadline: deadline || undefined,
      emoji: emoji || "🎬",
      is_confidential: isConfidential,
      priority: "p2",
      template,
      ...(template === "series_episode" ? { episodes: Math.max(1, Math.min(500, episodes || 1)) } : {}),
    });
    setNewProjectOpen(false);
    setTitle("");
    setCode("");
    setFee("");
    setDeadline("");
    openProject(created.id);
  };

  const handleCopyQuote = () => {
    navigator.clipboard?.writeText(quoteForecast.sentence);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  return (
    <SheetModal
      open={newProjectOpen}
      onClose={() => setNewProjectOpen(false)}
      label="New project"
      panelClassName="w-full md:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] p-5 md:p-6 shadow-2xl border"
      panelStyle={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
    >
        <div className="flex items-center justify-between mb-4">
          <h3 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            New Project
          </h3>
          <button
            type="button"
            onClick={() => setNewProjectOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-2">
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Icon
              </label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full h-11 text-center text-[18px] rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)" }}
              />
            </div>
            <div className="col-span-3">
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Code *
              </label>
              <input
                required
                maxLength={5}
                placeholder="ARC"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full h-11 px-3 text-[14px] font-semibold uppercase rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>
            <div className="col-span-7">
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Project Title *
              </label>
              <input
                required
                placeholder="e.g. Brand Launch Film"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 px-3.5 text-[14px] rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-11 px-3 text-[14px] rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Gate Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as GateTemplateKey)}
                className="w-full h-11 px-3 text-[14px] rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              >
                {(Object.keys(GATE_TEMPLATES) as GateTemplateKey[]).map((k) => (
                  <option key={k} value={k}>
                    {k === "series_episode" ? "Series (multiple episodes)" : GATE_TEMPLATES[k].label}
                  </option>
                ))}
              </select>
            </div>
            {template === "series_episode" && (
              <div className="col-span-full p-3.5 rounded-[16px] space-y-2" style={{ background: "var(--sos-violet-soft)" }}>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--sos-primary)" }}>Number of episodes</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={episodes}
                    onChange={(e) => setEpisodes(parseInt(e.target.value, 10) || 1)}
                    className="w-24 h-10 px-3 text-center text-[15px] font-semibold rounded-[12px] border sos-tabular"
                    style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                  />
                </label>
                <p className="text-[12px] leading-snug" style={{ color: "var(--sos-text-2)" }}>
                  Creates shared stages once (series bible, characters, locations), then <b>Script → Generation → Edit → First draft ◆ → Final</b> for each of the {episodes} episodes — {3 + episodes * 5} milestones, tracked per episode in Studio OS and the client portal.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ProjectType)}
                className="w-full h-11 px-3 text-[14px] rounded-[14px] border"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              >
                <option value="ad_film">Ad Film</option>
                <option value="trailer">Trailer</option>
                <option value="music_video">Music Video</option>
                <option value="series">Series</option>
                <option value="explainer">Explainer</option>
                <option value="reel">Reel</option>
                <option value="own_film">Own Film</option>
                <option value="internal">Internal</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Fee ({currency})
              </label>
              <div className="flex gap-1.5">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-20 h-11 px-2 text-[13px] rounded-[14px] border"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  placeholder="Optional"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="w-full h-11 px-3 text-[14px] rounded-[14px] border sos-tabular"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--sos-text-2)" }}>
                Hard Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-11 px-3 text-[14px] rounded-[14px] border sos-tabular"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>
          </div>

          {/* Quote Helper: "When can I deliver?" */}
          <div
            className="p-4 rounded-[18px] border space-y-2"
            style={{ background: "var(--sos-violet-soft)", borderColor: "transparent" }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
                <Calendar className="w-3.5 h-3.5" />
                When can I deliver? Forecast: {quoteForecast.dateLabel}
              </span>
              <button
                type="button"
                onClick={handleCopyQuote}
                className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }}
              >
                {copiedQuote ? <Check className="w-3 h-3 text-[#17663F]" /> : <Copy className="w-3 h-3" />}
                {copiedQuote ? "Copied" : "Copy quote line"}
              </button>
            </div>
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              &ldquo;{quoteForecast.sentence}&rdquo;
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--sos-text-2)" }}>
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="w-4 h-4 accent-[#5B3FE4]"
              />
              Confidential project (hide fee in briefs)
            </label>

            <button
              type="submit"
              className="sos-pill-btn px-6 h-11 text-[14px] font-semibold text-white"
              style={{ background: "var(--sos-primary)" }}
            >
              Create Project
            </button>
          </div>
        </form>
    </SheetModal>
  );
};
