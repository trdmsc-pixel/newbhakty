/**
 * GitHub Media Upload Uploader (Transparent Replacement for Cloudinary)
 * Reads media files on the client and uploads them to the GitHub media branch repository.
 */

// Keep isCloudinaryConfigured true so that AdminPanel enables uploading
export const isCloudinaryConfigured = true;
export const cloudinaryCloudName = "github-cdn";
export const cloudinaryUploadPreset = "github-cdn";

const compressImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Downscale if image is excessively large (e.g. > 2000px)
      const MAX_WIDTH = 2000;
      const MAX_HEIGHT = 2000;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // Fallback
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob.size < file.size ? blob : file);
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.82 // 82% quality compression (excellent balance of size vs quality)
      );
    };
    img.onerror = () => {
      resolve(file); // Fallback
    };
  });
};

const compressVideo = async (
  file: File,
  onProgress?: (progress: string) => void
): Promise<Blob | File> => {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    console.warn("MediaRecorder or Canvas captureStream not supported in this browser.");
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    
    // Safety timeout: 10 seconds to load video metadata
    const loadTimeout = setTimeout(() => {
      console.warn("Video metadata loading timed out. Using original file.");
      cleanup();
      resolve(file);
    }, 10000);

    let audioCtx: AudioContext | null = null;
    let animationFrameId: number;

    const cleanup = () => {
      clearTimeout(loadTimeout);
      cancelAnimationFrame(animationFrameId);
      if (video.src) {
        URL.revokeObjectURL(video.src);
      }
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close();
      }
    };

    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "-9999px";
    video.style.width = "100px";
    video.style.height = "100px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);

    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      clearTimeout(loadTimeout);
      
      const duration = video.duration;
      if (!duration || isNaN(duration)) {
        cleanup();
        resolve(file);
        return;
      }

      // Dynamic Bitrate computation to fit inside 24 MB target (safely under 25 MB limit)
      const targetSize = 24 * 1024 * 1024; // 24 MB
      let targetBitrate = Math.floor((targetSize * 8) / duration);
      targetBitrate = Math.max(800000, Math.min(6000000, targetBitrate)); // 800 kbps to 6 Mbps

      // Resolution optimization (max 1280px width or height)
      let width = video.videoWidth;
      let height = video.videoHeight;
      const MAX_RESOLUTION = 1280;
      if (width > MAX_RESOLUTION || height > MAX_RESOLUTION) {
        if (width > height) {
          height = Math.round((height * MAX_RESOLUTION) / width);
          width = MAX_RESOLUTION;
        } else {
          width = Math.round((width * MAX_RESOLUTION) / height);
          height = MAX_RESOLUTION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(file);
        return;
      }

      // Capture canvas stream at 30fps
      const videoStream = canvas.captureStream(30);

      // Extract and mix Audio using Web Audio API
      let audioStream: MediaStream | null = null;
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        
        // If suspended (common in browser auto-play policies), resume it
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        audioStream = dest.stream;
      } catch (e) {
        console.warn("AudioContext setup failed, compressing silent video", e);
      }

      // Mix tracks
      const tracks = [...videoStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const combinedStream = new MediaStream(tracks);

      // Detect supported container format
      let mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/mp4;codecs=h264";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ""; // Browser fallback
      }

      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType || undefined,
          videoBitsPerSecond: targetBitrate
        });
      } catch (e) {
        console.warn("MediaRecorder configuration failed, using default", e);
        try {
          recorder = new MediaRecorder(combinedStream);
        } catch (err) {
          cleanup();
          resolve(file);
          return;
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType || "video/webm" });
        cleanup();
        resolve(finalBlob.size < file.size ? finalBlob : file);
      };

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);

        if (onProgress) {
          const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
          onProgress(`Compressing video: ${pct}% (${Math.round(video.currentTime)}s / ${Math.round(duration)}s)...`);
        }

        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onplay = () => {
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        recorder.stop();
      };

      video.onerror = (err) => {
        console.error("Video processing playback error:", err);
        cleanup();
        resolve(file);
      };

      try {
        recorder.start();
        video.currentTime = 0;
        video.play().catch((err) => {
          console.warn("Unmuted autoplay blocked, retrying muted...", err);
          video.muted = true;
          video.play().catch((playErr) => {
            console.error("Playback failed entirely:", playErr);
            cleanup();
            resolve(file);
          });
        });
      } catch (err) {
        console.error("Recorder start error:", err);
        cleanup();
        resolve(file);
      }
    };

    video.onerror = (e) => {
      console.error("Failed to load video file source.", e);
      cleanup();
      resolve(file);
    };
  });
};

