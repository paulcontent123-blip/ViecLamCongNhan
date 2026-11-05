// Dựng dữ liệu Tổng quan cho Bảo hiểm, Tài chính và Thuê trọ từ các route danh sách có sẵn của từng cổng.
// Hồ sơ là bắt buộc; các số liệu còn lại hỏng một phần thì vẫn hiện phần còn lại (cờ `partial`).

import type { OverviewActivity, OverviewData } from "@/components/doitac/ProviderOverview";
import type { MobileListResult, MobileQuery } from "@/lib/mobile-session-client";
import type { StatusTone } from "@/lib/provider-portal-common";

type Row = Record<string, unknown> & { id: string };
type Lister = (params: MobileQuery) => Promise<MobileListResult<Row>>;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export type OverviewSource = {
  getProfile: () => Promise<Record<string, unknown> & { email: string; is_verified: boolean }>;
  listItems: Lister;
  listInquiries: Lister;
  itemNoun: string;
  itemLabel: Record<string, string>;
  itemTone: Record<string, StatusTone>;
  itemHref: string;
  /** Chữ cho dòng hoạt động "yêu cầu" (ví dụ "Yêu cầu tư vấn"). */
  inquiryType: string;
  inquiryLabel: Record<string, string>;
  inquiryTone: Record<string, StatusTone>;
  inquiryHref: string;
  /** Lấy dòng phụ (tên sản phẩm / tin) từ một yêu cầu. */
  inquirySubject: (row: Row) => string;
  subtitle: (profile: Record<string, unknown> & { email: string }) => string;
  extraNotice?: (profile: Record<string, unknown>) => React.ReactNode;
  /** Trạng thái "chờ duyệt" của mục chính; mặc định "pending". */
  pendingStatus?: string;
};

export async function loadProviderOverview(source: OverviewSource): Promise<OverviewData> {
  const profile = await source.getProfile();
  const results = await Promise.allSettled([
    source.listItems({ page: 1, pageSize: 4 }),
    source.listItems({ page: 1, pageSize: 1, status: source.pendingStatus ?? "pending" }),
    source.listInquiries({ page: 1, pageSize: 4 }),
    source.listInquiries({ page: 1, pageSize: 1, status: "new" }),
  ]);
  const [items, pendingItems, inquiries, newInquiries] = results;
  const totalOf = (result: PromiseSettledResult<{ total: number }>) => (result.status === "fulfilled" ? result.value.total : null);

  const activity: OverviewActivity[] = [];
  if (items.status === "fulfilled") {
    for (const item of items.value.items) {
      activity.push({
        id: `item-${item.id}`,
        href: source.itemHref,
        type: source.itemNoun,
        title: text(item.title),
        label: source.itemLabel[text(item.status)] ?? text(item.status),
        tone: source.itemTone[text(item.status)] ?? "gray",
        createdAt: text(item.created_at) || null,
      });
    }
  }
  if (inquiries.status === "fulfilled") {
    for (const item of inquiries.value.items) {
      activity.push({
        id: `inquiry-${item.id}`,
        href: source.inquiryHref,
        type: source.inquiryType,
        title: text(item.full_name),
        detail: source.inquirySubject(item) || null,
        label: source.inquiryLabel[text(item.status)] ?? text(item.status),
        tone: source.inquiryTone[text(item.status)] ?? "gray",
        createdAt: text(item.created_at) || null,
      });
    }
  }
  activity.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const total = totalOf(items);
  const inquiryTotal = totalOf(inquiries);
  return {
    name: text(profile.provider_name) || "Đơn vị đối tác",
    verified: profile.is_verified === true,
    subtitle: source.subtitle(profile),
    stats: [totalOf(pendingItems), totalOf(newInquiries), total, inquiryTotal],
    summary: `${total ?? "—"} ${source.itemNoun.toLowerCase()} · ${inquiryTotal ?? "—"} yêu cầu`,
    activity: activity.slice(0, 6),
    partial: results.some((result) => result.status === "rejected"),
    extraNotice: source.extraNotice?.(profile),
  };
}
