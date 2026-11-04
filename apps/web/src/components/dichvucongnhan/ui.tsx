// Mảnh giao diện dùng chung cho 5 trang Dịch vụ công nhân. Chỉ nhận props, không có hook,
// nên dùng được ở cả trang máy chủ (hero, tab) lẫn trong component trình duyệt (ô nhập, chip).

import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { WORKER_SERVICE_LIST, type WorkerServiceMeta } from "@/lib/worker-services";

export function ServiceHero({
  service,
  children,
}: {
  service: WorkerServiceMeta;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${service.accent.hero} px-4 py-10 sm:px-8 sm:py-12 lg:px-[52px]`}>
      <div className="mx-auto max-w-6xl">
        <Link
          href={ROUTES.dichVuCongNhan}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/70 transition hover:text-white"
        >
          ← Dịch vụ cho công nhân
        </Link>
        <h1 className="mt-3 flex items-center gap-2.5 text-[26px] font-extrabold leading-tight text-white sm:text-[34px]">
          <span aria-hidden="true">{service.icon}</span>
          {service.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/80">{service.description}</p>
        {children}
      </div>
    </section>
  );
}

/** Thanh chuyển qua lại giữa 5 khu dịch vụ; `active` là khu đang mở. */
export function ServiceTabs({ active }: { active: WorkerServiceMeta["key"] }) {
  return (
    <nav aria-label="Các dịch vụ cho công nhân" className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-3 sm:px-8 lg:px-[52px]">
        {WORKER_SERVICE_LIST.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition ${
                isActive
                  ? `${item.accent.border} ${item.accent.tint}`
                  : "border-black/10 text-brand-navy/55 hover:border-brand-orange hover:text-brand-orange"
              }`}
            >
              <span aria-hidden="true">{item.icon}</span> {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Khung nội dung chuẩn của các trang trong khu (nền xám, bề rộng tối đa giống trang Dịch vụ trọn gói). */
export function ServiceContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[50vh] bg-[#f6f7f9] px-4 py-8 sm:px-8 sm:py-10 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

/** Ô tìm kiếm có nút "Tìm": chỉ gửi khi bấm nút hoặc Enter, không gọi API theo từng ký tự (giống app). */
export function SearchBar({
  draft,
  onDraftChange,
  onSearch,
  placeholder,
  accent,
  label,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
  accent: WorkerServiceMeta["accent"];
  label: string;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <input
        type="search"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={100}
        className={`min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition ${accent.focus}`}
      />
      <button
        type="submit"
        className={`shrink-0 rounded-lg px-5 py-2.5 text-[13px] font-bold transition ${accent.button}`}
      >
        Tìm
      </button>
    </form>
  );
}

export function Chip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent: WorkerServiceMeta["accent"];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition ${
        active ? `${accent.border} ${accent.tint}` : "border-black/10 bg-white text-brand-navy/55 hover:border-brand-navy/25"
      }`}
    >
      {label}
    </button>
  );
}

/** Thẻ trạng thái cho cả ba trường hợp: đang tải, lỗi (có nút thử lại) và không có kết quả. */
export function StateCard({
  tone,
  title,
  description,
  onRetry,
}: {
  tone: "loading" | "error" | "empty";
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-dashed border-black/10 bg-white text-brand-navy/55";
  return (
    <div className={`rounded-2xl border p-8 text-center ${toneClass}`} role={tone === "error" ? "alert" : "status"}>
      <div className="text-[14px] font-extrabold">{title}</div>
      {description && <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-current px-4 py-2 text-[12.5px] font-bold transition hover:bg-white/60"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

export function LoadMoreButton({
  loading,
  onClick,
  accent,
  label = "Tải thêm",
}: {
  loading: boolean;
  onClick: () => void;
  accent: WorkerServiceMeta["accent"];
  label?: string;
}) {
  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`rounded-xl border px-6 py-2.5 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${accent.border} ${accent.text} hover:bg-white`}
      >
        {loading ? "Đang tải…" : label}
      </button>
    </div>
  );
}

/** Dòng "Hiển thị x/y", giống app, để công nhân biết còn bao nhiêu kết quả. */
export function ResultCount({ shown, total, unit }: { shown: number; total: number; unit: string }) {
  return (
    <p className="mb-4 text-[12.5px] text-brand-navy/50">
      Hiển thị {shown.toLocaleString("vi-VN")}/{total.toLocaleString("vi-VN")} {unit}
    </p>
  );
}

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition";

export function TextField({
  label,
  name,
  value,
  onChange,
  accent,
  type = "text",
  required,
  disabled,
  maxLength,
  placeholder,
  inputMode,
  min,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  accent: WorkerServiceMeta["accent"];
  type?: "text" | "tel" | "email" | "date";
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  min?: string;
}) {
  return (
    <label className="block text-[12px] font-semibold text-brand-navy/60">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        min={min}
        className={`${fieldClass} ${accent.focus} disabled:bg-black/5`}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  accent,
  rows = 4,
  maxLength,
  disabled,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  accent: WorkerServiceMeta["accent"];
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12px] font-semibold text-brand-navy/60">
      {label}
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        className={`${fieldClass} resize-y ${accent.focus} disabled:bg-black/5`}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  accent,
  disabled,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  accent: WorkerServiceMeta["accent"];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12px] font-semibold text-brand-navy/60">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${fieldClass} ${accent.focus} disabled:bg-black/5`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ConsentCheckbox({
  checked,
  onChange,
  text,
  disabled,
  accent,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  text: string;
  disabled?: boolean;
  accent: WorkerServiceMeta["accent"];
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-brand-navy/70">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-black/20 ${accent.text}`}
      />
      <span>{text}</span>
    </label>
  );
}

/** Nhãn "Đã xác minh" giống app: mọi nội dung trong khu này đều từ đơn vị đã xác minh và đã được Admin duyệt. */
export function VerifiedBadge() {
  return (
    <span className="shrink-0 rounded-full bg-[#DBF7E8] px-2 py-1 text-[10px] font-extrabold text-[#146C43]">
      Đã xác minh
    </span>
  );
}

/** Một dòng "nhãn ‑ giá trị"; tự ẩn khi không có giá trị, để không hiện ô trống. */
export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="border-b border-black/5 py-2.5 last:border-b-0">
      <div className="text-[11.5px] text-brand-navy/45">{label}</div>
      <div className="mt-0.5 whitespace-pre-line text-[13.5px] font-semibold text-brand-navy">{value}</div>
    </div>
  );
}
