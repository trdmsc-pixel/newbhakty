import React, { useState, useEffect } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  RefreshCw, 
  Trash2, 
  Eye, 
  Play, 
  MousePointerClick, 
  Hourglass, 
  HelpCircle,
  Download,
  Activity,
  Layers,
  MapPin,
  Globe,
  Laptop,
  Tablet,
  Smartphone
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

interface AnalyticsEvent {
  id: string;
  eventType: "click" | "video_play" | "scroll" | "form_field";
  actionName: string;
  metadata?: any;
  timestamp: string;
  source_page?: "ai_production" | "live_action" | "mobile_app";
}

interface LocationLog {
  id: string;
  city: string;
  region: string;
  country: string;
  device_type: string;
  source_page?: "ai_production" | "live_action" | "mobile_app";
  created_at: string;
}

const mapEvent = (row: any): AnalyticsEvent => ({
  id: row.id,
  eventType: row.event_type || row.eventType || "click",
  actionName: row.action_name || row.actionName || "unknown",
  metadata: row.metadata,
  timestamp: row.timestamp || new Date().toISOString(),
  source_page: row.source_page
});

export default function AnalyticsDashboard() {
  const toast = useToast();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<LocationLog[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(true);
  const [dashboardFilter, setDashboardFilter] = useState<"ai_production" | "live_action" | "mobile_app">("ai_production");

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("analytics_events")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(300);

        if (error) {
          throw error;
        }
        setEvents((data || []).map(mapEvent));
      } else {
        const res = await fetch("/api/telemetry-board");
        if (res.ok) {
          const data = await res.json();
          setEvents((data.logs || []).map(mapEvent));
        } else {
          const cached = localStorage.getItem("bhakty_analytics_logs");
          if (cached) {
            setEvents((JSON.parse(cached) || []).map(mapEvent));
          }
        }
      }
    } catch (e) {
      console.warn("Supabase analytics fetch error, recovering local/server state:", e);
      try {
        const res = await fetch("/api/telemetry-board");
        if (res.ok) {
          const data = await res.json();
          setEvents((data.logs || []).map(mapEvent));
        } else {
          const cached = localStorage.getItem("bhakty_analytics_logs");
          if (cached) {
            setEvents((JSON.parse(cached) || []).map(mapEvent));
          }
        }
      } catch (err) {
        const cached = localStorage.getItem("bhakty_analytics_logs");
        if (cached) {
          setEvents((JSON.parse(cached) || []).map(mapEvent));
        }
      }
    } finally {
      setIsLoading(false);
    }

    // Fetch visitor locations from database
    setIsLocationsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("visitor_locations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        }
        setLocations(data || []);
      }
    } catch (err: any) {
      console.warn("Could not retrieve visitor locations from Supabase:", err);
    } finally {
      setIsLocationsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // 1. Same-window custom event listener
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (customEvent.detail) {
        const mapped = mapEvent(customEvent.detail);
        setEvents(prev => {
          if (prev.some(evt => evt.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      }
    };
    window.addEventListener("bhakty_new_analytics_event", handleLocalEvent);

    // 2. Supabase Realtime Broadcast subscription
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel("analytics-channel")
          .on("broadcast", { event: "new-interaction" }, (payload: any) => {
            if (payload && payload.payload) {
              const mapped = mapEvent(payload.payload);
              setEvents(prev => {
                if (prev.some(evt => evt.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("Supabase realtime analytics channel subscribe failed:", err);
      }
    }

    return () => {
      window.removeEventListener("bhakty_new_analytics_event", handleLocalEvent);
      if (channel) {
        try {
          supabase?.removeChannel(channel);
        } catch (err) {}
      }
    };
  }, []);

  const clearLogs = async () => {
    const confirmClear = window.confirm("Are you sure you want to permanently delete all analytics events and visitor location logs from the database, server, and local cache? This will free up storage on Supabase.");
    if (!confirmClear) return;

    setIsLoading(true);
    setIsLocationsLoading(true);

    try {
      // 1. Clear local storage
      localStorage.setItem("bhakty_analytics_logs", JSON.stringify([]));

      // 2. Clear server in-memory logs
      try {
        await fetch("/api/telemetry-board", { method: "DELETE" });
      } catch (err) {
        console.warn("Failed to clear server in-memory logs:", err);
      }

      // 3. Clear Supabase tables
      if (isSupabaseConfigured && supabase) {
        // Delete all rows in analytics_events
        const { error: errEvents } = await supabase
          .from("analytics_events")
          .delete()
          .gt("timestamp", "1970-01-01T00:00:00Z");
        
        if (errEvents) {
          console.error("Failed to delete events from Supabase:", errEvents);
        }

        // Delete all rows in visitor_locations
        const { error: errLocs } = await supabase
          .from("visitor_locations")
          .delete()
          .gt("created_at", "1970-01-01T00:00:00Z");

        if (errLocs) {
          console.error("Failed to delete locations from Supabase:", errLocs);
        }

        if (errEvents || errLocs) {
          toast.error("Some database tables could not be fully cleared. Check console.");
        } else {
          toast.success("All analytics and geolocation data cleared from database, server, and cache!");
        }
      } else {
        toast.success("Local cache and server analytics cleared!");
      }

      // 4. Update local states
      setEvents([]);
      setLocations([]);
    } catch (e: any) {
      toast.error(`Clear failed: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsLocationsLoading(false);
    }
  };

  const downloadAnalyticsTxt = () => {
    try {
      const summary = `==================================================
BHAKTY STUDIO REAL-TIME ANALYTICS TELEMETRY LOG
Exported At: ${new Date().toLocaleString()}
==================================================

SUMMARY METRICS:
- Total Interactions: ${totalCount}
- Live Tracking Status: ${isSupabaseConfigured ? "Connected (Supabase Realtime)" : "Local Tab Sync Loop"}
- Core CTA Clicks: ${ctaClicks}
- Video Modal Plays: ${videoInteractions}
- Estimated Hover Hours: ${hoverHours} hrs
- Model Overlays: ${modelOverlays}
- Booking Intake Trials: ${bookingSubmissions}

DETAILED EVENT LOGS:
--------------------------------------------------
${events.map((e, idx) => {
  const ts = new Date(e.timestamp).toISOString();
  const meta = e.metadata ? ` | Metadata: ${JSON.stringify(e.metadata)}` : "";
  return `[${ts}] [${e.eventType.toUpperCase()}] ${e.actionName}${meta}`;
}).join("\n")}
==================================================
`;
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bhakty_analytics_export_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Analytics telemetry exported successfully.");
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    }
  };

  // Filter events based on active dashboard tab
  const filteredEvents = events.filter(e => {
    if (dashboardFilter === "ai_production") {
      return e.source_page === "ai_production" || !e.source_page;
    }
    return e.source_page === dashboardFilter;
  });

  // Compute breakdown stats
  const totalCount = filteredEvents.length;
  
  const ctaClicks = filteredEvents.filter(e => 
    e.eventType === "click" && 
    (e.actionName.toLowerCase().includes("cta") || 
     e.actionName.toLowerCase().includes("pricing") || 
     e.actionName.toLowerCase().includes("contact") ||
     e.actionName.toLowerCase().includes("proposal"))
  ).length;

  const videoInteractions = filteredEvents.filter(e => 
    e.eventType === "video_play" || 
    e.actionName.toLowerCase().includes("video") || 
    e.actionName.toLowerCase().includes("play")
  ).length;

  const bookingSubmissions = filteredEvents.filter(e => 
    e.eventType === "form_field" || 
    e.actionName.toLowerCase().includes("booking proposal") || 
    e.actionName.toLowerCase().includes("submitted") ||
    e.actionName.toLowerCase().includes("submit")
  ).length;

  const hoverEventsCount = filteredEvents.filter(e => e.actionName.toLowerCase().includes("hover")).length;
  const hoverHours = parseFloat(((hoverEventsCount * 12 + videoInteractions * 30) / 3600).toFixed(4));

  const modelOverlays = filteredEvents.filter(e => 
    e.actionName.toLowerCase().includes("overlay") || 
    e.actionName.toLowerCase().includes("modal") ||
    e.actionName.toLowerCase().includes("popup") ||
    e.actionName.toLowerCase().includes("window")
  ).length;

  // Filter locations based on active dashboard tab
  const filteredLocations = locations.filter(loc => {
    if (dashboardFilter === "ai_production") {
      return loc.source_page === "ai_production" || !loc.source_page;
    }
    return loc.source_page === dashboardFilter;
  });

  const totalLocationsCount = filteredLocations.length;
  const uniqueCities = new Set(filteredLocations.map(loc => loc.city).filter(Boolean)).size;
  const uniqueCountries = new Set(filteredLocations.map(loc => loc.country).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
        <div>
          <h2 className="font-display font-medium text-xl text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#E6C687]" /> Real-time Audience Analytics
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Analyze client visual interactions, CTA click rates, module scrolls, and mock metrics logs live.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAnalyticsTxt}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl text-xs text-accent hover:text-accent/90 transition-all cursor-pointer font-mono uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </button>

          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs text-red-300 hover:text-red-200 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Data
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2 bg-white/[0.02] border border-white/5 rounded-2xl p-1.5 w-fit select-none font-mono text-[10px] uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setDashboardFilter("ai_production")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            dashboardFilter === "ai_production"
              ? "bg-[#ffea00] text-black font-bold shadow-md shadow-[#ffea00]/10"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          AI Production (Desktop)
        </button>
        <button
          type="button"
          onClick={() => setDashboardFilter("live_action")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            dashboardFilter === "live_action"
              ? "bg-fuchsia-600 text-white font-bold shadow-md shadow-fuchsia-600/10"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Live Action (Desktop)
        </button>
        <button
          type="button"
          onClick={() => setDashboardFilter("mobile_app")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
            dashboardFilter === "mobile_app"
              ? "bg-violet-600 text-white font-bold shadow-md shadow-violet-600/10"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Mobile App Version
        </button>
      </div>

      {/* GRAPHIC OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        
        {/* CARD 1: TOTAL */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap block">Total Interactions</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{totalCount}</span>
          <p className="text-[8px] text-[#E6C687] font-mono mt-1">Live tracking active</p>
        </div>

        {/* CARD 2: LIVE STATUS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <Activity className={`absolute top-4 right-4 w-4 h-4 ${isSupabaseConfigured ? "text-emerald-400" : "text-amber-400"}`} />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Live Status</span>
          <span className="block mt-2 text-base font-mono font-semibold text-white truncate">
            {isSupabaseConfigured ? "Supabase Sync" : "Local Sync Only"}
          </span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">
            {isSupabaseConfigured ? "Realtime connected" : "Same-window loop fallback"}
          </p>
        </div>

        {/* CARD 3: CTA CLICKS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <MousePointerClick className="absolute top-4 right-4 w-4 h-4 text-purple-400" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Core CTA Clicks</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{ctaClicks}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Contact & Pricing CTAs</p>
        </div>

        {/* CARD 4: VIDEO PLAYS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <Play className="absolute top-4 right-4 w-4 h-4 text-amber-400" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Video Plays</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{videoInteractions}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Hovers & Play clicks</p>
        </div>

        {/* CARD 5: HOVER HOURS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <Hourglass className="absolute top-4 right-4 w-4 h-4 text-sky-400" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Hover Hours</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{hoverHours}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Estimated dwell duration</p>
        </div>

        {/* CARD 6: MODEL OVERLAYS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <Layers className="absolute top-4 right-4 w-4 h-4 text-indigo-400" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Model Overlays</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{modelOverlays}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Overlays & state popups</p>
        </div>

        {/* CARD 7: BOOKING TRIALS */}
        <div className="bg-[#11111c] border border-white/5 p-4 rounded-2xl relative">
          <Eye className="absolute top-4 right-4 w-4 h-4 text-rose-400" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Booking Trials</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{bookingSubmissions}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Form interactions recorded</p>
        </div>

      </div>

      {/* METEOR LIVE TERM STATS */}
      <h3 className="font-display font-medium text-sm text-white pt-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#E6C687]" /> Real-time Interaction Event Logs
      </h3>

      {isLoading ? (
        <div className="py-12 bg-black/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
          <Hourglass className="w-8 h-8 text-gray-600 animate-spin" />
          <span className="text-xs text-gray-500 font-mono">Digesting interaction matrices...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-black/20 border border-white/5 rounded-2xl p-8">
          <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No analytical traces captured yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Scroll, select visual video filters, or click action triggers on the landing site to populate the terminal automatically.
          </p>
        </div>
      ) : (
        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 overflow-hidden">
          <div className="h-[280px] overflow-y-auto space-y-2.5 pr-2 custom-scrollbar font-mono text-[10.5px]">
            {filteredEvents.slice(0).map((event, idx) => {
              const dateText = new Date(event.timestamp).toLocaleTimeString();
              const catColors: Record<string, string> = {
                click: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                video_play: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                scroll: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                form_field: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              };

              return (
                <div 
                  key={event.id || idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[#0a0a0f]/80 border border-white/[0.03] rounded-xl hover:border-white/10 transition-all animate-fadeIn"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{dateText}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase border font-semibold ${catColors[event.eventType] || "text-gray-400 bg-gray-500/10"}`}>
                      {event.eventType}
                    </span>
                    <span className="text-gray-200 font-medium font-sans">{event.actionName}</span>
                  </div>
                  
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <span className="text-[9px] text-gray-500 bg-white/[0.01] px-2 py-0.5 rounded border border-white/[0.03] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {JSON.stringify(event.metadata)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GEOLOCATION AUDIENCE MAP */}
      <h3 className="font-display font-medium text-sm text-white pt-6 flex items-center gap-2 border-t border-white/5 mt-6">
        <Globe className="w-4 h-4 text-[#E6C687]" /> Vercel Edge-IP Audience Geolocation Logs
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* STATS */}
        <div className="bg-[#11111c]/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Total Geotargets</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{totalLocationsCount}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Unique Vercel routing sessions</p>
        </div>
        <div className="bg-[#11111c]/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Unique Cities</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{uniqueCities}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Granular edge IP headers</p>
        </div>
        <div className="bg-[#11111c]/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">Unique Countries</span>
          <span className="block mt-2 text-2xl font-display font-semibold text-white">{uniqueCountries}</span>
          <p className="text-[8px] text-gray-500 font-mono mt-1">Global market outreach</p>
        </div>
      </div>

      {isLocationsLoading ? (
        <div className="py-12 bg-black/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
          <Hourglass className="w-8 h-8 text-gray-600 animate-spin" />
          <span className="text-xs text-gray-500 font-mono">Loading audience locations...</span>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="text-center py-12 bg-black/20 border border-white/5 rounded-2xl p-8">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No geolocation data recorded yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Visiting from a deployed Vercel URL will automatically trigger edge tracking headers.
          </p>
        </div>
      ) : (
        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 overflow-hidden">
          <div className="h-[285px] overflow-y-auto space-y-2.5 pr-2 custom-scrollbar font-mono text-[10.5px]">
            {filteredLocations.map((loc, idx) => {
              const dateText = new Date(loc.created_at).toLocaleString();
              
              const getDeviceIcon = (type: string) => {
                switch (type?.toLowerCase()) {
                  case "mobile":
                    return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
                  case "tablet":
                    return <Tablet className="w-3.5 h-3.5 text-blue-400" />;
                  default:
                    return <Laptop className="w-3.5 h-3.5 text-[#E6C687]" />;
                }
              };

              return (
                <div 
                  key={loc.id || idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[#0a0a0f]/80 border border-white/[0.03] rounded-xl hover:border-white/10 transition-all animate-fadeIn"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-gray-200 font-sans font-medium text-xs">
                      {loc.city}, {loc.region && loc.region !== loc.city ? `${loc.region}, ` : ""}{loc.country}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3.5">
                    <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1">
                      {getDeviceIcon(loc.device_type)}
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">
                        {loc.device_type || "desktop"}
                      </span>
                    </div>
                    <span className="text-gray-500 text-[9px]">{dateText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
