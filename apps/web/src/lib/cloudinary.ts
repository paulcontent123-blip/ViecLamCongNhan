import crypto from "node:crypto";
import "server-only";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function getPublicIdFromCloudinaryUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== "res.cloudinary.com") return null;

    const marker = "/image/upload/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    let assetPath = url.pathname.slice(markerIndex + marker.length);
    const segments = assetPath.split("/").filter(Boolean);
    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    if (versionIndex >= 0) assetPath = segments.slice(versionIndex + 1).join("/");
    if (!assetPath) return null;

    const lastSlash = assetPath.lastIndexOf("/");
    const lastDot = assetPath.lastIndexOf(".");
    if (lastDot > lastSlash) assetPath = assetPath.slice(0, lastDot);
    return decodeURIComponent(assetPath);
  } catch {
    return null;
  }
}

export function isCloudinaryImageInFolder(imageUrl: string, folder: string): boolean {
  const publicId = getPublicIdFromCloudinaryUrl(imageUrl);
  return Boolean(publicId && publicId.startsWith(`${folder}/`));
}

export async function uploadImageToCloudinary(file: File, folder: string): Promise<string> {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error("Cloudinary chưa được cấu hình trên máy chủ.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + API_SECRET)
    .digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", API_KEY);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("signature", signature);
  uploadForm.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: uploadForm,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Tải ảnh lên Cloudinary thất bại.");
  }

  return data.secure_url as string;
}

/** Xóa asset image cũ và yêu cầu Cloudinary invalidate CDN cache. */
export async function deleteImageFromCloudinary(imageUrl: string): Promise<boolean> {
  const publicId = getPublicIdFromCloudinaryUrl(imageUrl);
  if (!publicId) return false;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error("Cloudinary chưa được cấu hình trên máy chủ.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + API_SECRET)
    .digest("hex");

  const destroyForm = new FormData();
  destroyForm.append("public_id", publicId);
  destroyForm.append("api_key", API_KEY);
  destroyForm.append("timestamp", String(timestamp));
  destroyForm.append("invalidate", "true");
  destroyForm.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: "POST",
    body: destroyForm,
  });
  const data = await res.json().catch(() => null);

  if (!res.ok || (data?.result !== "ok" && data?.result !== "not found")) {
    throw new Error(data?.error?.message ?? "Xóa ảnh cũ trên Cloudinary thất bại.");
  }

  return true;
}
