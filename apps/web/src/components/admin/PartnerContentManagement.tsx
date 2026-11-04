"use client";

import { useCallback, useState } from "react";
import {
  AdminActionAlert,
  AdminFilterChips,
  AdminPager,
  AdminSearch,
  AdminStateCard,
  AdminTabs,
  useAdminAction,
  useAdminMobileList,
} from "@/components/admin/AdminMobileShared";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDate } from "@/lib/format-date";
import { adminPatch } from "@/lib/mobile-admin-client";
import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_TONE,
  contentPatchBody,
  contentProviderOf,
  PARTNER_CONTENTS,
  PARTNER_KINDS,
  REJECTION_REASON_MIN,
  type ContentDecision,
  type PartnerContentConfig,
  type PartnerKind,
} from "@/lib/admin-partners";
import { provinceName } from "@/lib/provinces";
import {
  displayProvince,
  FINANCE_PUBLIC_CATEGORY_LABEL,
  formatRent,
  INSURANCE_CATEGORY_LABEL,
} from "@/lib/worker-services";

type ContentRow = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Vài dòng tóm tắt đủ để Admin quyết định duyệt hay không, khác nhau theo từng khu. */
function detailsOf(config: PartnerContentConfig, item: ContentRow): string[] {
  const lines: string[] = [];
  if (config.kind === "training") {
    const main = [text(item.occupation), text(item.level)].filter(Boolean).join(" · ");
    if (main) lines.push(main);
  }
  if (config.kind === "rental") {
    lines.push(formatRent(item.monthly_rent_vnd));
    const place = [text(item.location), displayProvince(text(item.province_code), provinceName)]
      .filter(Boolean)
      .join(" · ");
    if (place) lines.push(place);
  }
  if (config.kind === "insurance") {
    const category = text(item.category);
    if (category) lines.push(INSURANCE_CATEGORY_LABEL[category] ?? category);
    const price = text(item.price_label);
    if (price) lines.push(price);
  }
  if (config.kind === "finance") {
    const category = text(item.category);
    if (category) lines.push(FINANCE_PUBLIC_CATEGORY_LABEL[category] ?? category);
    const price = text(item.price_label);
    lines.push(price ? `Phí/lãi: ${price}` : "Chưa ghi phí/lãi");
    lines.push(item.pricing_approved === true ? "Bảng giá đã duyệt" : "Bảng giá CHƯA duyệt");
  }
  if (config.kind === "health") {
    const main = [text(item.specialty), text(item.price_label)].filter(Boolean).join(" · ");
    if (main) lines.push(main);
    const place = [text(item.address), displayProvince(text(item.province_code), provinceName)]
      .filter(Boolean)
      .join(" · ");
    if (place) lines.push(place);
  }
  return lines;
}

function ContentCard({
  item,
  config,
  action,
  onDecide,
}: {
  item: ContentRow;
  config: PartnerContentConfig;
  action: ReturnType<typeof useAdminAction>;
  onDecide: (item: ContentRow, decision: ContentDecision, reason: string, pricingApproved: boolean) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [approvePricing, setApprovePricing] = useState(false);

  const busy = action.busyId === item.id;
  const disabled = busy || action.needsReload;
  const provider = contentProviderOf(config, item);
  const details = detailsOf(config, item);
  const description = text(item.description);

  return (
    <article className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-brand-navy">{item.title}</h3>
            <StatusPill
              label={CONTENT_STATUS_LABEL[item.status] ?? item.status}
              tone={CONTENT_STATUS_TONE[item.status] ?? "gray"}
            />
            {!provider.verified && <StatusPill label="Đối tác chưa xác minh" tone="red" />}
          </div>
          <p className="mt-1 text-[12px] text-brand-navy/50">
            {provider.name || "Đối tác"} · gửi {formatDate(item.created_at)}
          </p>
          {details.length > 0 && (
            <p className="mt-1.5 text-[12.5px] font-semibold text-brand-navy/70">{details.join(" · ")}</p>
          )}
          {description && (
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-brand-navy/55">{description}</p>
          )}
          {item.rejection_reason && (
            <p className="mt-1.5 text-[12px] text-red-600">Lý do từ chối trước đó: {item.rejection_reason}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || !provider.verified}
            title={provider.verified ? undefined : "Phải xác minh đối tác trước khi duyệt nội dung"}
            onClick={() => onDecide(item, "approved", "", approvePricing)}
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
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDecide(item, "hidden", "", false)}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/50 transition hover:border-brand-navy/30 disabled:opacity-40"
          >
            Ẩn
          </button>
        </div>
      </div>

      {config.hasPricingApproval && (
        <label className="mt-3 flex items-center gap-2 text-[12px] text-brand-navy/60">
          <input
            type="checkbox"
            checked={approvePricing}
            disabled={disabled}
            onChange={(event) => setApprovePricing(event.target.checked)}
            className="h-4 w-4"
          />
          Duyệt luôn phần phí/lãi (chưa duyệt thì công nhân không thấy số tiền)
        </label>
      )}

      {rejecting && (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <label className="block text-[12px] font-semibold text-red-800">
            Lý do từ chối (đối tác sẽ đọc được) *
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
              disabled={disabled || reason.trim().length < REJECTION_REASON_MIN}
              onClick={() => onDecide(item, "rejected", reason, false)}
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

export function PartnerContentManagement() {
  const [kind, setKind] = useState<PartnerKind>("training");
  const [status, setStatus] = useState("pending");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const config = PARTNER_CONTENTS[kind];
  // Đổi khu mà trạng thái cũ không có ở khu mới (ví dụ "closed" chỉ có ở Học nghề) thì máy chủ trả 400.
  const safeStatus = status && config.statuses.includes(status) ? status : "";
  const list = useAdminMobileList<ContentRow>(config.path, { q: query, status: safeStatus });
  const action = useAdminAction(list.reload);

  const decide = useCallback(
    async (item: ContentRow, decision: ContentDecision, reason: string, pricingApproved: boolean) => {
      const body = contentPatchBody(config, {
        status: decision,
        rejectionReason: reason,
        expectedUpdatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
        pricingApproved: decision === "approved" ? pricingApproved : undefined,
      });
      await adminPatch(`${config.path}/${encodeURIComponent(item.id)}`, body);
    },
    [config],
  );

  const statusOptions = [
    { value: "", label: "Tất cả" },
    ...config.statuses.map((value) => ({ value, label: CONTENT_STATUS_LABEL[value] ?? value })),
  ];

  return (
    <>
      <AdminTabs
        tabs={PARTNER_KINDS.map((item) => ({
          value: item,
          label: PARTNER_CONTENTS[item].label,
          icon: PARTNER_CONTENTS[item].icon,
        }))}
        active={kind}
        onChange={setKind}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminSearch
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder={`Tìm ${config.unit}…`}
        />
        <AdminFilterChips options={statusOptions} active={safeStatus} onChange={setStatus} />
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title={`Chưa tải được ${config.unit}`}
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && (
        <AdminStateCard tone="loading" title="Đang tải danh sách…" />
      )}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <AdminStateCard
          tone="empty"
          title={`Không có ${config.unit} nào ở trạng thái này`}
          description="Thử đổi bộ lọc trạng thái hoặc bỏ từ khóa tìm kiếm."
        />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              config={config}
              action={action}
              onDecide={(target, decision, reason, pricingApproved) =>
                action.run(target.id, () => decide(target, decision, reason, pricingApproved))
              }
            />
          ))}
        </div>
      )}

      <AdminPager list={list} unit={config.unit} />
    </>
  );
}