export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: string) => void
): Promise<string> => {
  let activeBlob: Blob | File = file;

  if (file.type.startsWith("image/")) {
    if (onProgress) {
      onProgress("Compressing and optimizing image quality...");
    }
    try {
      activeBlob = await compressImage(file);
    } catch (e) {
      console.warn("Image compression failed, using original file", e);
    }
  }

  if (file.type.startsWith("video/")) {
    if (file.size > 8 * 1024 * 1024) {
      if (onProgress) {
        onProgress("Optimizing video bitrate and resolution...");
      }
      try {
        activeBlob = await compressVideo(file, onProgress);
      } catch (e) {
        console.warn("Video compression failed, using original file", e);
      }
    }
  }

  // Enforce post-compression limit check (25 MB limit for GitHub Contents API)
  const limitBytes = 25 * 1024 * 1024;
  if (activeBlob.size > limitBytes) {
    throw new Error(`File is too large (${(activeBlob.size / 1024 / 1024).toFixed(1)} MB) even after compression. Maximum upload size allowed is 25 MB.`);
  }

  if (onProgress) {
    onProgress("Initiating upload stream...");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        if (onProgress) {
          onProgress("Retrieving authorization token...");
        }

        // 1. Fetch the GitHub Personal Access Token from backend using current admin passcode
        const password = sessionStorage.getItem("bhakty_admin_password") || "admin_bhakty_studio";
        const tokenRes = await fetch("/api/get-github-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        });

        if (!tokenRes.ok) {
          throw new Error("Unauthorized access: Verification failed.");
        }

        const { token } = await tokenRes.json();
        if (!token) {
          throw new Error("GITHUB_TOKEN is not configured on this server environment.");
        }

        if (onProgress) {
          onProgress("Transporting file bytes directly to GitHub CDN...");
        }

        const base64Data = reader.result as string;
        // Strip base64 prefix
        let base64Content = base64Data;
        if (base64Data.includes(";base64,")) {
          base64Content = base64Data.split(";base64,").pop() || base64Data;
        }

        let targetName = file.name;
        // Adjust image extensions if compressed to JPEG
        if (file.type.startsWith("image/") && activeBlob.type === "image/jpeg" && !targetName.toLowerCase().endsWith(".jpg") && !targetName.toLowerCase().endsWith(".jpeg")) {
          const parts = targetName.split(".");
          if (parts.length > 1) {
            parts[parts.length - 1] = "jpg";
            targetName = parts.join(".");
          } else {
            targetName += ".jpg";
          }
        }
        // Adjust video extensions if compressed to WebM
        if (file.type.startsWith("video/") && activeBlob.type.includes("webm") && !targetName.toLowerCase().endsWith(".webm")) {
          const parts = targetName.split(".");
          if (parts.length > 1) {
            parts[parts.length - 1] = "webm";
            targetName = parts.join(".");
          } else {
            targetName += ".webm";
          }
        }

        // 2. Perform direct upload from browser to GitHub API (Bypassing Vercel's 4.5MB payload limit!)
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const cleanName = targetName.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
        const finalFileName = `${uniqueId}_${cleanName}`;
        
        const owner = "trdmsc-pixel";
        const repo = "newbhakty";
        const branch = "media";

        const uploadUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${finalFileName}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout for large files

        try {
          const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github.v3+json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: `Upload media asset via portfolio admin panel: ${finalFileName}`,
              content: base64Content,
              branch: branch
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData?.message || "GitHub API direct media upload error.");
          }

          if (onProgress) {
            onProgress("File uploaded successfully to CDN!");
          }

          const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${finalFileName}`;
          resolve(cdnUrl);
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === "AbortError") {
            throw new Error("Upload request timed out after 90 seconds.");
          }
          throw fetchErr;
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        reject(err);
      }
    };

    reader.onerror = (err) => {
      console.error("File reading error:", err);
      reject(new Error("Failed to read local file contents."));
    };

    // Read the file as data URL (base64 string)
    reader.readAsDataURL(activeBlob);
  });
};

/**
 * Optimizes a video URL.
 * Simply returns the URL as is since jsDelivr serves the raw file.
 */
export const optimizeVideoUrl = (url: string): string => {
  return url || "";
};

/**
 * Optimizes an image URL.
 */
export const optimizeImageUrl = (url: string): string => {
  return url || "";
};

/**
 * Optimizes a hero background video URL.
 */
export const optimizeHeroVideoUrl = (url: string): string => {
  return url || "";
};
