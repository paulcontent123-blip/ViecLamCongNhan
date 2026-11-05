import type { WorkerServiceMeta } from "@/lib/worker-services";

/** Màu thương hiệu của web (cam) cho mọi cổng đối tác, giống khu Nhà tuyển dụng; thay cho màu riêng từng dịch vụ. */
export const PORTAL_ACCENT: WorkerServiceMeta["accent"] = {
  hero: "bg-gradient-to-br from-brand-orange to-brand-orange-2",
  tint: "bg-brand-orange-light text-brand-orange",
  button: "bg-brand-orange text-white hover:brightness-110",
  text: "text-brand-orange",
  border: "border-brand-orange",
  focus: "focus:border-brand-orange",
};
