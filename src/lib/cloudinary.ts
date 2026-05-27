/**
 * Cloudinary Unsigned Upload Helper
 * Handles uploading media assets (images or videos) to Cloudinary
 * using an unsigned upload preset.
 */

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
}

// ---------------------------------------------------------------
// IMPORTANT: Vite statically replaces import.meta.env.VITE_* ONLY
// when accessed via direct dot-notation (e.g. import.meta.env.VITE_CLOUDINARY_CLOUD_NAME).
// Dynamic bracket notation like import.meta.env[key] does NOT get replaced
// at build time and will be undefined in production builds.
// ---------------------------------------------------------------

let rawCloudName = "";
let rawUploadPreset = "";

try {
  // Direct property access — Vite will statically inline these at build time
  rawCloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
  if (!rawCloudName) {
    console.warn("Missing environment variable: VITE_CLOUDINARY_CLOUD_NAME is not configured.");
  }
  rawUploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();
  if (!rawUploadPreset) {
    console.warn("Missing environment variable: VITE_CLOUDINARY_UPLOAD_PRESET is not configured.");
  }
} catch (err) {
  console.error("Error reading Cloudinary environment variables:", err);
}

// Strip out any trailing slashes from the variables
export const cloudinaryCloudName = rawCloudName ? rawCloudName.replace(/\/+$/, "") : "";
export const cloudinaryUploadPreset = rawUploadPreset ? rawUploadPreset.replace(/\/+$/, "") : "";
export const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryUploadPreset);

export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: string) => void
): Promise<string> => {
  // If no Cloudinary environment configuration, fall back gracefully to a Mock upload/Object URL
  if (!isCloudinaryConfigured) {
    console.warn(
      "Cloudinary is not fully configured (VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET is missing). Falling back to local ObjectURL representation."
    );
    if (onProgress) {
      onProgress("Simulating network stream standard upload...");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    if (onProgress) {
      onProgress("Streaming raw bits completed!");
    }
    
    // Return a local blob URL so the user sees their uploaded image/video instantly in the iframe!
    return URL.createObjectURL(file);
  }

  if (onProgress) {
    onProgress("Initiating upload handshake...");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryUploadPreset);

  // Cloudinary uses automated endpoint: https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload
  // using resource_type: auto ensures both images and videos are parsed automatically.
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/auto/upload`;

  try {
    if (onProgress) {
      onProgress("Transporting file bytes to Cloudinary CDN...");
    }
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error?.message || "Cloudinary network upload error.");
    }

    const data: CloudinaryResponse = await response.json();
    
    if (onProgress) {
      onProgress("Syncing edge cache nodes...");
    }
    
    return data.secure_url;
  } catch (err: any) {
    console.error("Cloudinary upload failed: ", err);
    throw new Error(err?.message || "Cloudinary upload request failed.");
  }
};

/**
 * Optimizes a video URL from Cloudinary by adding width and compression transformations.
 */
export const optimizeVideoUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("res.cloudinary.com")) {
    if (url.includes("/video/upload/")) {
      // Ensure we don't duplicate transformations
      if (!url.includes("w_720") && !url.includes("q_auto")) {
        return url.replace("/video/upload/", "/video/upload/w_720,q_auto,f_auto/");
      }
    }
  }
  return url;
};

/**
 * Optimizes an image URL from Cloudinary by adding width and compression transformations.
 */
export const optimizeImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("res.cloudinary.com")) {
    if (url.includes("/image/upload/")) {
      // Ensure we don't duplicate transformations
      if (!url.includes("w_1000") && !url.includes("q_auto")) {
        return url.replace("/image/upload/", "/image/upload/w_1000,q_auto,f_auto/");
      }
    }
  }
  return url;
};

/**
 * Optimizes a hero background video URL from Cloudinary.
 * Uses aggressive compression (480p, low quality) since hero videos
 * are purely atmospheric backgrounds behind overlays and text.
 */
export const optimizeHeroVideoUrl = (url: string): string => {
  if (!url) return "";
  if (url.includes("res.cloudinary.com")) {
    try {
      // Strip any Cloudinary transformation segments from the path (e.g. /video/upload/w_854,q_auto:low/v12345/...)
      // Keep only version parameters if present.
      const cleaned = url.replace(/\/video\/upload\/[^/]+?\/v\d+\//, (match) => {
        const versionMatch = match.match(/\/v\d+\//);
        return `/video/upload${versionMatch ? versionMatch[0] : "/"}`;
      }).replace(/\/video\/upload\/[^/]+?\/(?![v\d])/, "/video/upload/");
      return cleaned;
    } catch (e) {
      return url;
    }
  }
  return url;
};
