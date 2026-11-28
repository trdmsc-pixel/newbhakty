import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  ActivityLogItem,
  GateStatus,
  GateTemplateKey,
  HolidayRegion,
  StudioClient,
  StudioGate,
  StudioGenerationBlock,
  StudioHoliday,
  StudioMember,
  StudioPayment,
  StudioProject,
  StudioRoute,
  StudioSettings,
  StudioTask,
  StudioTimeEntry,
  TaskStatus,
} from "./types";
import {
  computeRealOverrunCalibration,
  computeProjectForecast,
  ProjectForecastResult,
} from "./forecastEngine";
import {
  createGatesFromTemplate,
  createGenerationBlocksForProject,
  INITIAL_ACTIVITY,
  INITIAL_CLIENTS,
  INITIAL_GATES,
  INITIAL_GENERATION_BLOCKS,
  INITIAL_HOLIDAYS,
  INITIAL_MEMBERS,
  INITIAL_PAYMENTS,
  INITIAL_PROJECTS,
  INITIAL_SETTINGS,
  INITIAL_TASKS,
  INITIAL_TIME_ENTRIES,
} from "./seedData";
import { ProjectCreateInput, TaskCreateInput } from "./schemas";
import { isUuid, newUuid } from "./uuid";
import {
  loadOrSeedStudioOSFromSupabase,
  resetStudioOSInSupabase,
  syncArchiveTasks,
  syncDeleteHoliday,
  syncInsertActivity,
  syncInsertGenerationBlocks,
  syncInsertProjectWithGates,
  syncInsertTask,
  syncInsertTimeEntryExact,
  syncUpdateGate,
  syncUpdateGenerationBlock,
  syncUpdateProject,
  syncUpdateSettings,
  syncUpdateTask,
  syncUpsertHoliday,
  type StudioViewer,
} from "./supabaseSync";

const STORAGE_KEY = "tcs_studio_os_phase2_v1";
const CLOSED_DATE_KEY = "tcs_studio_os_closed_date";

interface PersistedState {
  settings: StudioSettings;
  members: StudioMember[];
  clients: StudioClient[];
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  payments: StudioPayment[];
  activity: ActivityLogItem[];
  holidays: StudioHoliday[];
  generationBlocks: StudioGenerationBlock[];
  timeEntries: StudioTimeEntry[];
}

export interface ProjectFocus {
  /** files · changes · tasks · emails · production · assets · overview · milestones */
  tab?: string;
  /** e.g. "upload:<id>", "deliverable:<id>", "gate:<id>", "cr:<id>", "shot:<id>", "asset:<id>" */
  focus?: string;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface StudioToast {
  id: string;
  message: string;
  tone?: "success" | "info" | "warn";
  action?: ToastAction;
}

interface StudioOSContextValue {
  viewer: StudioViewer;
  isOwner: boolean;
  settings: StudioSettings;
  members: StudioMember[];
  clients: StudioClient[];
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  payments: StudioPayment[];
  activity: ActivityLogItem[];
  holidays: StudioHoliday[];
  generationBlocks: StudioGenerationBlock[];
  timeEntries: StudioTimeEntry[];

  // Calibration
  realOverrunCalibration: ReturnType<typeof computeRealOverrunCalibration>;
  applyCalibratedOverrunFactor: () => void;

  // Navigation & UI
  route: StudioRoute;
  setRoute: (r: StudioRoute) => void;
  selectedProjectId: string | null;
  openProject: (projectId: string, opts?: ProjectFocus) => void;
  /** Where to land inside a project (tab + element), set by deep links from Today / the bell. */
  projectFocus: (ProjectFocus & { n: number }) | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  quickAddPrefill: string;
  openQuickAdd: (prefill?: string) => void;
  whatsAppImportOpen: boolean;
  setWhatsAppImportOpen: (open: boolean) => void;
  reloadFromCloud: () => Promise<void>;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  eveningShutdownOpen: boolean;
  setEveningShutdownOpen: (open: boolean) => void;
  studioClosedForToday: boolean;
  completeEveningShutdown: (tomorrowTaskIds: string[]) => void;
  reopenStudio: () => void;
  supabaseSyncStatus: "local" | "synced" | "schema_pending";

  // Focus Timer (persists active & pause sessions to studio_time_entries)
  activeTimerTaskId: string | null;
  timerRunning: boolean;
  timerSeconds: number;
  startTimerForTask: (taskId: string) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  stopTimer: () => void;

