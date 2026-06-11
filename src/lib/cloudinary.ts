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
          onProgress("Transporting file bytes to GitHub CDN repository...");
        }

        const base64Data = reader.result as string;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

        try {
          const res = await fetch("/api/media-upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileData: base64Data
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData?.error || "Server failed to upload media to GitHub CDN.");
          }

          const data = await res.json();
          
          if (onProgress) {
            onProgress("File uploaded successfully to CDN!");
          }

          resolve(data.url);
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === "AbortError") {
            throw new Error("Upload request timed out after 60 seconds.");
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
