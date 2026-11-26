import React from "react";
import { useStudioOS } from "../StudioOSContext";
import { StudioRoute } from "../types";
import { ActivePill } from "../motion";

const VIEWS: Record<"tasks" | "projects", Array<{ route: StudioRoute; label: string }>> = {
  tasks: [
    { route: "table", label: "List" },
    { route: "board", label: "Board" },
  ],
  projects: [
    { route: "projects", label: "Cards" },
    { route: "pipeline", label: "Pipeline" },
    { route: "timeline", label: "Timeline" },
  ],
};

/** One switcher per area so tasks views and project views never mix. */
export const ViewSwitcher: React.FC<{ area: "tasks" | "projects" }> = ({ area }) => {
  const { route, setRoute } = useStudioOS();
  return (
    <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }} role="tablist" aria-label={area === "tasks" ? "Task views" : "Project views"}>
      {VIEWS[area].map((v) => {
        const active = route === v.route;
        return (
          <button
            key={v.route}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setRoute(v.route)}
            className="relative px-4 min-h-[36px] rounded-full text-[13px] font-semibold transition-colors duration-200"
            style={{ color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
          >
            {active && <ActivePill layoutId={`sos-view-${area}`} style={{ background: "var(--sos-ink)" }} />}
            <span className="relative z-[1]">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
};
