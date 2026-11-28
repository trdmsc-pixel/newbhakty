/**
 * Shows "A new version of Studio OS is ready — Reload" when Vercel has deployed
 * a newer build than the one running in this tab (checked every 5 min and on focus).
 */
import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const entryOf = (html: string) => html.match(/\/assets\/index-[\w-]+\.js/)?.[0] || "";
const runningEntry = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>("script[type=module][src]"))
    .map((s) => new URL(s.src, location.href).pathname)
    .find((p) => /\/assets\/index-[\w-]+\.js$/.test(p)) || "";

export const UpdateBanner: React.FC = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const current = runningEntry();
    if (!current) return; // dev server
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const html = await (await fetch(`/index.html?v=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })).text();
        const latest = entryOf(html);
        if (latest && latest !== current) setReady(true);
      } catch {
        /* offline */
      }
    };
    // Check every minute, whenever the tab/app comes back to the front, and when the network returns.
    const t = window.setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    const first = window.setTimeout(check, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(t);
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, []);
  if (!ready) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 pl-4 pr-2 py-2 rounded-full shadow-xl text-[13px] font-medium" style={{ background: "#16181D", color: "#fff" }} role="status">
      A new version is ready — reload to get the latest
      <button type="button" onClick={() => location.reload()} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full font-semibold" style={{ background: "#5B3FE4" }}>
        <RefreshCw className="w-3.5 h-3.5" /> Reload
      </button>
    </div>
  );
};
