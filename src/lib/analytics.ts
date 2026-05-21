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
}

const STORAGE_KEY = "bhakty_analytics_logs";

export const trackEvent = async (
  eventType: AnalyticsEvent["eventType"],
  actionName: string,
  metadata?: Record<string, any>
) => {
  const event: AnalyticsEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    actionName,
    metadata,
    timestamp: new Date().toISOString(),
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

  try {
    // 2. Transmit to server API
    await fetch("/api/analytics/log", {
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
