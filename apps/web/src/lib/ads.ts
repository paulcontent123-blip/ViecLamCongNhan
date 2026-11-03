import { z } from "zod";

// Quảng cáo do Admin quản lý. Không import server-only để test được ngoài Next.

export const AD_PLACEMENTS = ["homepage_banner", "sidebar", "service_card"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const AD_STATUSES = ["active", "paused"] as const;

/** Banner trang chủ và sidebar chỉ có một quảng cáo tại một vị trí trong cùng thời gian; card thì nhiều, HOT xếp đầu. */
export const SINGLE_SLOT_PLACEMENTS: readonly AdPlacement[] = ["homepage_banner", "sidebar"];
/** Quảng cáo theo KCN chỉ có card, mỗi card đúng một KCN. (Quảng cáo KCN dạng banner/gói 5 KCN đã có sẵn ở trang Quảng cáo theo KCN, không làm lại ở đây.) */
export const AD_MAX_KCN = 1;

export const AD_FIELDS =
  "id, placement, title, body, image_url, link_url, is_hot, kcn_ids, show_on_web, show_on_app, starts_on, ends_on, status, customer_note, created_at, updated_at";

/** Phần công khai của quảng cáo: không có ghi chú nội bộ, trạng thái hay thời hạn. */
export const AD_PUBLIC_FIELDS = "id, placement, title, body, image_url, link_url, is_hot, kcn_ids, show_on_web, show_on_app, starts_on, ends_on, status, created_at";

export interface AdRow {
  id: string;
  placement: AdPlacement;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  is_hot: boolean;
  kcn_ids: string[];
  show_on_web: boolean;
  show_on_app: boolean;
  starts_on: string;
  ends_on: string;
  status: "active" | "paused";
  customer_note?: string | null;
  created_at: string;
  updated_at?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validAdId(id: string) { return UUID.test(id); }

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD), để quảng cáo hết hạn đúng nửa đêm Việt Nam chứ không phải nửa đêm UTC. */
export function adToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Ảnh quảng cáo chỉ được lấy từ thư mục "ads" do chính API tải lên tạo ra (không nhận ảnh ngoài hay ảnh đã biến đổi), để kích thước đã kiểm tra là kích thước thật. */
export function isAdImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && /^\/[^/]+\/image\/upload\/(v\d+\/)?ads\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).nullable().optional().transform((value) => (value ? value : null));
const httpsUrl = z.string().trim().max(500, "Liên kết tối đa 500 ký tự.");

const baseSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự.").max(100, "Tiêu đề tối đa 100 ký tự."),
  body: optionalText(300, "Nội dung tối đa 300 ký tự."),
  imageUrl: httpsUrl.refine((value) => value === "" || isAdImageUrl(value), "Ảnh quảng cáo phải được tải lên bằng nút chọn ảnh (đúng kích thước khung).").nullable().optional().transform((value) => value || null),
  linkUrl: httpsUrl.refine((value) => value === "" || value.startsWith("https://") || /^tel:\+?\d{8,15}$/.test(value), "Liên kết phải bắt đầu bằng https:// hoặc tel:.").nullable().optional().transform((value) => value || null),
  isHot: z.boolean().optional().default(false),
  kcnIds: z.array(z.string().regex(UUID, "KCN không hợp lệ.")).max(AD_MAX_KCN, `Tối đa ${AD_MAX_KCN} KCN.`).optional().default([]),
  showOnWeb: z.boolean().optional().default(true),
  showOnApp: z.boolean().optional().default(true),
  startsOn: z.string().refine(validDate, "Ngày bắt đầu không hợp lệ (YYYY-MM-DD)."),
  endsOn: z.string().refine(validDate, "Ngày kết thúc không hợp lệ (YYYY-MM-DD)."),
  status: z.enum(AD_STATUSES).optional().default("active"),
  customerNote: optionalText(500, "Ghi chú tối đa 500 ký tự."),
}).strict();

/** Quy tắc theo vị trí. Trả về thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function adRuleError(ad: z.infer<typeof baseSchema>): string | null {
  const kcnCount = new Set(ad.kcnIds).size;
  if (kcnCount !== ad.kcnIds.length) return "Danh sách KCN bị trùng.";
  if (ad.endsOn < ad.startsOn) return "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";
  if (!ad.showOnWeb && !ad.showOnApp) return "Chọn ít nhất một nơi hiển thị (web hoặc app).";
  if (ad.placement === "sidebar" && (ad.showOnApp || !ad.showOnWeb)) return "Sidebar chỉ hiển thị trên web.";
  if (ad.isHot && ad.placement !== "service_card") return "Nhãn HOT chỉ dùng cho card nhà trọ/dịch vụ.";
  if ((ad.placement === "homepage_banner" || ad.placement === "sidebar") && kcnCount !== 0) return "Vị trí này áp dụng toàn site, không chọn KCN.";
  if (ad.placement === "service_card" && kcnCount !== 1) return "Card nhà trọ/dịch vụ cần chọn đúng 1 KCN.";
  if (ad.placement !== "service_card" && !ad.imageUrl) return "Vị trí này cần ảnh quảng cáo.";
  return null;
}

export type AdInput = z.infer<typeof baseSchema>;

export const adCreateSchema = baseSchema.superRefine((ad, context) => {
  const error = adRuleError(ad);
  if (error) context.addIssue({ code: "custom", message: error });
});

/** Sửa: gửi lại toàn bộ nội dung (app Admin luôn gửi cả form), nên dùng cùng quy tắc với tạo mới. */
export const adUpdateSchema = adCreateSchema;

