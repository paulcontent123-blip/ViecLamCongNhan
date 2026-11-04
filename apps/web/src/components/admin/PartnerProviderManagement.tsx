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
  PARTNER_KINDS,
  PARTNER_PROVIDERS,
  providerPatchBody,
  providerTypeLabel,
  type PartnerKind,
  type PartnerProviderConfig,
} from "@/lib/admin-partners";
import { provinceName } from "@/lib/provinces";
import { displayProvince } from "@/lib/worker-services";

/** Trường chung của 5 bảng đối tác; trường nào route không trả thì để trống. */
type ProviderRow = {
  id: string;
  provider_name: string;
  provider_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  province_code: string | null;
  email?: string | null;
  tax_code?: string | null;
  license_number?: string | null;
  license_evidence_url?: string | null;
  is_verified: boolean;
  contact_view_limit?: number | null;
  account_type?: string | null;
  account_tier_expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const VERIFIED_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "false", label: "Chưa xác minh" },
  { value: "true", label: "Đã xác minh" },
];

function ContactLimitEditor({
  row,
  config,
  disabled,
  onSave,
}: {
  row: ProviderRow;
  config: PartnerProviderConfig;
  disabled: boolean;
  onSave: (limit: number) => void;
}) {
  const current = typeof row.contact_view_limit === "number" ? row.contact_view_limit : 0;
  const [draft, setDraft] = useState(String(current));
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(String(current));
          setOpen(true);
        }}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:opacity-40"
      >
        Hạn mức: {current.toLocaleString("vi-VN")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={100000}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={`Hạn mức xem liên hệ của ${row.provider_name}`}
        className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-[12px] outline-none focus:border-brand-orange"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const value = Number(draft);
          // Máy chủ nhận số nguyên 0‑100000; chặn sớm để không gửi yêu cầu chắc chắn hỏng.
          if (!Number.isSafeInteger(value) || value < 0 || value > 100000) return;
          onSave(value);
          setOpen(false);
        }}
        className="rounded-lg bg-brand-navy px-2.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40"
      >
        Lưu
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg border border-black/10 px-2 py-1.5 text-[11.5px] font-bold text-brand-navy/50"
      >
        Huỷ
      </button>
      <span className="text-[11px] text-brand-navy/40">
        {config.kind === "health" ? "lưu kèm trạng thái xác minh" : "0 = dùng hạn mức theo gói"}
      </span>
    </div>
  );
}

function ProviderCard({
  row,
  config,
  action,
  onVerify,
  onLimit,
}: {
  row: ProviderRow;
  config: PartnerProviderConfig;
  action: ReturnType<typeof useAdminAction>;
  onVerify: (row: ProviderRow, verified: boolean) => void;
  onLimit: (row: ProviderRow, limit: number) => void;
}) {
  const busy = action.busyId === row.id;
  const disabled = busy || action.needsReload;
  const province = displayProvince(row.province_code, provinceName);
  const license = [row.tax_code && `MST ${row.tax_code}`, row.license_number && `GP ${row.license_number}`]
    .filter(Boolean)
    .join(" · ");
  const evidence =
    typeof row.license_evidence_url === "string" && row.license_evidence_url.startsWith("https://")
      ? row.license_evidence_url
      : null;

  return (
    <article className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-brand-navy">{row.provider_name}</h3>
            <StatusPill
              label={row.is_verified ? "Đã xác minh" : "Chưa xác minh"}
              tone={row.is_verified ? "green" : "amber"}
            />
            {row.account_type && row.account_type !== "free" && (
              <StatusPill label={String(row.account_type).toUpperCase()} tone="blue" />
            )}
          </div>
          <p className="mt-1 text-[12px] text-brand-navy/50">
            {[providerTypeLabel(row.provider_type), province].filter(Boolean).join(" · ") ||
              "Chưa cập nhật loại hình"}
          </p>
          <p className="mt-1 text-[12.5px] text-brand-navy/70">
            {row.contact_name || "Chưa có người liên hệ"}
            {row.contact_phone ? ` · ${row.contact_phone}` : ""}
            {row.email ? ` · ${row.email}` : ""}
          </p>
          {license && <p className="mt-1 text-[12px] text-brand-navy/45">{license}</p>}
          <p className="mt-1 text-[11.5px] text-brand-navy/40">
            Đăng ký {formatDate(row.created_at)}
            {row.account_tier_expires_at ? ` · gói hết hạn ${formatDate(row.account_tier_expires_at)}` : ""}
          </p>
          {evidence && (
            <a
              href={evidence}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[12px] font-bold text-brand-orange underline"
            >
              Xem giấy phép đã tải lên ↗
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {config.hasContactLimit && (
            <ContactLimitEditor
              row={row}
              config={config}
              disabled={disabled}
              onSave={(limit) => onLimit(row, limit)}
            />
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onVerify(row, !row.is_verified)}
            className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${
              row.is_verified
                ? "border border-black/10 text-brand-navy/60 hover:border-red-300 hover:text-red-600"
                : "bg-emerald-600 text-white hover:brightness-105"
            }`}
          >
            {busy ? "…" : row.is_verified ? "Huỷ xác minh" : "✓ Xác minh"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function PartnerProviderManagement() {
  const [kind, setKind] = useState<PartnerKind>("training");
  const [verified, setVerified] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const config = PARTNER_PROVIDERS[kind];
  const list = useAdminMobileList<ProviderRow>(config.path, { q: query, verified });
  const action = useAdminAction(list.reload);

  const patch = useCallback(
    async (row: ProviderRow, changes: { verified?: boolean; contactViewLimit?: number }) => {
      // Khu Y tế đòi gửi đủ cả xác minh lẫn hạn mức kèm mốc phiên bản, nên bù phần không đổi từ dòng hiện tại.
      const body = providerPatchBody(config, {
        verified: changes.verified ?? (config.patchShape === "health" ? row.is_verified : undefined),
        contactViewLimit:
          changes.contactViewLimit ??
          (config.patchShape === "health" ? (row.contact_view_limit ?? 0) : undefined),
        expectedUpdatedAt: row.updated_at ?? null,
      });
      await adminPatch(`${config.path}/${encodeURIComponent(row.id)}`, body);
    },
    [config],
  );

  return (
    <>
      <AdminTabs
        tabs={PARTNER_KINDS.map((item) => ({
          value: item,
          label: PARTNER_PROVIDERS[item].label,
          icon: PARTNER_PROVIDERS[item].icon,
        }))}
        active={kind}
        onChange={setKind}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminSearch
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder={`Tìm theo tên ${config.providerLabel.toLowerCase()} hoặc số điện thoại…`}
        />
        <AdminFilterChips options={VERIFIED_FILTERS} active={verified} onChange={setVerified} />
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title={`Chưa tải được danh sách ${config.providerLabel.toLowerCase()}`}
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
          title={`Chưa có ${config.providerLabel.toLowerCase()} nào`}
          description="Thử bỏ bộ lọc hoặc đổi từ khóa tìm kiếm."
        />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((row) => (
            <ProviderCard
              key={row.id}
              row={row}
              config={config}
              action={action}
              onVerify={(target, next) => action.run(target.id, () => patch(target, { verified: next }))}
              onLimit={(target, limit) => action.run(target.id, () => patch(target, { contactViewLimit: limit }))}
            />
          ))}
        </div>
      )}

      <AdminPager list={list} unit={config.providerLabel.toLowerCase()} />
    </>
  );
}
