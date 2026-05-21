import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, RefreshCw, Trash2, Eye, Play, MousePointerClick, Hourglass, HelpCircle } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface AnalyticsEvent {
  id: string;
  category: "click" | "video_play" | "scroll";
  action: string;
  metadata?: any;
  timestamp: string;
}

export default function AnalyticsDashboard() {
  const toast = useToast();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analytics/board");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      } else {
        // Fallback to localStorage directly if server fails
        const cached = localStorage.getItem("bhakty_analytics_events");
        if (cached) {
          setEvents(JSON.parse(cached));
        }
      }
    } catch (e) {
      console.warn("Server analytics fetch error, recovering mock state:", e);
      const cached = localStorage.getItem("bhakty_analytics_events");
      if (cached) {
        setEvents(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const clearLogs = () => {
    try {
      localStorage.setItem("bhakty_analytics_events", JSON.stringify([]));
      setEvents([]);
      toast.success("Analytics telemetry logs cleared.");
    } catch (e) {
      console.error(e);
    }
  };

  // Compute breakdown stats
  const totalCount = events.length;
  const ctaClicks = events.filter(e => e.category === "click" && e.action.toLowerCase().includes("cta")).length;
  const bookingSubmissions = events.filter(e => e.action.toLowerCase().includes("booking proposal") || e.action.toLowerCase().includes("submitted")).length;
  const videoInteractions = events.filter(e => e.category === "video_play" || e.action.toLowerCase().includes("video") || e.action.toLowerCase().includes("play")).length;
  const scrollSights = events.filter(e => e.category === "scroll").length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: TOTAL */}
        <div className="bg-[#11111c] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest whitespace-nowrap block">Total Interactions</span>
          <span className="block mt-2 text-3xl font-display font-semibold text-white">{totalCount}</span>
          <p className="text-[9px] text-[#E6C687] font-mono mt-1">Live tracking active</p>
        </div>

        {/* CARD 2: CTA CLICKS */}
        <div className="bg-[#11111c] border border-white/5 p-5 rounded-2xl relative">
          <MousePointerClick className="absolute top-4 right-4 w-4 h-4 text-purple-400" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">Core CTA Clicks</span>
          <span className="block mt-2 text-3xl font-display font-semibold text-white">{ctaClicks}</span>
          <p className="text-[9px] text-gray-500 font-mono mt-1">Booking & Curation CTA</p>
        </div>

        {/* CARD 3: VIDEO INTERACTIONS */}
        <div className="bg-[#11111c] border border-white/5 p-5 rounded-2xl relative">
          <Play className="absolute top-4 right-4 w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">Video Modal & Play</span>
          <span className="block mt-2 text-3xl font-display font-semibold text-white">{videoInteractions}</span>
          <p className="text-[9px] text-gray-500 font-mono mt-1">Hovers & Modal overlays</p>
        </div>

        {/* CARD 4: ACTIONS AND SUBMISSIONS */}
        <div className="bg-[#11111c] border border-white/5 p-5 rounded-2xl relative">
          <Eye className="absolute top-4 right-4 w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">Booking Intake Trials</span>
          <span className="block mt-2 text-3xl font-display font-semibold text-white">{bookingSubmissions}</span>
          <p className="text-[9px] text-gray-500 font-mono mt-1">Form interactions recorded</p>
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
            {events.slice(0).reverse().map((event, idx) => {
              const dateText = new Date(event.timestamp).toLocaleTimeString();
              const catColors: Record<string, string> = {
                click: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                video_play: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                scroll: "text-blue-400 bg-blue-500/10 border-blue-500/20"
              };

              return (
                <div 
                  key={event.id || idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[#0a0a0f]/80 border border-white/[0.03] rounded-xl hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{dateText}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase border font-semibold ${catColors[event.category] || "text-gray-400 bg-gray-500/10"}`}>
                      {event.category}
                    </span>
                    <span className="text-gray-200 font-medium font-sans">{event.action}</span>
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
    </div>
  );
}
