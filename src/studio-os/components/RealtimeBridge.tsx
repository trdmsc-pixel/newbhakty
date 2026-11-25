import { useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";

/**
 * Live link between the client portal and Studio OS: any change to
 * studio_gates (approvals, change requests) or a new studio_notification
 * reloads cloud state within a second or two and shows a calm toast.
 */
export function RealtimeBridge() {
  const { supabaseSyncStatus, reloadFromCloud, pushToast } = useStudioOS();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (supabaseSyncStatus !== "synced" || !supabase) return;
    const scheduleReload = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => reloadFromCloud(), 600);
    };
    const channel = supabase
      .channel("studio-os-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_gates" }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "studio_notifications" }, (payload: any) => {
        const n = payload?.new;
        if (n?.kind?.startsWith("portal_")) {
          pushToast(n.title || "Client update from the portal", n.kind === "portal_approval" ? "success" : "warn");
          scheduleReload();
        }
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase?.removeChannel(channel);
    };
  }, [supabaseSyncStatus, reloadFromCloud, pushToast]);

  return null;
}
