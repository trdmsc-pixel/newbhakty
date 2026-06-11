/**
 * GitHub Media Upload Uploader (Transparent Replacement for Cloudinary)
 * Reads media files on the client and uploads them to the GitHub media branch repository.
 */

// Keep isCloudinaryConfigured true so that AdminPanel enables uploading
export const isCloudinaryConfigured = true;
export const cloudinaryCloudName = "github-cdn";
export const cloudinaryUploadPreset = "github-cdn";

export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: string) => void
): Promise<string> => {
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

        // 2. Perform direct upload from browser to GitHub API (Bypassing Vercel's 4.5MB payload limit!)
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
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
    reader.readAsDataURL(file);
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
