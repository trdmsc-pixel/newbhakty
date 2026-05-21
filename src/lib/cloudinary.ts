// Cloudinary unsigned upload helper
// Uses VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET

const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset);

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
  width: number;
  height: number;
  bytes: number;
  originalFilename: string;
}

/**
 * Upload a file to Cloudinary using unsigned upload preset.
 * Works for both images and videos (uses "auto" resource type).
 */
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "bhakty-studio");

  // Use "auto" resource_type to handle images, videos, raw files
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Cloudinary upload failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  return {
    url: data.url,
    secureUrl: data.secure_url,
    publicId: data.public_id,
    format: data.format,
    resourceType: data.resource_type,
    width: data.width || 0,
    height: data.height || 0,
    bytes: data.bytes || 0,
    originalFilename: data.original_filename || file.name,
  };
}
