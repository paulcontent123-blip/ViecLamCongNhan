import type { AdPlacement } from "@/lib/ads";

// Kích thước ảnh quảng cáo theo khung hiển thị. Không import server-only để test được ngoài Next.
// Khung hiển thị (web và app) dùng đúng các tỉ lệ này nên ảnh đạt chuẩn sẽ hiện đủ, không bị cắt.

export interface AdImageSpec {
  /** Tỉ lệ rộng : cao của khung. */
  ratio: [number, number];
  minWidth: number;
  maxWidth: number;
  /** Kích thước khuyến nghị (điểm ảnh) hiện trong form Admin. */
  recommended: [number, number];
  frame: string;
}

const BANNER: AdImageSpec = { ratio: [3, 1], minWidth: 1200, maxWidth: 4000, recommended: [1200, 400], frame: "banner ngang 3:1" };

export const AD_IMAGE_SPECS: Record<AdPlacement, AdImageSpec> = {
  homepage_banner: BANNER,
  sidebar: { ratio: [1, 2], minWidth: 300, maxWidth: 1200, recommended: [300, 600], frame: "ảnh dọc 1:2" },
  service_card: { ratio: [16, 9], minWidth: 640, maxWidth: 2400, recommended: [1280, 720], frame: "ảnh 16:9" },
};

/** Sai số tỉ lệ cho phép (2%), vì ảnh thiết kế đôi khi lệch một vài điểm ảnh. */
export const AD_RATIO_TOLERANCE = 0.02;
export const AD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function adImageHint(placement: AdPlacement): string {
  const spec = AD_IMAGE_SPECS[placement];
  return `Ảnh ${spec.frame}, nên ${spec.recommended[0]}×${spec.recommended[1]} px (rộng từ ${spec.minWidth} đến ${spec.maxWidth} px), PNG/JPG/WEBP tối đa 5MB.`;
}

/** Trả về thông báo lỗi tiếng Việt nếu kích thước không đúng khung của vị trí, hoặc null nếu hợp lệ. */
export function adImageSizeError(placement: AdPlacement, width: number, height: number): string | null {
  const spec = AD_IMAGE_SPECS[placement];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "Không đọc được kích thước ảnh.";
  const expected = spec.ratio[0] / spec.ratio[1];
  if (Math.abs(width / height - expected) / expected > AD_RATIO_TOLERANCE) {
    return `Ảnh ${width}×${height} không đúng tỉ lệ ${spec.ratio[0]}:${spec.ratio[1]}. ${adImageHint(placement)}`;
  }
  if (width < spec.minWidth) return `Ảnh ${width}×${height} quá nhỏ, cần rộng tối thiểu ${spec.minWidth} px. ${adImageHint(placement)}`;
  if (width > spec.maxWidth) return `Ảnh ${width}×${height} quá lớn, cần rộng tối đa ${spec.maxWidth} px. ${adImageHint(placement)}`;
  return null;
}

/** Đọc kích thước (rộng, cao) từ phần đầu tệp PNG, JPEG hoặc WEBP; null nếu không phải ba định dạng này hoặc tệp hỏng. */
export function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u16be = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const u32be = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  const u24le = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
  const ascii = (i: number, text: string) => [...text].every((char, k) => bytes[i + k] === char.charCodeAt(0));

  // PNG: chữ ký 8 byte, rồi khối IHDR chứa rộng và cao.
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, "PNG") && ascii(12, "IHDR")) return { width: u32be(16), height: u32be(20) };

  // JPEG: đi qua các đoạn cho đến đoạn SOF (C0 đến CF, trừ C4, C8, CC) chứa cao rồi rộng.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = u16be(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: u16be(i + 5), width: u16be(i + 7) };
      if (length < 2) return null;
      i += 2 + length;
    }
    return null;
  }

  // WEBP: RIFF....WEBP rồi VP8 (lossy), VP8L (lossless) hoặc VP8X (mở rộng).
  if (bytes.length >= 30 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (ascii(12, "VP8X")) return { width: u24le(24) + 1, height: u24le(27) + 1 };
    if (ascii(12, "VP8L") && bytes[20] === 0x2f) {
      const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (ascii(12, "VP8 ") && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  return null;
}
