import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ActivityLogItem,
  GateStatus,
  GateTemplateKey,
  StudioClient,
  StudioGate,
  StudioMember,
  StudioPayment,
  StudioProject,
  StudioRoute,
  StudioSettings,
  StudioTask,
  TaskStatus,
} from "./types";
import {
  computeProjectForecast,
  createGatesFromTemplate,
  INITIAL_ACTIVITY,
  INITIAL_CLIENTS,
  INITIAL_GATES,
  INITIAL_MEMBERS,
  INITIAL_PAYMENTS,
  INITIAL_PROJECTS,
  INITIAL_SETTINGS,
  INITIAL_TASKS,
} from "./seedData";
import { ProjectCreateInput, TaskCreateInput } from "./schemas";
import { isUuid, newUuid } from "./uuid";
import {
  loadOrSeedStudioOSFromSupabase,
  resetStudioOSInSupabase,
  syncArchiveTasks,
  syncInsertActivity,
  syncInsertProjectWithGates,
  syncInsertTask,
  syncInsertTimeEntry,
  syncUpdateGate,
  syncUpdateProject,
  syncUpdateSettings,
  syncUpdateTask,
} from "./supabaseSync";

const STORAGE_KEY = "tcs_studio_os_phase1_v2";

interface PersistedState {
  settings: StudioSettings;
  members: StudioMember[];
  clients: StudioClient[];
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  payments: StudioPayment[];
  activity: ActivityLogItem[];
}

interface StudioToast {
  id: string;
  message: string;
  tone?: "success" | "info" | "warn";
}

interface StudioOSContextValue {
  settings: StudioSettings;
  members: StudioMember[];
  clients: StudioClient[];
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  payments: StudioPayment[];
  activity: ActivityLogItem[];