  // Mutations
  addTask: (input: TaskCreateInput) => StudioTask;
  updateTask: (taskId: string, patch: Partial<StudioTask>) => void;
  deleteTasks: (taskIds: string[]) => void;
  toggleTaskDone: (taskId: string) => void;
  toggleTaskInNow: (taskId: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  moveTaskToNextWeek: (taskId: string) => void;
  addProject: (input: ProjectCreateInput) => StudioProject;
  updateProject: (projectId: string, patch: Partial<StudioProject>) => void;
  updateGate: (gateId: string, patch: Partial<StudioGate>) => void;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  initGenerationBlocks: (projectId: string) => void;
  addGenerationBlock: (projectId: string) => void;
  updateGenerationBlock: (blockId: string, patch: Partial<StudioGenerationBlock>) => void;
  addHoliday: (holiday: { holiday_date: string; name: string; region: HolidayRegion }) => void;
  deleteHoliday: (holidayId: string) => void;
  resetDemoData: () => void;

  // Helpers
  getProjectForecast: (projectId: string) => ProjectForecastResult | null;
  toasts: StudioToast[];
  pushToast: (message: string, tone?: "success" | "info" | "warn", action?: ToastAction) => void;
  dismissToast: (id: string) => void;
  /** Undo the most recent undoable action (also bound to ⌘/Ctrl+Z). */
  undoLast: () => void;
}

const StudioOSContext = createContext<StudioOSContextValue | null>(null);

function getSeedState(): PersistedState {
  return {
    settings: INITIAL_SETTINGS,
    members: INITIAL_MEMBERS,
    clients: INITIAL_CLIENTS,
    projects: INITIAL_PROJECTS,
    gates: INITIAL_GATES,
    tasks: INITIAL_TASKS,
    payments: INITIAL_PAYMENTS,
    activity: INITIAL_ACTIVITY,
    holidays: INITIAL_HOLIDAYS,
    generationBlocks: INITIAL_GENERATION_BLOCKS,
    timeEntries: INITIAL_TIME_ENTRIES,
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("tcs_studio_os_phase1_v2");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (
        parsed &&
        isUuid(parsed.settings?.id) &&
        Array.isArray(parsed.projects) &&
        parsed.projects.every((p) => isUuid(p.id)) &&
        Array.isArray(parsed.tasks)
      ) {
        return {
          settings: parsed.settings || INITIAL_SETTINGS,
          members: Array.isArray(parsed.members) && parsed.members.length > 0 ? parsed.members : INITIAL_MEMBERS,
          clients: Array.isArray(parsed.clients) ? parsed.clients : INITIAL_CLIENTS,
          projects: parsed.projects,
          gates: Array.isArray(parsed.gates) ? parsed.gates : INITIAL_GATES,
          tasks: parsed.tasks,
          payments: Array.isArray(parsed.payments) ? parsed.payments : INITIAL_PAYMENTS,
          activity: Array.isArray(parsed.activity) ? parsed.activity : INITIAL_ACTIVITY,
          holidays: Array.isArray(parsed.holidays) ? parsed.holidays : INITIAL_HOLIDAYS,
          generationBlocks: Array.isArray(parsed.generationBlocks)
            ? parsed.generationBlocks
            : INITIAL_GENERATION_BLOCKS,
          timeEntries: Array.isArray(parsed.timeEntries) ? parsed.timeEntries : INITIAL_TIME_ENTRIES,
        };
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  return getSeedState();
}

export const StudioOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const stateRef = useRef<PersistedState>(state);
  stateRef.current = state;

  const [route, setRoute] = useState<StudioRoute>("today");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => state.projects[0]?.id || INITIAL_PROJECTS[0]?.id || null
  );
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tcs_studio_os_dark") === "true";
    } catch {
      return false;
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAddOpen, setQuickAddOpenRaw] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState("");
  const [whatsAppImportOpen, setWhatsAppImportOpen] = useState(false);
  const setQuickAddOpen = useCallback((open: boolean) => {
    if (!open) setQuickAddPrefill("");
    setQuickAddOpenRaw(open);
  }, []);
  const openQuickAdd = useCallback((prefill?: string) => {
    setQuickAddPrefill(prefill || "");
    setQuickAddOpenRaw(true);
  }, []);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [eveningShutdownOpen, setEveningShutdownOpen] = useState(false);
  const [closedDate, setClosedDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLOSED_DATE_KEY);
    } catch {
      return null;
    }
  });
  const studioClosedForToday = closedDate === format(new Date(), "yyyy-MM-dd");

  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<"local" | "synced" | "schema_pending">("local");
  const [viewer, setViewer] = useState<StudioViewer>({ memberId: null, name: "", role: "owner", isOwner: true, email: "" });
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const syncStatusRef = useRef(supabaseSyncStatus);
  syncStatusRef.current = supabaseSyncStatus;

  const [toasts, setToasts] = useState<StudioToast[]>([]);

  // Focus timer state & active/pause segment tracker
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(() => {
    const firstNow = state.tasks.find((t) => t.is_in_now && t.status !== "done");
    return firstNow?.id || null;
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerSegmentRef = useRef<{
    kind: "active" | "pause";
    startedAtMs: number;
    taskId?: string;
  } | null>(null);

  const lastUndoRef = useRef<{ run: () => void; at: number } | null>(null);
  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const pushToast = useCallback((message: string, tone: "success" | "info" | "warn" = "success", action?: ToastAction) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const wrapped = action
      ? {
          label: action.label,
          onClick: () => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            action.onClick();
          },
        }
      : undefined;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone, action: wrapped }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 6500 : 3200);
  }, []);
  const undoLast = useCallback(() => {
    const last = lastUndoRef.current;
    // Keep undo scoped to recent actions so ⌘Z never reverts something long forgotten.
    if (!last || Date.now() - last.at > 5 * 60_000) return;
    lastUndoRef.current = null;
    last.run();
  }, []);

  const commitState = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Persist to localStorage as offline fallback (never cache money data for non-owners)
  useEffect(() => {
    try {
      const safe = viewerRef.current.isOwner
        ? state
        : { ...state, payments: [], projects: state.projects.map((p) => ({ ...p, fee_amount: undefined })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // Initial load & seed-on-first-run from Supabase (also used to refresh after server-side changes)
  const mountedRef = useRef(true);
  const reloadFromCloud = useCallback(async () => {
    {
      const result = await loadOrSeedStudioOSFromSupabase();
      if (!mountedRef.current) return;
      if (result.status !== "synced") {
        setSupabaseSyncStatus(result.status);
        syncStatusRef.current = result.status;
        return;
      }

      const next: PersistedState = {
        settings: result.data.settings,
        members: result.data.members,
        clients: result.data.clients,
        projects: result.data.projects,
        gates: result.data.gates,
        tasks: result.data.tasks,
        payments: result.data.payments,
        activity: result.data.activity,
        holidays: result.data.holidays,
        generationBlocks: result.data.generationBlocks,
        timeEntries: result.data.timeEntries,
      };
      if (result.data.viewer) setViewer(result.data.viewer);
      commitState(next);
      setSupabaseSyncStatus("synced");
      syncStatusRef.current = "synced";

      setSelectedProjectId((prev) =>
        prev && next.projects.some((p) => p.id === prev) ? prev : next.projects[0]?.id || null
      );

      setActiveTimerTaskId((prev) => {
        if (prev && next.tasks.some((t) => t.id === prev && t.status !== "done")) return prev;
        return next.tasks.find((t) => t.is_in_now && t.status !== "done")?.id || null;
      });
    }
  }, [commitState]);

  useEffect(() => {
    mountedRef.current = true;
    reloadFromCloud();
    return () => {
      mountedRef.current = false;
    };
  }, [reloadFromCloud]);

  // Focus timer tick
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tcs_studio_os_dark", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Recompute project forecasts dynamically from gates + client latency + settings + holidays
  const forecastMap = useMemo(() => {
    const map = new Map<string, ProjectForecastResult>();
    const now = new Date();
    for (const p of state.projects) {
      const client = state.clients.find((c) => c.id === p.client_id);
      map.set(p.id, computeProjectForecast(p, state.gates, client, state.settings, state.holidays, now, state.projects));
    }
    return map;
  }, [state.projects, state.gates, state.clients, state.settings, state.holidays]);

  // Persist the projected delivery date + health so the client portal shows the same timeline.
  const persistedForecast = useRef(new Map<string, string>());
  useEffect(() => {
    if (supabaseSyncStatus !== "synced" || !viewer.isOwner) return;
    const t = window.setTimeout(() => {
      for (const p of state.projects) {
        const f = forecastMap.get(p.id);
        if (!f) continue;
        const sig = `${f.forecast_date}|${f.health}`;
        if (`${p.forecast_date}|${p.health}` === sig || persistedForecast.current.get(p.id) === sig) continue;
        persistedForecast.current.set(p.id, sig);
        syncUpdateProject(p.id, { forecast_date: f.forecast_date, health: f.health }).catch(() => {});
      }
    }, 2500);
    return () => window.clearTimeout(t);
  }, [forecastMap, state.projects, supabaseSyncStatus, viewer.isOwner]);

  const projectsWithForecast = useMemo(() => {
    return state.projects.map((p) => {
      const f = forecastMap.get(p.id);
      if (!f) return p;
      return {
        ...p,
        forecast_date: f.forecast_date,
        health: f.health,
      };
    });
  }, [state.projects, forecastMap]);

  const realOverrunCalibration = useMemo(
    () => computeRealOverrunCalibration(state.gates),
    [state.gates]
  );

  const getProjectForecast = useCallback(
    (projectId: string) => forecastMap.get(projectId) || null,
    [forecastMap]
  );

  // Browser / phone back button moves between Studio OS screens.
  const fromPop = useRef(false);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { sosRoute?: StudioRoute; pid?: string | null } | null;
      if (!st?.sosRoute) return;
      fromPop.current = true;
      if (st.pid) setSelectedProjectId(st.pid);
      setRoute(st.sosRoute);
    };
    window.addEventListener("popstate", onPop);
    if (!window.history.state?.sosRoute) window.history.replaceState({ ...(window.history.state || {}), sosRoute: route, pid: selectedProjectId }, "");
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (fromPop.current) {
      fromPop.current = false;
      return;
    }
    const cur = window.history.state as { sosRoute?: StudioRoute; pid?: string | null } | null;
    if (cur?.sosRoute === route && (route !== "project_detail" || cur?.pid === selectedProjectId)) return;
    window.history.pushState({ sosRoute: route, pid: route === "project_detail" ? selectedProjectId : null }, "");
  }, [route, selectedProjectId]);

  const [projectFocus, setProjectFocus] = useState<(ProjectFocus & { n: number }) | null>(null);
  const openProject = useCallback((projectId: string, opts?: ProjectFocus) => {
    setSelectedProjectId(projectId);
    setRoute("project_detail");
    setProjectFocus(opts ? { ...opts, n: Date.now() } : null);
  }, []);
  // Deep links from notifications / emails: /studio-os?project=<id>&tab=<tab>&focus=<kind:id>
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const pid = q.get("project");
      if (pid && /^[0-9a-f-]{36}$/i.test(pid)) {
        openProject(pid, { tab: q.get("tab") || undefined, focus: q.get("focus") || undefined });
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  }, [openProject]);

  const buildActivityItem = (
    entity_type: ActivityLogItem["entity_type"],
    entity_id: string,
    action: string
  ): ActivityLogItem => ({
    id: newUuid(),
    actor: "member",
    actor_name: stateRef.current.members[0]?.name || "Shyam Sharma",
    entity_type,
    entity_id,
    action,
    at: new Date().toISOString(),
  });

  const handleSyncError = useCallback(
    (errMsg: string | null, contextLabel: string) => {
      if (!errMsg) return;
      console.warn(`Supabase sync (${contextLabel}):`, errMsg);
      pushToast(`Cloud sync failed (${contextLabel}) — kept locally`, "warn");
    },
    [pushToast]
  );

  const flushTimerSegment = useCallback(() => {
    const seg = timerSegmentRef.current;
    if (!seg) return;
    const nowMs = Date.now();
    timerSegmentRef.current = null;
    if (nowMs - seg.startedAtMs < 1000) return;

    const entry: StudioTimeEntry = {
      id: newUuid(),
      task_id: seg.taskId,
      member_id: stateRef.current.members[0]?.id,
      started_at: new Date(seg.startedAtMs).toISOString(),
      ended_at: new Date(nowMs).toISOString(),
      kind: seg.kind,
    };
    const cur = stateRef.current;
    commitState({
      ...cur,
      timeEntries: [entry, ...cur.timeEntries.slice(0, 199)],
    });
    if (syncStatusRef.current === "synced") {
      syncInsertTimeEntryExact(entry).then((err) => handleSyncError(err, "time entry"));
    }
  }, [commitState, handleSyncError]);

  const addTask = useCallback(
    (input: TaskCreateInput): StudioTask => {
      const cur = stateRef.current;
      const proj = cur.projects.find((p) => p.id === input.project_id) || cur.projects[0];
      const prefix = `${proj.code}-`;
      const maxNum = cur.tasks.reduce((max, t) => {
        if (!t.key.startsWith(prefix)) return max;
        const n = parseInt(t.key.slice(prefix.length), 10);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);

      const nowStr = new Date().toISOString();
      const currentNowCount = cur.tasks.filter((t) => t.is_in_now && t.status !== "done").length;
      const allowInNow = input.is_in_now && currentNowCount < cur.settings.wip_limit;

      const newTask: StudioTask = {
        id: newUuid(),
        key: `${proj.code}-${maxNum + 1}`,
        project_id: proj.id,
        gate_id: input.gate_id,
        title: input.title,
        description: input.description,
        type: input.type,
        status: input.status,
        priority: input.priority,
        do_date: input.do_date || input.due_date,
        due_date: input.due_date,
        estimate_hours: input.estimate_hours,
        actual_hours: 0,
        assignee_member_id:
          input.assignee_member_id || viewerRef.current.memberId || cur.members[0]?.id || INITIAL_MEMBERS[0].id,
        checklist: [],
        source: input.source || "manual",
        promised_to_name: input.promised_to_name,
        waiting_on_name: input.waiting_on_name,
        channel: input.channel || "internal",
        is_in_now: allowInNow,
        portal_visible: false,
        created_at: nowStr,
        updated_at: nowStr,
      };

      const actItem = buildActivityItem("task", newTask.id, `added ${newTask.key}: ${newTask.title}`);
      commitState({
        ...cur,
        tasks: [newTask, ...cur.tasks],
        activity: [actItem, ...cur.activity.slice(0, 79)],
      });

      if (syncStatusRef.current === "synced") {
        syncInsertTask(newTask).then((err) => handleSyncError(err, "add task"));
        syncInsertActivity(actItem).catch(() => {});
      }

      pushToast(`Added ${newTask.key} to ${proj.code}`, "success");
      return newTask;
    },
    [commitState, handleSyncError, pushToast]
  );

  const updateTask = useCallback(
    (taskId: string, patch: Partial<StudioTask>) => {
      const cur = stateRef.current;
      const target = cur.tasks.find((t) => t.id === taskId);
      if (!target) return;

      const nowStr = new Date().toISOString();
      const updated: StudioTask = {
        ...target,
        ...patch,
        updated_at: nowStr,
        completed_at:
          patch.status === "done"
            ? nowStr
            : patch.status
            ? undefined
            : target.completed_at,
      };

      const statusChanged = Boolean(patch.status && patch.status !== target.status);
      const actItem = statusChanged
        ? buildActivityItem("task", taskId, `moved ${target.key} to ${patch.status!.replace(/_/g, " ")}`)
        : null;

      commitState({
        ...cur,
        tasks: cur.tasks.map((t) => (t.id === taskId ? updated : t)),
        activity: actItem ? [actItem, ...cur.activity.slice(0, 79)] : cur.activity,
      });

      if (syncStatusRef.current === "synced") {
        syncUpdateTask(taskId, {
          ...patch,
          completed_at: updated.completed_at,
        }).then((err) => handleSyncError(err, "update task"));
        if (actItem) {
          syncInsertActivity(actItem).catch(() => {});
        }
      }
    },
    [commitState, handleSyncError]
  );

  const deleteTasks = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      const cur = stateRef.current;
      const idSet = new Set(taskIds);
      const actItem = buildActivityItem("task", taskIds[0] || "", `archived ${taskIds.length} task(s)`);

      commitState({
        ...cur,
        tasks: cur.tasks.filter((t) => !idSet.has(t.id)),
        activity: [actItem, ...cur.activity.slice(0, 79)],
      });

      if (syncStatusRef.current === "synced") {
        syncArchiveTasks(taskIds).then((err) => handleSyncError(err, "archive tasks"));
        syncInsertActivity(actItem).catch(() => {});
      }

      pushToast(`Removed ${taskIds.length} task${taskIds.length > 1 ? "s" : ""}`, "info");
    },
    [commitState, handleSyncError, pushToast]
  );

  const toggleTaskDone = useCallback(
    (taskId: string) => {
      const target = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!target) return;
      const willBeDone = target.status !== "done";
      const nextStatus: TaskStatus = willBeDone ? "done" : "todo";

      const remainingInNow = stateRef.current.tasks.filter(
        (t) => t.id !== taskId && t.is_in_now && t.status !== "done"
      ).length;

      updateTask(taskId, {
        status: nextStatus,
        is_in_now: willBeDone ? false : target.is_in_now,
      });

      if (willBeDone) {
        const prev = { status: target.status, is_in_now: target.is_in_now };
        const restore = () => {
          if (lastUndoRef.current?.run === restore) lastUndoRef.current = null;
          updateTask(taskId, prev);
          pushToast(`Restored ${target.key}`, "info");
        };
        lastUndoRef.current = { run: restore, at: Date.now() };
        pushToast(`Done · ${target.key}${target.is_in_now ? ` — ${remainingInNow} left in Now` : ""}`, "success", { label: "Undo", onClick: restore });
      }
    },
    [updateTask, pushToast]
  );

  const toggleTaskInNow = useCallback(
    (taskId: string) => {
      const cur = stateRef.current;
      const target = cur.tasks.find((t) => t.id === taskId);
      if (!target) return;
      if (!target.is_in_now) {
        const currentNow = cur.tasks.filter((t) => t.is_in_now && t.status !== "done").length;
        if (currentNow >= cur.settings.wip_limit) {
          pushToast(`WIP limit is ${cur.settings.wip_limit}. Finish or move one out of Now first.`, "warn");
          return;
        }
        updateTask(taskId, {
          is_in_now: true,
          status: target.status === "backlog" ? "in_progress" : target.status,
        });
        pushToast(`Pinned ${target.key} to Now`, "success");
      } else {
        updateTask(taskId, { is_in_now: false });
      }
    },
    [updateTask, pushToast]
  );

  const toggleChecklistItem = useCallback(
    (taskId: string, itemId: string) => {
      const target = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!target) return;
      const nextChecklist = target.checklist.map((c) =>
        c.id === itemId ? { ...c, done: !c.done } : c
      );
      updateTask(taskId, { checklist: nextChecklist });
    },
    [updateTask]
  );

  const moveTaskToNextWeek = useCallback(
    (taskId: string) => {
      const target = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!target) return;
      const baseDt = target.do_date
        ? parseISO(target.do_date)
        : target.due_date
        ? parseISO(target.due_date)
        : new Date();
      const nextIso = format(addDays(baseDt, 7), "yyyy-MM-dd");
      updateTask(taskId, {
        do_date: nextIso,
        due_date: nextIso,
        is_in_now: false,
      });
      pushToast(`Rescheduled ${target.key} to ${format(addDays(baseDt, 7), "d MMM")}`, "info");
    },
    [updateTask, pushToast]
  );

  const addProject = useCallback(
    (input: ProjectCreateInput): StudioProject => {
      const cur = stateRef.current;
      const id = newUuid();
      const baseCode = input.code.toUpperCase();
      let uniqueCode = baseCode;
      let suffix = 2;
      const existingCodes = new Set(cur.projects.map((p) => p.code.toUpperCase()));
      while (existingCodes.has(uniqueCode)) {
        uniqueCode = `${baseCode.slice(0, 4)}${suffix}`;
        suffix += 1;
      }

      const nowStr = new Date().toISOString();
      const newProject: StudioProject = {
        id,
        code: uniqueCode,
        title: input.title,
        client_id: input.client_id,
        type: input.type,
        status: input.status,
        fee_amount: input.fee_amount,
        currency: input.currency,
        runtime_seconds: input.runtime_seconds,
        versions: input.versions,
        aspect_ratios: ["16:9"],
        hard_deadline: input.hard_deadline || undefined,
        health: "on_track",
        emoji: input.emoji || "🎬",
        is_confidential: input.is_confidential,
        portal_visible: input.type !== "internal",
        priority: input.priority,
        owner_member_id: cur.members[0]?.id || INITIAL_MEMBERS[0].id,
        pinned: true,
        updated_at: nowStr,
      };
      const newGates = createGatesFromTemplate(id, input.template as GateTemplateKey, 0, input.template === "series_episode" ? input.episodes : undefined);
      if (input.template === "series_episode" && input.episodes) newProject.episode_count = input.episodes;
      const actItem = buildActivityItem("project", id, `created project ${newProject.code} — ${newProject.title}`);

      commitState({
        ...cur,
        projects: [newProject, ...cur.projects],
        gates: [...cur.gates, ...newGates],
        activity: [actItem, ...cur.activity.slice(0, 79)],
      });

      if (syncStatusRef.current === "synced") {
        syncInsertProjectWithGates(newProject, newGates).then((err) =>
          handleSyncError(err, "create project")
        );
        syncInsertActivity(actItem).catch(() => {});
      }

      pushToast(`Created ${newProject.code} with ${newGates.length} gates`, "success");
      return newProject;
    },
    [commitState, handleSyncError, pushToast]
  );

  const updateProject = useCallback(
    (projectId: string, patch: Partial<StudioProject>) => {
      const cur = stateRef.current;
      if (!cur.projects.some((p) => p.id === projectId)) return;
      commitState({
        ...cur,
        projects: cur.projects.map((p) =>
          p.id === projectId ? { ...p, ...patch, updated_at: new Date().toISOString() } : p
        ),
      });

      if (syncStatusRef.current === "synced") {
        syncUpdateProject(projectId, patch).then((err) => handleSyncError(err, "update project"));
      }
    },
    [commitState, handleSyncError]
  );

  const updateGate = useCallback(
    (gateId: string, patch: Partial<StudioGate>) => {
      const cur = stateRef.current;
      const target = cur.gates.find((g) => g.id === gateId);
      if (!target) return;

      const nowIso = new Date().toISOString();
      const nextStatus: GateStatus = patch.status || target.status;

      let computedActualDays =
        patch.actual_days !== undefined ? patch.actual_days : target.actual_days;
      if (nextStatus === "approved" && patch.actual_days === undefined && !target.actual_days) {
        if (target.started_at) {
          const elapsedDays = (Date.now() - Date.parse(target.started_at)) / 86400000;
          computedActualDays = Math.max(0.5, Math.round(elapsedDays * 2) / 2);
        } else {
          computedActualDays = target.estimate_days;
        }
      }

      const updatedGate: StudioGate = {
        ...target,
        ...patch,
        actual_days: computedActualDays,
        started_at:
          nextStatus === "in_work" && !target.started_at ? nowIso : target.started_at,
        approved_at:
          nextStatus === "approved" && !target.approved_at ? nowIso : target.approved_at,
        sent_for_approval_at:
          nextStatus === "waiting_on_client" && (!target.sent_for_approval_at || target.status !== "waiting_on_client")
            ? nowIso
            : target.sent_for_approval_at,
      };
      const actItem = buildActivityItem(
        "gate",
        gateId,
        `updated ${target.code} ${target.name} (${
          patch.status
            ? patch.status.replace(/_/g, " ")
            : patch.actual_days !== undefined
            ? `actual ${patch.actual_days}d`
            : `${patch.estimate_days ?? target.estimate_days}d`
        })`
      );

      commitState({
        ...cur,
        gates: cur.gates.map((g) => (g.id === gateId ? updatedGate : g)),
        activity: [actItem, ...cur.activity.slice(0, 79)],
      });

      if (syncStatusRef.current === "synced") {
        syncUpdateGate(updatedGate).then((err) => handleSyncError(err, "update gate"));
        syncInsertActivity(actItem).catch(() => {});
      }
    },
    [commitState, handleSyncError]
  );

  const updateSettings = useCallback(
    (patch: Partial<StudioSettings>) => {
      const cur = stateRef.current;
      const nextSettings: StudioSettings = { ...cur.settings, ...patch };
      const actItem = buildActivityItem("settings", nextSettings.id, "updated Studio OS settings");

      commitState({
        ...cur,
        settings: nextSettings,
        activity: [actItem, ...cur.activity.slice(0, 79)],
      });

      if (syncStatusRef.current === "synced") {
        syncUpdateSettings(nextSettings).then((err) => handleSyncError(err, "save settings"));
        syncInsertActivity(actItem).catch(() => {});
      }

      pushToast("Settings saved", "success");
    },
    [commitState, handleSyncError, pushToast]
  );

  const applyCalibratedOverrunFactor = useCallback(() => {
    const cal = computeRealOverrunCalibration(stateRef.current.gates);
    if (cal.gateCount === 0) {
      pushToast("Approve at least 1 gate first to calibrate.", "warn");
      return;
    }
    updateSettings({ overrun_factor: cal.ratio });
    pushToast(`Applied calibrated ${cal.ratio}× overrun factor`, "success");
  }, [updateSettings, pushToast]);

  const initGenerationBlocks = useCallback(
    (projectId: string) => {
      const cur = stateRef.current;
      const proj = cur.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const existing = cur.generationBlocks.filter((b) => b.project_id === projectId);
      if (existing.length > 0) return;

      const genGate = cur.gates.find((g) => g.project_id === projectId && g.code === "G4") ||
        cur.gates.find((g) => g.project_id === projectId);
      const newBlocks = createGenerationBlocksForProject(
        proj,
        genGate?.id,
        cur.settings.block_seconds || 20
      );

      commitState({
        ...cur,
        generationBlocks: [...cur.generationBlocks, ...newBlocks],
      });

      if (syncStatusRef.current === "synced") {
        syncInsertGenerationBlocks(newBlocks).then((err) => handleSyncError(err, "init blocks"));
      }
      pushToast(`Generated ${newBlocks.length} 20-sec blocks for ${proj.code}`, "success");
    },
    [commitState, handleSyncError, pushToast]
  );

  const addGenerationBlock = useCallback(
    (projectId: string) => {
      const cur = stateRef.current;
      const proj = cur.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const existing = cur.generationBlocks.filter((b) => b.project_id === projectId);
      const nextNum = existing.reduce((m, b) => Math.max(m, b.block_number), 0) + 1;
      const sec = cur.settings.block_seconds || 20;
      const genGate = cur.gates.find((g) => g.project_id === projectId && g.code === "G4");

      const block: StudioGenerationBlock = {
        id: newUuid(),
        project_id: projectId,
        gate_id: genGate?.id,
        block_number: nextNum,
        label: `Block ${nextNum} (${(nextNum - 1) * sec}–${nextNum * sec}s)`,
        prompt_ref: `${proj.code}-B${String(nextNum).padStart(2, "0")}`,
        takes: 0,
        status: "planned",
        seconds: sec,
        updated_at: new Date().toISOString(),
      };

      commitState({
        ...cur,
        generationBlocks: [...cur.generationBlocks, block],
      });
      if (syncStatusRef.current === "synced") {
        syncInsertGenerationBlocks([block]).then((err) => handleSyncError(err, "add block"));
      }
    },
    [commitState, handleSyncError]
  );

  const updateGenerationBlock = useCallback(
    (blockId: string, patch: Partial<StudioGenerationBlock>) => {
      const cur = stateRef.current;
      const target = cur.generationBlocks.find((b) => b.id === blockId);
      if (!target) return;
      const updated: StudioGenerationBlock = {
        ...target,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      commitState({
        ...cur,
        generationBlocks: cur.generationBlocks.map((b) => (b.id === blockId ? updated : b)),
      });
      if (syncStatusRef.current === "synced") {
        syncUpdateGenerationBlock(updated).then((err) => handleSyncError(err, "update block"));
      }
    },
    [commitState, handleSyncError]
  );

  const addHoliday = useCallback(
    (input: { holiday_date: string; name: string; region: HolidayRegion }) => {
      const cur = stateRef.current;
      const holiday: StudioHoliday = {
        id: newUuid(),
        holiday_date: input.holiday_date,
        name: input.name.trim(),
        region: input.region,
        is_active: true,
      };
      commitState({
        ...cur,
        holidays: [...cur.holidays, holiday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
      });
      if (syncStatusRef.current === "synced") {
        syncUpsertHoliday(holiday).then((err) => handleSyncError(err, "add holiday"));
      }
      pushToast(`Added holiday: ${holiday.name}`, "success");
    },
    [commitState, handleSyncError, pushToast]
  );

  const deleteHoliday = useCallback(
    (holidayId: string) => {
      const cur = stateRef.current;
      commitState({
        ...cur,
        holidays: cur.holidays.filter((h) => h.id !== holidayId),
      });
      if (syncStatusRef.current === "synced") {
        syncDeleteHoliday(holidayId).then((err) => handleSyncError(err, "remove holiday"));
      }
    },
    [commitState, handleSyncError]
  );

  const completeEveningShutdown = useCallback(
    (tomorrowTaskIds: string[]) => {
      const tomorrowIso = format(addDays(new Date(), 1), "yyyy-MM-dd");
      const pickSet = new Set(tomorrowTaskIds.slice(0, stateRef.current.settings.wip_limit || 3));

      // Clear old Now pins if finished or replaced, and pin tomorrow's chosen 3
      const cur = stateRef.current;
      for (const t of cur.tasks) {
        if (pickSet.has(t.id)) {
          updateTask(t.id, { is_in_now: true, do_date: tomorrowIso });
        } else if (t.is_in_now && pickSet.size > 0) {
          updateTask(t.id, { is_in_now: false });
        }
      }

      const todayIso = format(new Date(), "yyyy-MM-dd");
      try {
        localStorage.setItem(CLOSED_DATE_KEY, todayIso);
      } catch {
        // ignore
      }
      setClosedDate(todayIso);
      setEveningShutdownOpen(false);
      pushToast("Evening Shutdown complete — Studio Closed for tonight.", "info");
    },
    [updateTask, pushToast]
  );

  const reopenStudio = useCallback(() => {
    try {
      localStorage.removeItem(CLOSED_DATE_KEY);
    } catch {
      // ignore
    }
    setClosedDate(null);
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = getSeedState();
    commitState(fresh);
    setSelectedProjectId(fresh.projects[0]?.id || null);
    if (syncStatusRef.current === "synced") {
      resetStudioOSInSupabase().then((err) => handleSyncError(err, "reset seed data"));
    }
    pushToast("Restored Studio OS seed data", "info");
  }, [commitState, handleSyncError, pushToast]);

  const startTimerForTask = useCallback(
    (taskId: string) => {
      flushTimerSegment();
      setActiveTimerTaskId(taskId);
      setTimerRunning(true);
      timerSegmentRef.current = {
        kind: "active",
        startedAtMs: Date.now(),
        taskId,
      };
    },
    [flushTimerSegment]
  );

  const toggleTimer = useCallback(() => {
    setTimerRunning((wasRunning) => {
      flushTimerSegment();
      const nextRunning = !wasRunning;
      timerSegmentRef.current = {
        kind: nextRunning ? "active" : "pause",
        startedAtMs: Date.now(),
        taskId: activeTimerTaskId || undefined,
      };
      return nextRunning;
    });
  }, [activeTimerTaskId, flushTimerSegment]);

  const resetTimer = useCallback(() => {
    flushTimerSegment();
    setTimerRunning(false);
    setTimerSeconds(0);
  }, [flushTimerSegment]);

  const stopTimer = useCallback(() => {
    flushTimerSegment();
    if (activeTimerTaskId && timerSeconds > 0) {
      const addedHours = Math.round((timerSeconds / 3600) * 100) / 100;
      const t = stateRef.current.tasks.find((x) => x.id === activeTimerTaskId);
      if (t) {
        updateTask(activeTimerTaskId, { actual_hours: Math.round((t.actual_hours + addedHours) * 100) / 100 });
        pushToast(`Logged ${Math.max(1, Math.round(timerSeconds / 60))}m to ${t.key}`, "info");
      }
    }
    setTimerRunning(false);
    setTimerSeconds(0);
  }, [activeTimerTaskId, timerSeconds, updateTask, pushToast, flushTimerSegment]);

  const value: StudioOSContextValue = {
    viewer,
    isOwner: viewer.isOwner,
    settings: state.settings,
    members: state.members,
    clients: state.clients,
    projects: projectsWithForecast,
    gates: state.gates,
    tasks: state.tasks,
    payments: state.payments,
    activity: state.activity,
    holidays: state.holidays,
    generationBlocks: state.generationBlocks,
    timeEntries: state.timeEntries,
    realOverrunCalibration,
    applyCalibratedOverrunFactor,
    route,
    setRoute,
    selectedProjectId,
    openProject,
    projectFocus,
    darkMode,
    toggleDarkMode,
    searchQuery,
    setSearchQuery,
    quickAddOpen,
    setQuickAddOpen,
    quickAddPrefill,
    openQuickAdd,
    whatsAppImportOpen,
    setWhatsAppImportOpen,
    reloadFromCloud,
    newProjectOpen,
    setNewProjectOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    eveningShutdownOpen,
    setEveningShutdownOpen,
    studioClosedForToday,
    completeEveningShutdown,
    reopenStudio,
    supabaseSyncStatus,
    activeTimerTaskId,
    timerRunning,
    timerSeconds,
    startTimerForTask,
    toggleTimer,
    resetTimer,
    stopTimer,
    addTask,
    updateTask,
    deleteTasks,
    toggleTaskDone,
    toggleTaskInNow,
    toggleChecklistItem,
    moveTaskToNextWeek,
    addProject,
    updateProject,
    updateGate,
    updateSettings,
    initGenerationBlocks,
    addGenerationBlock,
    updateGenerationBlock,
    addHoliday,
    deleteHoliday,
    resetDemoData,
    getProjectForecast,
    toasts,
    dismissToast,
    undoLast,
    pushToast,
  };

  return <StudioOSContext.Provider value={value}>{children}</StudioOSContext.Provider>;
};

export function useStudioOS() {
  const ctx = useContext(StudioOSContext);
  if (!ctx) throw new Error("useStudioOS must be used inside StudioOSProvider");
  return ctx;
}
