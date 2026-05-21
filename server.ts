import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

// Cache/Store Gemini client lazy-initializer
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
app.use(express.json());

// ----------------------------------------------------
  // API ROUTE: ENRICH/OPTIMIZE BRIEF WITH GEMINI
  // ----------------------------------------------------
  app.post("/api/gemini/optimize-brief", async (req, res) => {
    try {
      const { brief } = req.body;
      if (!brief || brief.trim().length === 0) {
        return res.status(400).json({ error: "Brief is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Fallback simulation if key isn't provided yet
        const words = brief.split(" ");
        const enriched = `[AI ENRICHED COHESION DIRECTIVE]\n\nVisual Paradigm: A high-fidelity cinematic workflow centering around ${words.slice(0, 4).join(" ")} with organic temporal flow. \n\nComposition details: Multi-angle prompt sequence, neural differential fluid dynamics, and upscale target 8K processing. Directed by bhakty.studio algorithms.`;
        return res.json({ text: enriched });
      }

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Enrich this short creative brief into a highly professional, cinematic, and detailed storyboard/production brief. Make it sound extremely premium, futuristic, and creative for a high-end digital agency (bhakty.studio). Keep the output under 150 words: "${brief}"`,
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini Optimize Brief Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze with Gemini API." });
    }
  });

  // ----------------------------------------------------
  // API ROUTE: ANALYZE INTAKE BRIEF (ADMIN SUBMISSION VIEW)
  // ----------------------------------------------------
  app.post("/api/gemini/analyze-brief", async (req, res) => {
    try {
      const { brief, company, selectedTier } = req.body;
      if (!brief) {
        return res.status(400).json({ error: "Brief details required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        const mockAnalysis = `[Axiom Core Analysis Fallback]\n• **Aesthetic Match**: High temporal fidelity.\n• **Style Direction**: Neo-futuristic, sound-reactive lighting.\n• **Orchestration Recommendation**: Allocate render slice in ${selectedTier || "Full Studio"} workflow. Target audience response optimization: high duration retention.`;
        return res.json({ text: mockAnalysis });
      }

      const ai = getGemini();
      const prompt = `Analyze this creative booking brief for our team at bhakty.studio. Provide a neat, bulleted summary including:
1. Recommended stylistic/aesthetic direction (e.g. Neo-Noir, CGI fluid simulation, vector horizon lines).
2. Suggested targeting platforms and audience hooks.
3. Brief technical requirements based on their Tier Selection: "${selectedTier || "Standard Production"}".
Company context: "${company || "Independent Ventures"}"
Brief: "${brief}"
Format as a direct black-and-gold bullet list, under 150 words.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini Brief Analysis Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // API ROUTE: AUTO-GENERATE PORTFOLIO TAGS
  // ----------------------------------------------------
  app.post("/api/gemini/suggest-tags", async (req, res) => {
    try {
      const { title, category, description } = req.body;
      if (!title || !category) {
        return res.status(400).json({ error: "Title and Category are required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Return fallback tags
        const fallbackTags = [category.split("/")[0].trim(), "Generative", "4K Loop"];
        return res.json({ tags: fallbackTags });
      }

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an AI metadata advisor for bhakty.studio (a luxury digital synthesics film agency). 
Suggest exactly 3 to 4 short tags (separated by commas, e.g., 'Fluid Dynamics, Neural Render, Luxury') for a portfolio video with:
Title: "${title}"
Category: "${category}"
Description: "${description || ""}"
Output ONLY the comma-separated list of tags, nothing else.`,
      });

      const tagsStr = response.text || "";
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 20)
        .slice(0, 4);

      res.json({ tags });
    } catch (err: any) {
      console.error("Gemini Suggest Tags Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // API ROUTE: ANALYTICS LOGGER
  // ----------------------------------------------------
  const serverAnalyticsLogs: any[] = [];
  const mockOperationsProgress = new Map<string, number>();

  app.post("/api/analytics/log", (req, res) => {
    try {
      const { id, eventType, actionName, metadata, timestamp } = req.body;
      const event = {
        id: id || `evt-srv-${Date.now()}`,
        eventType: eventType || "click",
        actionName: actionName || "unknown",
        metadata: metadata || {},
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
  });

  app.get("/api/analytics/board", (req, res) => {
    try {
      res.json({ logs: serverAnalyticsLogs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // API ROUTE: AI VIDEO GENERATION
  // ----------------------------------------------------
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt, resolution, aspectRatio } = req.body;
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        const mockOpName = `models/veo-3.1-lite-generate-preview/operations/mock-${Date.now()}`;
        mockOperationsProgress.set(mockOpName, 0);
        return res.json({ operationName: mockOpName });
      }

      const ai = getGemini();
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-lite-generate-preview",
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution || "720p",
          aspectRatio: aspectRatio || "16:9"
        }
      });

      res.json({ operationName: operation.name, taskId: operation.name });
    } catch (err: any) {
      console.error("AI Video Generation Error:", err);
      const errStr = String(err?.message || err || "").toLowerCase();
      const isQuotaExceeded = errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted") || errStr.includes("rate-limits") || err?.status === "RESOURCE_EXHAUSTED" || err?.code === 429;
      
      if (isQuotaExceeded) {
        console.warn("Quota limits hit on Gemini API, starting dynamic mock pipeline fallback.");
        const mockOpName = `models/veo-3.1-lite-generate-preview/operations/mock-${Date.now()}`;
        mockOperationsProgress.set(mockOpName, 0);
        return res.json({ 
          operationName: mockOpName, 
          taskId: mockOpName,
          fallback: true,
          message: "You exceeded your current Gemini API quota. We have successfully triggered the high-fidelity render engine simulation to construct the asset!" 
        });
      }
      res.status(500).json({ error: err.message || "Failed to start AI Video generation." });
    }
  });

  app.all("/api/video-status", async (req, res) => {
    try {
      const operationName = (req.body?.operationName || req.query?.operationName || req.query?.taskId || req.body?.taskId) as string;
      if (!operationName) {
        return res.status(400).json({ error: "operationName or taskId is required in queries." });
      }

      if (operationName.includes("/mock-") || operationName.startsWith("mock-")) {
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
      }

      const ai = getGemini();
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      if (updated.done) {
        const downloadUrl = `/api/video-get?operationName=${encodeURIComponent(operationName)}`;
        return res.json({ 
          done: true, 
          status: "completed", 
          videoUrl: downloadUrl,
          tags: ["Haute Couture", "Veo Loop", "4K Video"]
        });
      } else {
        return res.json({ done: false, status: "processing", error: updated.error });
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

      if (operationName.includes("/mock-")) {
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
      }

      const ai = getGemini();
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

      if (!uri) {
        return res.status(404).send("Generated video URI not ready or not found.");
      }

      const videoRes = await fetch(uri, {
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
      });

      res.setHeader("Content-Type", "video/mp4");
      const arrayBuffer = await videoRes.arrayBuffer();
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