interface SlotLike {
  id?: string;
  placement: AdPlacement;
  kcn_ids: string[];
  show_on_web: boolean;
  show_on_app: boolean;
  starts_on: string;
  ends_on: string;
  status: string;
}

/**
 * Tìm quảng cáo đang chiếm chỗ mà quảng cáo mới/sửa sẽ trùng: cùng vị trí, cùng kênh, trùng khoảng ngày.
 * Chỉ áp dụng cho vị trí một chỗ; card không giới hạn. Quảng cáo tạm dừng không chiếm chỗ.
 */
export function findSlotConflict<T extends SlotLike>(candidate: SlotLike, existing: readonly T[]): T | null {
  if (candidate.status !== "active" || !SINGLE_SLOT_PLACEMENTS.includes(candidate.placement)) return null;
  return (
    existing.find((other) =>
      other.id !== candidate.id &&
      other.status === "active" &&
      other.placement === candidate.placement &&
      ((candidate.show_on_web && other.show_on_web) || (candidate.show_on_app && other.show_on_app)) &&
      other.starts_on <= candidate.ends_on && candidate.starts_on <= other.ends_on,
    ) ?? null
  );
}

export const AD_CONFLICT_MESSAGE =
  "Vị trí này đã có quảng cáo khác trong khoảng thời gian (và KCN, kênh) bạn chọn. Đổi ngày, KCN hoặc tạm dừng quảng cáo kia trước.";

export function isAdRunning(ad: Pick<AdRow, "status" | "starts_on" | "ends_on">, today: string = adToday()): boolean {
  return ad.status === "active" && ad.starts_on <= today && today <= ad.ends_on;
}

export type AdChannel = "web" | "app";

export interface PublicAd {
  id: string;
  placement: AdPlacement;
  title: string;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  isHot: boolean;
  kcnIds: string[];
}

export function toPublicAd(ad: AdRow): PublicAd {
  return { id: ad.id, placement: ad.placement, title: ad.title, body: ad.body, imageUrl: ad.image_url, linkUrl: ad.link_url, isHot: ad.is_hot, kcnIds: ad.kcn_ids };
}

/**
 * Chọn quảng cáo hiển thị: đúng kênh, đang chạy, đúng vị trí và (với KCN) đúng KCN đang xem.
 * Vị trí một chỗ chỉ trả tối đa một quảng cáo (nếu dữ liệu có hai, lấy cái bắt đầu muộn hơn, rồi mới tạo hơn). Card: HOT trước, rồi mới nhất trước.
 */
export function selectAds(rows: readonly AdRow[], options: { placement: AdPlacement; channel: AdChannel; kcnId?: string | null; today?: string }): PublicAd[] {
  const today = options.today ?? adToday();
  const matching = rows.filter((ad) =>
    ad.placement === options.placement &&
    isAdRunning(ad, today) &&
    (options.channel === "web" ? ad.show_on_web : ad.show_on_app) &&
    (ad.kcn_ids.length === 0 || (!!options.kcnId && ad.kcn_ids.includes(options.kcnId))),
  );
  const newestFirst = (a: AdRow, b: AdRow) => b.starts_on.localeCompare(a.starts_on) || b.created_at.localeCompare(a.created_at);
  if (SINGLE_SLOT_PLACEMENTS.includes(options.placement)) return matching.sort(newestFirst).slice(0, 1).map(toPublicAd);
  return matching.sort((a, b) => Number(b.is_hot) - Number(a.is_hot) || newestFirst(a, b)).map(toPublicAd);
}

/** Bản ghi cho app Admin: gồm cả ghi chú nội bộ và cờ "đang chạy". */
export function toAdminAd(ad: AdRow, today: string = adToday()) {
  return { ...ad, running: isAdRunning(ad, today) };
}

/** Cột ghi vào bảng từ dữ liệu đã kiểm tra. */
export function adColumns(ad: AdInput) {
  return {
    placement: ad.placement,
    title: ad.title,
    body: ad.body,
    image_url: ad.imageUrl,
    link_url: ad.linkUrl,
    is_hot: ad.isHot,
    kcn_ids: ad.kcnIds,
    show_on_web: ad.showOnWeb,
    show_on_app: ad.showOnApp,
    starts_on: ad.startsOn,
    ends_on: ad.endsOn,
    status: ad.status,
    customer_note: ad.customerNote,
  };
}
