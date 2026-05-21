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

// Helper to safely read environment variables with error catching
const getEnvVariable = (key: string): string => {
  try {
    if (typeof import.meta === "undefined" || !import.meta.env) {
      console.warn(`import.meta.env is undefined. Cannot read key: ${key}`);
      return "";
    }
    const val = import.meta.env[key];
    if (val === undefined || val === null) {
      return "";
    }
    if (typeof val !== "string") {
      console.warn(`Environment variable ${key} is malformed: expected string, got ${typeof val}`);
      return "";
    }
    return val.trim();
  } catch (err) {
    console.error(`Unhandled error while accessing environment variable ${key}:`, err);
    return "";
  }
};

let rawCloudName = "";
let rawUploadPreset = "";

try {
  rawCloudName = getEnvVariable("VITE_CLOUDINARY_CLOUD_NAME");
  if (!rawCloudName) {
    console.warn("Missing environment variable: VITE_CLOUDINARY_CLOUD_NAME is not configured.");
  }
  rawUploadPreset = getEnvVariable("VITE_CLOUDINARY_UPLOAD_PRESET");
  if (!rawUploadPreset) {
    console.warn("Missing environment variable: VITE_CLOUDINARY_UPLOAD_PRESET is not configured.");
  }
} catch (err) {
  console.error("Error verifying Cloudinary environment variables:", err);
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
