/**
 * Episode grid for multi-episode series (Studio OS + client portal).
 * Each tile = one episode, coloured by where it stands; click to focus that episode's milestones.
 */
import React from "react";

export interface EpGate {
  episode?: number | null;
  status: string;
  name: string;
}
export type EpState = "done" | "waiting" | "active" | "upcoming";

export function episodeStates(gates: EpGate[]) {
  const map = new Map<number, EpGate[]>();
  for (const g of gates) if (g.episode) (map.get(g.episode) || map.set(g.episode, []).get(g.episode)!).push(g);
  const eps = [...map.keys()].sort((a, b) => a - b);
  return eps.map((ep) => {
    const list = map.get(ep)!;
    const done = list.filter((g) => g.status === "approved" || g.status === "skipped").length;
    const state: EpState =
      done === list.length ? "done" : list.some((g) => g.status === "waiting_on_client") ? "waiting" : done > 0 || list.some((g) => ["in_work", "revising"].includes(g.status)) ? "active" : "upcoming";
    const current = list.find((g) => !["approved", "skipped"].includes(g.status));
    return { ep, state, done, total: list.length, current: current ? current.name.replace(/^Ep \d+ · /, "") : "Delivered" };
  });
}

/** The episode the team is on: first one that isn't done. */
export const currentEpisode = (gates: EpGate[]) => episodeStates(gates).find((e) => e.state !== "done")?.ep ?? episodeStates(gates).slice(-1)[0]?.ep ?? 1;

const TONE: Record<EpState, { bg: string; fg: string; ring?: string; label: string }> = {
  done: { bg: "linear-gradient(135deg, #34D399, #16A34A)", fg: "#fff", label: "Delivered" },
  waiting: { bg: "linear-gradient(135deg, #FBBF24, #F59E0B)", fg: "#fff", ring: "rgba(245,158,11,0.35)", label: "Awaiting review" },
  active: { bg: "linear-gradient(135deg, #8B6CFF, #5B3FE4)", fg: "#fff", ring: "rgba(91,63,228,0.3)", label: "In production" },
  upcoming: { bg: "var(--sos-surface-2)", fg: "var(--sos-text-3)", label: "Upcoming" },
};

export const EpisodeTracker: React.FC<{ gates: EpGate[]; selected: number; onSelect: (ep: number) => void; audience?: "studio" | "client"; multi?: number[] }> = ({ gates, selected, onSelect, audience = "studio", multi }) => {
  const eps = episodeStates(gates);
  if (!eps.length) return null;
  const doneN = eps.filter((e) => e.state === "done").length;
  const sel = eps.find((e) => e.ep === (multi?.[0] ?? selected)) || eps[0];
  const now = eps.find((e) => e.state === "active" || e.state === "waiting");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>Episodes</p>
          <p className="text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            {doneN} of {eps.length} delivered{now ? ` · ${audience === "client" ? "now working on" : "on"} Ep ${now.ep} (${now.current})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--sos-text-3)" }}>
          {(["done", "active", "waiting", "upcoming"] as EpState[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE[s].bg }} /> {TONE[s].label}
            </span>
          ))}
        </div>
      </div>
      <div className="sos-bar h-1.5">
        <span className={doneN === eps.length ? "done" : ""} style={{ width: `${Math.round((doneN / eps.length) * 100)}%` }} />
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }} role="tablist" aria-label="Episodes">
        {eps.map((e) => {
          const t = TONE[e.state];
          const on = multi ? multi.includes(e.ep) : e.ep === selected;
          return (
            <button
              key={e.ep}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(e.ep)}
              title={`Episode ${e.ep} · ${t.label} · ${e.current}`}
              className="relative h-11 rounded-[12px] text-[13px] font-bold sos-tabular transition-transform hover:-translate-y-0.5"
              style={{
                background: t.bg,
                color: t.fg,
                boxShadow: on ? `0 0 0 2px var(--sos-surface), 0 0 0 4px ${t.ring || "rgba(15,17,21,0.25)"}` : t.ring && e.state !== "done" ? `0 6px 14px -8px ${t.ring}` : undefined,
              }}
            >
              {e.ep}
              {e.state === "active" || e.state === "waiting" ? <span className="sos-live-dot absolute top-1 right-1" style={{ width: 5, height: 5, color: "#fff" }} /> : null}
            </button>
          );
        })}
      </div>
      <p className="text-[12px]" style={{ color: "var(--sos-text-2)" }}>
        <b>Episode {sel.ep}</b> · {TONE[sel.state].label} · {sel.done}/{sel.total} stages{sel.state !== "done" ? ` · current: ${sel.current}` : ""}
      </p>
    </div>
  );
};
