import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Khu vực cần đăng nhập và các endpoint dữ liệu — không có giá trị tìm kiếm,
      // để bot bò vào chỉ tốn ngân sách thu thập (crawl budget) của site.
      disallow: ["/admin", "/tuyen-dung/dashboard", "/tuyen-dung/dang-nhap", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
