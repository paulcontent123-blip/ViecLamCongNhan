/**
 * URL gốc của site, dùng cho sitemap và robots.
 * Đặt qua NEXT_PUBLIC_SITE_URL; mặc định là domain production.
 * Không có dấu "/" ở cuối.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vieclamcongnhan.com"
).replace(/\/+$/, "");

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