  // Navigation & UI
  route: StudioRoute;
  setRoute: (r: StudioRoute) => void;
  selectedProjectId: string | null;
  openProject: (projectId: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  supabaseSyncStatus: "local" | "synced" | "schema_pending";

  // Focus Timer
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
  addProject: (input: ProjectCreateInput) => StudioProject;
  updateProject: (projectId: string, patch: Partial<StudioProject>) => void;
  updateGate: (gateId: string, patch: Partial<StudioGate>) => void;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  resetDemoData: () => void;

  // Helpers
  getProjectForecast: (projectId: string) => ReturnType<typeof computeProjectForecast> | null;
  toasts: StudioToast[];
  pushToast: (message: string, tone?: "success" | "info" | "warn") => void;
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
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        parsed &&
        isUuid(parsed.settings?.id) &&
        Array.isArray(parsed.projects) &&
        parsed.projects.every((p) => isUuid(p.id)) &&
        Array.isArray(parsed.tasks)
      ) {
        return {
          ...parsed,
          members: Array.isArray(parsed.members) && parsed.members.length > 0 ? parsed.members : INITIAL_MEMBERS,
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<"local" | "synced" | "schema_pending">("local");
  const syncStatusRef = useRef(supabaseSyncStatus);
  syncStatusRef.current = supabaseSyncStatus;

  const [toasts, setToasts] = useState<StudioToast[]>([]);

  // Focus timer state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(() => {
    const firstNow = state.tasks.find((t) => t.is_in_now && t.status !== "done");
    return firstNow?.id || null;
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const pushToast = useCallback((message: string, tone: "success" | "info" | "warn" = "success") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const commitState = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Persist to localStorage as offline fallback
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // Initial load & seed-on-first-run from Supabase
  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await loadOrSeedStudioOSFromSupabase();
      if (!mounted) return;
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
      };
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
    })();
    return () => {
      mounted = false;
    };
  }, [commitState]);

  // Focus timer interval
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

  // Recompute project forecasts dynamically from gates + client latency + settings
  const forecastMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeProjectForecast>>();
    const now = new Date();
    for (const p of state.projects) {
      const client = state.clients.find((c) => c.id === p.client_id);
      map.set(p.id, computeProjectForecast(p, state.gates, client, state.settings, now));
    }
    return map;
  }, [state.projects, state.gates, state.clients, state.settings]);

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

  const getProjectForecast = useCallback(
    (projectId: string) => forecastMap.get(projectId) || null,
    [forecastMap]
  );

  const openProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setRoute("project_detail");
  }, []);

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
        assignee_member_id: cur.members[0]?.id || INITIAL_MEMBERS[0].id,
        checklist: [],
        source: "manual",
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
        pushToast(`Nice. ${remainingInNow} left in Now.`, "success");
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
      const newGates = createGatesFromTemplate(id, input.template as GateTemplateKey, 0);
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

      const nextStatus: GateStatus = patch.status || target.status;
      const updatedGate: StudioGate = {
        ...target,
        ...patch,
        approved_at:
          nextStatus === "approved" && !target.approved_at ? new Date().toISOString() : target.approved_at,
        sent_for_approval_at:
          nextStatus === "waiting_on_client" && !target.sent_for_approval_at
            ? new Date().toISOString()
            : target.sent_for_approval_at,
      };
      const actItem = buildActivityItem(
        "gate",
        gateId,
        `updated ${target.code} ${target.name} (${
          patch.status ? patch.status.replace(/_/g, " ") : `${patch.estimate_days ?? target.estimate_days}d`
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

  const resetDemoData = useCallback(() => {
    const fresh = getSeedState();
    commitState(fresh);
    setSelectedProjectId(fresh.projects[0]?.id || null);
    if (syncStatusRef.current === "synced") {
      resetStudioOSInSupabase().then((err) => handleSyncError(err, "reset seed data"));
    }
    pushToast("Restored Studio OS seed data", "info");
  }, [commitState, handleSyncError, pushToast]);

  const startTimerForTask = useCallback((taskId: string) => {
    setActiveTimerTaskId(taskId);
    setTimerRunning(true);
  }, []);

  const toggleTimer = useCallback(() => {
    setTimerRunning((r) => !r);
  }, []);

  const resetTimer = useCallback(() => {
    setTimerRunning(false);
    setTimerSeconds(0);
  }, []);

  const stopTimer = useCallback(() => {
    if (activeTimerTaskId && timerSeconds > 0) {
      const addedHours = Math.round((timerSeconds / 3600) * 100) / 100;
      const t = stateRef.current.tasks.find((x) => x.id === activeTimerTaskId);
      if (t) {
        updateTask(activeTimerTaskId, { actual_hours: Math.round((t.actual_hours + addedHours) * 100) / 100 });
        if (syncStatusRef.current === "synced") {
          syncInsertTimeEntry(activeTimerTaskId, stateRef.current.members[0]?.id, timerSeconds).catch(() => {});
        }
        pushToast(`Logged ${Math.max(1, Math.round(timerSeconds / 60))}m to ${t.key}`, "info");
      }
    }
    setTimerRunning(false);
    setTimerSeconds(0);
  }, [activeTimerTaskId, timerSeconds, updateTask, pushToast]);

  const value: StudioOSContextValue = {
    settings: state.settings,
    members: state.members,
    clients: state.clients,
    projects: projectsWithForecast,
    gates: state.gates,
    tasks: state.tasks,
    payments: state.payments,
    activity: state.activity,
    route,
    setRoute,
    selectedProjectId,
    openProject,
    darkMode,
    toggleDarkMode,
    searchQuery,
    setSearchQuery,
    quickAddOpen,
    setQuickAddOpen,
    newProjectOpen,
    setNewProjectOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
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
    addProject,
    updateProject,
    updateGate,
    updateSettings,
    resetDemoData,
    getProjectForecast,
    toasts,
    pushToast,
  };

  return <StudioOSContext.Provider value={value}>{children}</StudioOSContext.Provider>;
};

export function useStudioOS() {
  const ctx = useContext(StudioOSContext);
  if (!ctx) throw new Error("useStudioOS must be used inside StudioOSProvider");
  return ctx;
}
