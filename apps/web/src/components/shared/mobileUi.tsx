"use client";

// Mảnh giao diện dùng chung cho các màn web đọc dữ liệu qua `api/mobile/*`: khu Quản trị và cổng đối tác.
//
// Chỉ nhận props, không gắn với client nào, nên dùng được cho cả hai khu.

import type { MobileAction, MobileList } from "@/components/shared/useMobileList";


export function MobileTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string; icon?: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          aria-pressed={tab.value === active}
          className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition ${
            tab.value === active
              ? "bg-brand-navy text-white"
              : "border border-black/10 bg-white text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
          }`}
        >
          {tab.icon ? `${tab.icon} ` : ""}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function MobileFilterChips({
  options,
  active,
  onChange,
}: {
  options: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === active}
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
            option.value === active
              ? "bg-brand-orange text-white"
              : "border border-black/10 bg-white text-brand-navy/55 hover:border-brand-orange hover:text-brand-orange"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Ô tìm kiếm chỉ gửi khi bấm Tìm hoặc Enter, không gọi API theo từng ký tự. */
export function MobileSearch({
  draft,
  onDraftChange,
  onSearch,
  placeholder,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
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
        aria-label={placeholder}
        maxLength={100}
        className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-brand-navy outline-none transition focus:border-brand-orange sm:max-w-[320px]"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-brand-navy px-4 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
      >
        Tìm
      </button>
    </form>
  );
}

export function MobileStateCard({
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
      : "border-dashed border-black/10 bg-white text-brand-navy/50";
  return (
    <div className={`rounded-xl border p-8 text-center ${toneClass}`} role={tone === "error" ? "alert" : "status"}>
      <div className="text-[13.5px] font-extrabold">{title}</div>
      {description && <p className="mx-auto mt-1.5 max-w-xl text-[12.5px] leading-relaxed">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-current px-4 py-1.5 text-[12px] font-bold transition hover:bg-white/60"
        >
          Tải lại
        </button>
      )}
    </div>
  );
}

/**
 * Dải cảnh báo khi một thao tác ghi không rõ kết quả. Chặn làm tiếp và chỉ mở lại sau khi tải lại danh sách,
 * vì thao tác có thể đã được máy chủ ghi nhận.
 */
export function MobileActionAlert({ action, onReload }: { action: MobileAction; onReload: () => void }) {
  if (!action.error) return null;
  return (
    <div
      role="alert"
      className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium ${
        action.needsReload ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
      }`}
    >
      <span>
        {action.needsReload ? "⚠️ " : ""}
        {action.error}
      </span>
      {action.needsReload ? (
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white transition hover:brightness-110"
        >
          Tải lại danh sách
        </button>
      ) : (
        <button
          type="button"
          onClick={action.clearError}
          className="rounded-lg border border-current px-3 py-1 text-[12px] font-bold"
        >
          Đóng
        </button>
      )}
    </div>
  );
}

export function MobilePager({ list, unit }: { list: MobileList<unknown>; unit: string }) {
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  if (!list.loaded || list.total === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-brand-navy/50">
      <span>
        Tổng {list.total.toLocaleString("vi-VN")} {unit} · trang {list.page}/{totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={list.page <= 1 || list.loading}
          onClick={() => list.setPage(list.page - 1)}
          className="rounded-lg border border-black/10 px-3 py-1.5 font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Trước
        </button>
        <button
          type="button"
          disabled={!list.hasMore || list.loading}
          onClick={() => list.setPage(list.page + 1)}
          className="rounded-lg border border-black/10 px-3 py-1.5 font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sau →
        </button>
      </div>
    </div>
  );
}
