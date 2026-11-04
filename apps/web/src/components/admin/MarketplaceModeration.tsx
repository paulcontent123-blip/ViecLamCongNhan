"use client";

import { useCallback, useState } from "react";
import {
  AdminActionAlert,
  AdminFilterChips,
  AdminPager,
  AdminSearch,
  AdminStateCard,
  useAdminAction,
  useAdminMobileList,
} from "@/components/admin/AdminMobileShared";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { adminPatch } from "@/lib/mobile-admin-client";
import { provinceName } from "@/lib/provinces";
import { displayProvince } from "@/lib/worker-services";

// Nhãn danh mục khớp app (`MarketplaceScreen.js`). Đổi một bên thì đổi cả hai.
const CATEGORY_LABEL: Record<string, string> = {
  vehicle: "Xe cộ",
  home_goods: "Đồ dùng",
  electronics: "Điện tử",
  clothing: "Quần áo",
  other: "Khác",
};

/** Route mặc định lọc "pending"; muốn xem hết phải gửi đúng chữ "all", gửi rỗng vẫn ra "pending". */
const STATUS_FILTERS = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "all", label: "Tất cả" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

const REASON_MIN = 3;

type ListingRow = {
  id: string;
  seller_display_name: string | null;
  seller_phone: string | null;
  title: string;
  description: string | null;
  category: string | null;
  item_condition: string | null;
  price_vnd: number | null;
  is_negotiable: boolean | null;
  province_code: string | null;
  location: string | null;
  photo_urls: string[] | null;
  seller_state: string | null;
  moderation_status: string;
  rejection_reason: string | null;
  published_at: string | null;
  expires_at: string | null;
  updated_at: string;
  created_at: string;
};

function price(value: number | null, negotiable: boolean | null): string {
  if (!Number.isSafeInteger(value)) return "Chưa ghi giá";
  const amount = value as number;
  const label = amount === 0 ? "Cho tặng" : `${amount.toLocaleString("vi-VN")}đ`;
  return negotiable ? `${label} · có thương lượng` : label;
}

function ListingCard({
  item,
  action,
  onDecide,
}: {
  item: ListingRow;
  action: ReturnType<typeof useAdminAction>;
  onDecide: (item: ListingRow, status: "approved" | "rejected", reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const busy = action.busyId === item.id;
  const disabled = busy || action.needsReload;
  const photos = (item.photo_urls ?? []).filter((url) => typeof url === "string" && url.startsWith("https://"));
  const place = [item.location, displayProvince(item.province_code, provinceName)].filter(Boolean).join(" · ");

  return (
    <article className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-4">
        {photos.length > 0 && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web */}
            <img
              src={photos[0]}
              alt={`Ảnh tin: ${item.title}`}
              loading="lazy"
              className="h-24 w-32 rounded-lg object-cover"
            />
            {photos.length > 1 && (
              <span className="absolute bottom-1 right-1 rounded-full bg-brand-navy/70 px-2 py-0.5 text-[10px] font-bold text-white">
                +{photos.length - 1}
              </span>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-brand-navy">{item.title}</h3>
            <StatusPill
              label={STATUS_LABEL[item.moderation_status] ?? item.moderation_status}
              tone={STATUS_TONE[item.moderation_status] ?? "gray"}
            />
            {item.category && (
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-brand-navy/50">
                {CATEGORY_LABEL[item.category] ?? item.category}
              </span>
            )}
          </div>

          <p className="mt-1 text-[13px] font-bold text-brand-orange">
            {price(item.price_vnd, item.is_negotiable)}
          </p>
          <p className="mt-1 text-[12px] text-brand-navy/50">
            {item.seller_display_name || "Người bán"}
            {/* Số điện thoại người bán chỉ hiện cho Admin, không ra API công khai. */}
            {item.seller_phone ? ` · ${item.seller_phone}` : ""}
            {place ? ` · ${place}` : ""}
          </p>
          {item.description && (
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-brand-navy/55">
              {item.description}
            </p>
          )}
          <p className="mt-1.5 text-[11.5px] text-brand-navy/40">
            Gửi {formatDateTime(item.created_at)}
            {item.expires_at ? ` · hết hạn ${formatDate(item.expires_at)}` : ""}
            {item.seller_state && item.seller_state !== "available" ? ` · người bán đánh dấu: ${item.seller_state}` : ""}
          </p>
          {item.rejection_reason && (
            <p className="mt-1.5 text-[12px] text-red-600">Lý do từ chối trước đó: {item.rejection_reason}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDecide(item, "approved", "")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-40"
          >
            {busy ? "…" : "✓ Duyệt"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRejecting((value) => !value)}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
          >
            Từ chối
          </button>
        </div>
      </div>

      {rejecting && (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <label className="block text-[12px] font-semibold text-red-800">
            Lý do từ chối (người bán sẽ đọc được) *
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-red-400"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={disabled || reason.trim().length < REASON_MIN}
              onClick={() => onDecide(item, "rejected", reason)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-40"
            >
              Gửi từ chối
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function MarketplaceModeration() {
  const [status, setStatus] = useState("pending");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const list = useAdminMobileList<ListingRow>("admin/marketplace", { q: query, status });
  const action = useAdminAction(list.reload);

  const decide = useCallback(
    async (item: ListingRow, next: "approved" | "rejected", reason: string) => {
      await adminPatch(`admin/marketplace/${encodeURIComponent(item.id)}`, {
        status: next,
        // Mốc phiên bản: hai Admin duyệt cùng lúc thì người sau nhận lỗi thay vì ghi đè.
        expectedUpdatedAt: item.updated_at,
        rejectionReason: next === "rejected" ? reason.trim() : "",
      });
    },
    [],
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminSearch
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tìm theo tiêu đề tin…"
        />
        <AdminFilterChips options={STATUS_FILTERS} active={status} onChange={setStatus} />
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title="Chưa tải được tin Chợ"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && (
        <AdminStateCard tone="loading" title="Đang tải tin Chợ…" />
      )}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <AdminStateCard tone="empty" title="Không có tin nào ở trạng thái này" />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              action={action}
              onDecide={(target, next, reason) => action.run(target.id, () => decide(target, next, reason))}
            />
          ))}
        </div>
      )}

      <AdminPager list={list} unit="tin" />
    </>
  );
}
