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
}

export default function AnalyticsDashboard() {
  const toast = useToast();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analytics/board");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.logs || []);
      } else {
        // Fallback to localStorage directly if server fails
        const cached = localStorage.getItem("bhakty_analytics_logs");
        if (cached) {
          setEvents(JSON.parse(cached));
        }
      }
    } catch (e) {
      console.warn("Server analytics fetch error, recovering local state:", e);
      const cached = localStorage.getItem("bhakty_analytics_logs");
      if (cached) {
        setEvents(JSON.parse(cached));
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
      const customEvent = e as CustomEvent<AnalyticsEvent>;
      if (customEvent.detail) {
        setEvents(prev => {
          if (prev.some(evt => evt.id === customEvent.detail.id)) return prev;
          return [customEvent.detail, ...prev];
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
              const newEvent = payload.payload as AnalyticsEvent;
              setEvents(prev => {
                if (prev.some(evt => evt.id === newEvent.id)) return prev;
                return [newEvent, ...prev];
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

  const clearLogs = () => {
    try {
      localStorage.setItem("bhakty_analytics_logs", JSON.stringify([]));
      setEvents([]);
      toast.success("Analytics telemetry logs cleared.");
    } catch (e) {
      console.error(e);
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

  // Compute breakdown stats
  const totalCount = events.length;
  
  const ctaClicks = events.filter(e => 
    e.eventType === "click" && 
    (e.actionName.toLowerCase().includes("cta") || 
     e.actionName.toLowerCase().includes("pricing") || 
     e.actionName.toLowerCase().includes("contact") ||
     e.actionName.toLowerCase().includes("proposal"))
  ).length;

  const videoInteractions = events.filter(e => 
    e.eventType === "video_play" || 
    e.actionName.toLowerCase().includes("video") || 
    e.actionName.toLowerCase().includes("play")
  ).length;

  const bookingSubmissions = events.filter(e => 
    e.eventType === "form_field" || 
    e.actionName.toLowerCase().includes("booking proposal") || 
    e.actionName.toLowerCase().includes("submitted") ||
    e.actionName.toLowerCase().includes("submit")
  ).length;

  const hoverEventsCount = events.filter(e => e.actionName.toLowerCase().includes("hover")).length;
  const hoverHours = parseFloat(((hoverEventsCount * 12 + videoInteractions * 30) / 3600).toFixed(4));

  const modelOverlays = events.filter(e => 
    e.actionName.toLowerCase().includes("overlay") || 
    e.actionName.toLowerCase().includes("modal") ||
    e.actionName.toLowerCase().includes("popup") ||
    e.actionName.toLowerCase().includes("window")
  ).length;

  const totalLocationsCount = locations.length;
  const uniqueCities = new Set(locations.map(loc => loc.city).filter(Boolean)).size;
  const uniqueCountries = new Set(locations.map(loc => loc.country).filter(Boolean)).size;

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
      ) : events.length === 0 ? (
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
            {events.slice(0).map((event, idx) => {
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
      ) : locations.length === 0 ? (
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
            {locations.map((loc, idx) => {
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
