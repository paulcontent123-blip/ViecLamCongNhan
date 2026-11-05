"use client";

// Màn "Sản phẩm của tôi" dùng chung cho Bảo hiểm và Tài chính: danh sách, lọc, form tạo/sửa dựng theo cấu hình ô nhập.
//
// Hai cổng này KHÔNG có công tắc "gửi duyệt" như Y tế: máy chủ cho sản phẩm vào "Chờ duyệt" nếu đơn vị đã xác minh,
// vào "Nháp" nếu chưa, ở cả lúc tạo lẫn lúc sửa. Vì vậy form chỉ có MỘT nút lưu, nhãn đổi theo trạng thái xác minh.

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { FieldGrid, type FieldDef, type ProviderAccent } from "@/components/doitac/FieldGrid";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import {
  MobileActionAlert,
  MobileFilterChips,
  MobilePager,
  MobileSearch,
  MobileStateCard,
} from "@/components/shared/mobileUi";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import { MobileApiError } from "@/lib/mobile-session-client";
import type { MobileListResult, MobileQuery } from "@/lib/mobile-session-client";
import {
  PRODUCT_FILTERS,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  type Values,
} from "@/lib/provider-portal-common";

type ProductRow = Record<string, unknown> & { id: string; title: string; status: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export type ProductsConfig = {
  loginHref: string;
  accent: ProviderAccent;
  title: string;
  description: string;
  searchPlaceholder: string;
  /** Tên gọi một sản phẩm ở số ít, dùng trong thông báo ("sản phẩm"). */
  unit: string;
  fields: FieldDef[];
  emptyValues: Values;
  toValues: (row: Record<string, unknown>) => Values;
  validate: (values: Values) => string | null;
  buildBody: (values: Values) => Record<string, unknown>;
  list: (params: MobileQuery) => Promise<MobileListResult<ProductRow>>;
  create: (body: Record<string, unknown>) => Promise<{ id: string; status: string }>;
  update: (id: string, body: Record<string, unknown>) => Promise<{ id: string; status: string }>;
  /** Có thì hiện nút "Lưu trữ" (chỉ Tài chính); nhận mốc phiên bản của dòng để chống ẩn nhầm bản mới. */
  archive?: (row: ProductRow) => Promise<void>;
  /** Các dòng mô tả ngắn trên thẻ. */
  meta: (row: Record<string, unknown>) => string[];
  /** Lời nhắc khi lưu thay đổi của sản phẩm đang công khai. */
  editApprovedWarning: string;
  /** Phần nhắc thêm trong form (ví dụ lưu ý riêng của cổng). */
  formNote?: React.ReactNode;
};

function ProductForm({
  config,
  initial,
  editing,
  verified,
  onClose,
  onSaved,
}: {
  config: ProductsConfig;
  initial: Values;
  editing: ProductRow | null;
  verified: boolean;
  onClose: () => void;
  onSaved: (status: string) => void;
}) {
  const { accent } = config;
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kết quả lưu chưa rõ: khoá nút, vì gửi lại có thể tạo bản ghi trùng. */
  const [locked, setLocked] = useState(false);
  const off = busy || locked;

  async function save() {
    if (off) return;
    const invalid = config.validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = config.buildBody(values);
      const saved = editing ? await config.update(editing.id, body) : await config.create(body);
      onSaved(saved.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Chưa lưu được ${config.unit}.`);
      if (err instanceof MobileApiError && err.uncertain) setLocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="my-6 w-full max-w-[720px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
          <h2 className="text-[17px] font-extrabold text-brand-navy">
            {editing ? `Sửa ${config.unit}` : `Tạo ${config.unit}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng form"
            className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 hover:bg-black/5"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {config.formNote}

          <FieldGrid
            fields={config.fields}
            values={values}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
            disabled={off}
            accent={accent}
          />

          {editing?.status === "approved" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
              {config.editApprovedWarning}
            </p>
          )}
          {!verified && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
              Chưa được Admin xác minh: {config.unit} chỉ được lưu ở trạng thái Nháp, chưa gửi duyệt được.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={off}
              onClick={save}
              className={`flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
            >
              {busy ? "Đang lưu…" : verified ? "Lưu và gửi Admin duyệt" : "Lưu nháp"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/50"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProviderProducts({ config, verified }: { config: ProductsConfig; verified: boolean }) {
  const { accent } = config;
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<{ initial: Values; editing: ProductRow | null } | null>(null);

  const expired = useCallback(() => router.replace(config.loginHref), [router, config.loginHref]);
  const list = useMobileList<ProductRow>((params) => config.list(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  const archive = useCallback(
    (row: ProductRow) => {
      if (!config.archive) return;
      // Lưu trữ khó hoàn tác từ giao diện, nên hỏi lại như app.
      if (!window.confirm(`Lưu trữ “${row.title}”? Sản phẩm sẽ không còn hiển thị.`)) return;
      setMessage("");
      action.run(row.id, () => config.archive!(row));
    },
    [action, config],
  );

  return (
    <>
      <PortalHeading
        title={config.title}
        description={config.description}
        action={
          <button
            type="button"
            disabled={action.needsReload}
            onClick={() => {
              setMessage("");
              setForm({ initial: config.emptyValues, editing: null });
            }}
            className={`rounded-xl px-4 py-2 text-[13px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
          >
            + Tạo {config.unit}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder={config.searchPlaceholder} />
        <MobileFilterChips options={PRODUCT_FILTERS} active={status} onChange={setStatus} />
      </div>

      {message && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-800" role="status">
          {message}
        </div>
      )}

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title={`Chưa tải được ${config.unit}`}
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải danh sách…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard
          tone="empty"
          title={`Chưa có ${config.unit} trong trạng thái này`}
          description={`Bấm “Tạo ${config.unit}” để thêm ${config.unit} đầu tiên.`}
        />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const disabled = busy || action.needsReload;
            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{row.title}</h3>
                      <StatusPill
                        label={PRODUCT_STATUS_LABEL[row.status] ?? row.status}
                        tone={PRODUCT_STATUS_TONE[row.status] ?? "gray"}
                      />
                    </div>
                    <p className={`mt-1 text-[12.5px] font-semibold ${accent.text}`}>{config.meta(row).join(" · ")}</p>
                    {text(row.subtitle) && <p className="mt-1 text-[12.5px] text-brand-navy/60">{text(row.subtitle)}</p>}
                    {text(row.description) && (
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/55">
                        {text(row.description)}
                      </p>
                    )}
                    {text(row.created_at) && (
                      <p className="mt-1.5 text-[11.5px] text-brand-navy/40">Tạo {formatDate(text(row.created_at))}</p>
                    )}
                    {text(row.rejection_reason) && (
                      <p className="mt-1.5 text-[12px] text-red-600">Lý do cần chỉnh sửa: {text(row.rejection_reason)}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setMessage("");
                        setForm({ initial: config.toValues(row), editing: row });
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.border} ${accent.text}`}
                    >
                      Sửa nội dung
                    </button>
                    {config.archive && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => archive(row)}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                      >
                        {busy ? "Đang lưu trữ…" : "Lưu trữ"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit={config.unit} />

      {form && (
        <ProductForm
          config={config}
          initial={form.initial}
          editing={form.editing}
          verified={verified}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null);
            setMessage(saved === "pending" ? `Đã gửi ${config.unit} chờ Admin duyệt.` : `Đã lưu ${config.unit} nháp.`);
            list.reload();
          }}
        />
      )}
    </>
  );
}
