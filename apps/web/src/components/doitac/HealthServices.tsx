"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { ConsentCheckbox, SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
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
import {
  archiveService,
  createService,
  HealthApiError,
  listServices,
  updateService,
  type ServiceRow,
} from "@/lib/health-provider-client";
import {
  EMPTY_SERVICE_FORM,
  HEALTH_CATEGORY_OPTIONS,
  SERVICE_FILTERS,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_TONE,
  serviceBody,
  serviceToForm,
  validateServiceForm,
  type ServiceFormValues,
} from "@/lib/health-provider-portal";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

const text = (value: unknown) => (typeof value === "string" ? value : "");

function ServiceForm({
  initial,
  editing,
  verified,
  onClose,
  onSaved,
}: {
  initial: ServiceFormValues;
  /** Dịch vụ đang sửa; null là tạo mới. */
  editing: ServiceRow | null;
  verified: boolean;
  onClose: () => void;
  onSaved: (status: string) => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kết quả lưu chưa rõ: khoá nút, vì gửi lại có thể tạo dịch vụ trùng. */
  const [locked, setLocked] = useState(false);
  const set = <K extends keyof ServiceFormValues>(key: K) => (value: ServiceFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const off = busy || locked;

  async function save(submitForReview: boolean) {
    if (off) return;
    const invalid = validateServiceForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = serviceBody(values, submitForReview);
      const status = editing ? await updateService(editing.id, body) : await createService(body);
      onSaved(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa lưu được dịch vụ.");
      if (err instanceof HealthApiError && err.uncertain) setLocked(true);
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
      <div role="dialog" aria-modal="true" className="my-6 w-full max-w-[680px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${accent.text}`}>Dịch vụ y tế</div>
            <h2 className="mt-1 text-[17px] font-extrabold text-brand-navy">
              {editing ? "Sửa dịch vụ" : "Tạo dịch vụ"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng form dịch vụ"
            className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 hover:bg-black/5"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <p className="rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-[12.5px] leading-relaxed text-brand-navy/60">
            Thông tin gửi đi sẽ chờ Admin duyệt. <strong>Không nhập thông tin người bệnh vào mô tả.</strong>
          </p>

          <SelectField label="Loại dịch vụ" name="category" value={values.category} onChange={set("category")} options={HEALTH_CATEGORY_OPTIONS} disabled={off} accent={accent} />
          <TextField label="Tên dịch vụ *" name="title" value={values.title} onChange={set("title")} disabled={off} maxLength={160} accent={accent} />
          <TextField label="Chuyên khoa" name="specialty" value={values.specialty} onChange={set("specialty")} disabled={off} maxLength={100} accent={accent} />
          <TextAreaField
            label="Mô tả dịch vụ * (tối thiểu 20 ký tự)"
            name="description"
            value={values.description}
            onChange={set("description")}
            disabled={off}
            rows={4}
            maxLength={5000}
            placeholder="Mô tả dịch vụ, quy trình và phạm vi hỗ trợ"
            accent={accent}
          />
          <TextField label="Giá tham khảo" name="priceLabel" value={values.priceLabel} onChange={set("priceLabel")} disabled={off} maxLength={200} placeholder="Ví dụ: Liên hệ cơ sở" accent={accent} />
          <TextField label="Địa chỉ" name="address" value={values.address} onChange={set("address")} disabled={off} maxLength={300} accent={accent} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Tỉnh/thành" name="provinceCode" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chưa chọn" disabled={off} accent={accent} />
            <TextField label="Giờ hoạt động" name="openingHours" value={values.openingHours} onChange={set("openingHours")} disabled={off} maxLength={200} placeholder="Ví dụ: Thứ 2–Thứ 7, 7:00–17:00" accent={accent} />
          </div>
          <ConsentCheckbox
            checked={values.acceptsBhyt}
            onChange={set("acceptsBhyt")}
            text="Cơ sở có tiếp nhận BHYT (Admin kiểm tra khi duyệt)"
            disabled={off}
            accent={accent}
          />

          {editing?.status === "approved" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
              Dịch vụ này đang công khai. <strong>Lưu thay đổi sẽ đưa dịch vụ về “Chờ duyệt”</strong> và tạm ngừng
              hiển thị cho công nhân cho tới khi Admin duyệt lại.
            </p>
          )}
          {!verified && (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
              Cơ sở chưa xác minh: có thể lưu nháp, chưa thể gửi duyệt.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {verified && (
              <button
                type="button"
                disabled={off}
                onClick={() => save(true)}
                className={`flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
              >
                {busy ? "Đang gửi…" : "Lưu và gửi Admin duyệt"}
              </button>
            )}
            <button
              type="button"
              disabled={off}
              onClick={() => save(false)}
              className={`rounded-xl border px-5 py-2.5 text-[13px] font-bold transition disabled:opacity-50 ${accent.border} ${accent.text}`}
            >
              {busy && !verified ? "Đang lưu…" : "Lưu nháp"}
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

export function HealthServices({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<{ initial: ServiceFormValues; editing: ServiceRow | null } | null>(null);

  const expired = useCallback(() => router.replace(ROUTES.yTeDoiTacLogin), [router]);
  const list = useMobileList<ServiceRow>((params) => listServices(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  const archive = useCallback(
    (service: ServiceRow) => {
      // Ẩn là thao tác khó hoàn tác từ giao diện (dịch vụ được lưu trữ), nên hỏi lại như app.
      if (!window.confirm(`Ẩn “${service.title}”? Yêu cầu đã gửi vẫn được lưu.`)) return;
      setMessage("");
      action.run(service.id, () => archiveService(service.id));
    },
    [action],
  );

  return (
    <>
      <PortalHeading
        title="🩺 Dịch vụ của tôi"
        description="Trạng thái công khai chỉ đổi sau khi Admin duyệt. Dịch vụ đã duyệt mà sửa lại sẽ phải chờ duyệt lần nữa."
        action={
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setForm({ initial: EMPTY_SERVICE_FORM, editing: null });
            }}
            disabled={action.needsReload}
            className={`rounded-xl px-4 py-2 text-[13px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
          >
            + Tạo dịch vụ
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tên dịch vụ hoặc chuyên khoa…" />
        <MobileFilterChips options={SERVICE_FILTERS} active={status} onChange={setStatus} />
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
            title="Chưa tải được dịch vụ"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải dịch vụ…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có dịch vụ trong trạng thái này" description="Bấm “Tạo dịch vụ” để thêm dịch vụ đầu tiên." />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((service) => {
            const busy = action.busyId === service.id;
            const disabled = busy || action.needsReload;
            const category = HEALTH_CATEGORY_OPTIONS.find((option) => option.value === service.category)?.label;
            return (
              <article key={service.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{service.title}</h3>
                      <StatusPill
                        label={SERVICE_STATUS_LABEL[service.status] ?? service.status}
                        tone={SERVICE_STATUS_TONE[service.status] ?? "gray"}
                      />
                    </div>
                    <p className="mt-1 text-[12.5px] font-semibold text-brand-orange">
                      {text(service.specialty) || category}
                    </p>
                    {text(service.description) && (
                      <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/60">
                        {text(service.description)}
                      </p>
                    )}
                    <p className="mt-1.5 text-[12px] text-brand-navy/45">
                      {[text(service.price_label), text(service.opening_hours), service.accepts_bhyt ? "Có nhận BHYT" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                      {text(service.created_at) ? ` · tạo ${formatDate(text(service.created_at))}` : ""}
                    </p>
                    {text(service.rejection_reason) && (
                      <p className="mt-1.5 text-[12px] text-red-600">Lý do: {text(service.rejection_reason)}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setMessage("");
                        setForm({ initial: serviceToForm(service), editing: service });
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.border} ${accent.text}`}
                    >
                      Sửa nội dung
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => archive(service)}
                      className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                    >
                      {busy ? "Đang ẩn…" : "Ẩn"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="dịch vụ" />

      {form && (
        <ServiceForm
          initial={form.initial}
          editing={form.editing}
          verified={verified}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null);
            setMessage(saved === "pending" ? "Đã gửi dịch vụ chờ Admin duyệt." : "Đã lưu dịch vụ nháp.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
