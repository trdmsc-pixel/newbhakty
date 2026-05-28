import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

// Helper to safely read server environment variables with error catching and validation
const getEnvVariable = (key: string): string => {
  try {
    if (typeof process === "undefined" || !process.env) {
      console.warn(`process.env is undefined. Cannot read key: ${key}`);
      return "";
    }
    const val = process.env[key];
    if (val === undefined || val === null) {
      return "";
    }
    if (typeof val !== "string") {
      console.warn(`Environment variable ${key} is malformed: expected string, got ${typeof val}`);
      return "";
    }
    let result = val.trim();
    if (result.startsWith("http://") || result.startsWith("https://")) {
      result = result.replace(/\/+$/, "");
    }
    return result;
  } catch (err) {
    console.error(`Unhandled error while accessing environment variable ${key}:`, err);
    return "";
  }
};

const app = express();
app.use(express.json());



  // ----------------------------------------------------
  // API ROUTE: ANALYTICS LOGGER (UNSUSPICIOUS PATHS FOR ADBLOCK BYPASS)
  // ----------------------------------------------------
  const serverAnalyticsLogs: any[] = [];
  const mockOperationsProgress = new Map<string, number>();

  const logTelemetryEvent = (req: any, res: any) => {
    try {
      const { id, eventType, actionName, metadata, timestamp, source_page } = req.body;
      const event = {
        id: id || `evt-srv-${Date.now()}`,
        eventType: eventType || "click",
        actionName: actionName || "unknown",
        metadata: metadata || {},
        source_page: source_page || "ai_production",
        timestamp: timestamp || new Date().toISOString()
      };
      serverAnalyticsLogs.unshift(event);
      if (serverAnalyticsLogs.length > 1000) {
        serverAnalyticsLogs.pop();
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  const getTelemetryBoard = (req: any, res: any) => {
    try {
      res.json({ logs: serverAnalyticsLogs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.post("/api/session-telemetry", logTelemetryEvent);
  app.get("/api/telemetry-board", getTelemetryBoard);

  // Legacy aliases
  app.post("/api/analytics/log", logTelemetryEvent);
  app.get("/api/analytics/board", getTelemetryBoard);

  // ----------------------------------------------------
  // API ROUTE: VISITOR GEOLOCATION (EDGE SYNC)
  // ----------------------------------------------------
  const getGeoLocation = (req: any, res: any) => {
    try {
      const rawCity = req.headers["x-vercel-ip-city"] as string;
      const rawRegion = req.headers["x-vercel-ip-country-region"] as string;
      const rawCountry = req.headers["x-vercel-ip-country"] as string;

      const decodeHeader = (val: string | undefined, fallback: string): string => {
        if (!val) return fallback;
        try {
          return decodeURIComponent(val);
        } catch (e) {
          return val;
        }
      };

      res.json({
        city: decodeHeader(rawCity, "Unknown City"),
        region: decodeHeader(rawRegion, "Unknown Region"),
        country: decodeHeader(rawCountry, "Unknown Country")
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to determine geolocation parameters" });
    }
  };

  app.get("/api/edge-sync", getGeoLocation);
  app.get("/api/locate", getGeoLocation); // Legacy alias

  // ----------------------------------------------------
  // API ROUTE: AI VIDEO GENERATION
  // ----------------------------------------------------
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const mockOpName = `models/veo-3.1-lite-generate-preview/operations/mock-${Date.now()}`;
      mockOperationsProgress.set(mockOpName, 0);
      return res.json({ operationName: mockOpName, taskId: mockOpName });
    } catch (err: any) {
      console.error("AI Video Generation Error:", err);
      res.status(500).json({ error: err.message || "Failed to start AI Video generation." });
    }
  });

  app.all("/api/video-status", async (req, res) => {
    try {
      const operationName = (req.body?.operationName || req.query?.operationName || req.query?.taskId || req.body?.taskId) as string;
      if (!operationName) {
        return res.status(400).json({ error: "operationName or taskId is required in queries." });
      }

      const currentProg = mockOperationsProgress.get(operationName) || 0;
      if (currentProg >= 3) {
        return res.json({ 
          done: true, 
          status: "completed", 
          videoUrl: `/api/video-get?operationName=${encodeURIComponent(operationName)}`,
          tags: ["Fluid Simulation", "Quantum Particle", "Veo AI"]
        });
      } else {
        mockOperationsProgress.set(operationName, currentProg + 1);
        return res.json({ done: false, status: "processing" });
      }
    } catch (err: any) {
      console.error("AI Video Status Error:", err);
      res.status(500).json({ error: err.message || "Failed to retrieve operation status." });
    }
  });

  app.get("/api/video-get", async (req, res) => {
    try {
      const operationName = req.query.operationName as string;
      if (!operationName) {
        return res.status(400).send("Operation name is required.");
      }

      const stockAssets = [
        "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-wave-looping-glowing-underwater-science-background-48282-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-organic-liquid-gold-floating-fluid-bubbles-48283-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4"
      ];
      const idx = operationName.length % stockAssets.length;
      const fallbackUrl = stockAssets[idx];

      const videoRes = await fetch(fallbackUrl);
      const arrayBuffer = await videoRes.arrayBuffer();
      res.setHeader("Content-Type", "video/mp4");
      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("AI Video Download Proxy Error:", err);
      res.status(500).send(err.message || "Failed to proxy stream generated video.");
    }
  });


  // Serve static UI assets or run Vite middleware
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
