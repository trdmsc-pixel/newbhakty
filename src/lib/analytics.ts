import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Bhakty Analytics Tracking Utility
 * Stores logged events in both localStorage and syncs with the server API
 */

export interface AnalyticsEvent {
  id: string;
  eventType: "click" | "scroll" | "video_play" | "form_field";
  actionName: string;
  metadata?: Record<string, any>;
  timestamp: string;
  source_page?: "ai_production" | "live_action" | "mobile_app";
}

const STORAGE_KEY = "bhakty_analytics_logs";

export const trackEvent = async (
  eventType: AnalyticsEvent["eventType"],
  actionName: string,
  metadata?: Record<string, any>,
  sourcePage?: AnalyticsEvent["source_page"]
) => {
  let resolvedSource = sourcePage;
  if (!resolvedSource) {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const isMobile = window.innerWidth < 1024;
      
      if (path === "/mobile-app" || hash === "#mobile-app" || (isMobile && path !== "/admin")) {
        resolvedSource = "mobile_app";
      } else {
        const win = window as any;
        resolvedSource = win._activePipeline === "live_action" ? "live_action" : "ai_production";
      }
    } else {
      resolvedSource = "ai_production";
    }
  }

  const event: AnalyticsEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    actionName,
    metadata,
    timestamp: new Date().toISOString(),
    source_page: resolvedSource
  };

  try {
    // 1. Commit to client storage
    const cached = localStorage.getItem(STORAGE_KEY);
    const list: AnalyticsEvent[] = cached ? JSON.parse(cached) : [];
    list.unshift(event);
    // Keep last 150 events to prevent localstorage bloat
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 150)));
  } catch (err) {
    console.warn("Could not cache analytics event in localStorage:", err);
  }

  // Dispatch custom local event for instant same-window tab notifications
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bhakty_new_analytics_event", { detail: event }));
  }

  // Broadcast the tracked event to Supabase Realtime Channel
  if (isSupabaseConfigured && supabase) {
    try {
      const channel = supabase.channel("analytics-channel");
      channel.send({
        type: "broadcast",
        event: "new-interaction",
        payload: event
      });
    } catch (err) {
      console.warn("Supabase realtime broadcast failed:", err);
    }
  }

  // Write directly to Supabase analytics_events table for persistence across page refreshes
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from("analytics_events")
        .insert({
          id: event.id,
          event_type: event.eventType,
          action_name: event.actionName,
          metadata: event.metadata || {},
          source_page: resolvedSource,
          timestamp: event.timestamp
        });
      if (error) {
        console.warn("Failed to write event to Supabase table:", error);
      }
    } catch (err) {
      console.warn("Failed to write event to Supabase table (exception):", err);
    }
  }

  try {
    // 2. Transmit to server API (using non-adblock-blocked endpoint)
    await fetch("/api/session-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err) {
    // Silently proceed, client storage acts as backup
  }
};

// Initialize some initial natural flow events if storage is empty
export const initializeMockAnalytics = () => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached || JSON.parse(cached).length === 0) {
      const start = Date.now();
      const mockEvents: AnalyticsEvent[] = [
        {
          id: "evt-initial-1",
          eventType: "click",
          actionName: "🔐 Administrator Login",
          metadata: { route: "/admin" },
          timestamp: new Date(start - 45000000).toISOString(),
        },
        {
          id: "evt-initial-2",
          eventType: "scroll",
          actionName: "pricing-section viewed",
          metadata: { depth: "55%" },
          timestamp: new Date(start - 32000000).toISOString(),
        },
        {
          id: "evt-initial-3",
          eventType: "video_play",
          actionName: "Ethereal Alchemy",
          metadata: { quality: "High-Res 4K" },
          timestamp: new Date(start - 18000000).toISOString(),
        },
        {
          id: "evt-initial-4",
          eventType: "click",
          actionName: "hero-cta-work",
          metadata: { label: "Explore Curation" },
          timestamp: new Date(start - 5000000).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockEvents));
    }
  } catch {}
};

/**
 * Triggers Meta Ads Pixel tracking if initialized.
 */
export const trackMetaPixelEvent = (
  eventName: string,
  parameters?: Record<string, any>,
  advancedMatching?: Record<string, any>
) => {
  if (typeof window !== "undefined") {
    const fbq = (window as any).fbq;
    if (fbq) {
      try {
        if (advancedMatching && Object.keys(advancedMatching).length > 0) {
          const pixelId = (window as any)._metaPixelId || import.meta.env.VITE_META_PIXEL_ID;
          if (pixelId) {
            fbq('init', pixelId, advancedMatching);
          }
        }
        fbq('track', eventName, parameters);
        console.log(`[Meta Pixel] Tracked Event: ${eventName}`, parameters);
      } catch (err) {
        console.warn("Failed to dispatch Meta Ads Pixel event:", err);
      }
    }
  }
};

export const trackMetaPixelCustomEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (typeof window !== "undefined") {
    const fbq = (window as any).fbq;
    if (fbq) {
      try {
        fbq('trackCustom', eventName, parameters);
        console.log(`[Meta Pixel] Tracked Custom Event: ${eventName}`, parameters);
      } catch (err) {
        console.warn("Failed to dispatch Meta Ads Pixel custom event:", err);
      }
    }
  }
};

