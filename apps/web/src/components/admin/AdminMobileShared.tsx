"use client";

// Phần dùng chung cho các màn Quản trị đọc dữ liệu qua `api/mobile/admin/*`.
//
// Khác các trang Quản trị cũ (dựng ở máy chủ rồi `router.refresh()` sau mỗi thao tác): những route này
// chưa có hàm đọc trong `lib/`, nên trang chạy ở trình duyệt và tự tải lại danh sách sau khi ghi. Nhờ đó
// web dùng đúng API mà app Admin đang dùng, không phải thêm gì ở máy chủ.

import { useCallback, useEffect, useRef, useState } from "react";
import { adminList, AdminApiError, buildAdminQuery, type AdminQuery } from "@/lib/mobile-admin-client";

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type AdminMobileList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  extra: Record<string, unknown>;
  loading: boolean;
  error: string;
  loaded: boolean;
  setPage: (page: number) => void;
  reload: () => void;
};

/**
 * Đọc một danh sách quản trị và theo dõi trạng thái tải.
 *
 * Đổi bộ lọc thì quay về trang 1. Tải lại hỏng thì GIỮ danh sách đang xem và chỉ hiện thẻ lỗi, để Admin
 * không mất chỗ đang làm. Mỗi lần tải mang số thứ tự; phản hồi của yêu cầu cũ về muộn sẽ bị bỏ.
 */
export function useAdminMobileList<T>(path: string, filters: AdminQuery, pageSize = 20): AdminMobileList<T> {
  // Bộ lọc giữ dưới dạng chuỗi query đã chuẩn hóa để dùng làm phụ thuộc của hook.
  const key = buildAdminQuery(filters);

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  // Đổi bộ lọc khi đang ở trang 3 mà giữ nguyên trang thì dễ ra danh sách rỗng; luôn về trang 1.
  const previousKey = useRef(key);
  if (previousKey.current !== key) {
    previousKey.current = key;
    if (page !== 1) setPageState(1);
  }

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const filterParams = Object.fromEntries(new URLSearchParams(key));
      const result = await adminList<T>(path, { ...filterParams, page, pageSize });
      if (mine !== seq.current) return;
      setItems(result.items);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setExtra(result.extra);
      setLoaded(true);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(messageOf(err, "Chưa tải được danh sách."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path, key, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore,
    extra,
    loading,
    error,
    loaded,
    setPage: setPageState,
    reload: load,
  };
}

export type AdminAction = {
  /** Id bản ghi đang chạy thao tác, để khóa đúng dòng đó. */
  busyId: string | null;
  error: string;
  /** Thao tác ghi chưa rõ kết quả: phải tải lại danh sách trước khi làm tiếp. */
  needsReload: boolean;
  run: (id: string, action: () => Promise<void>) => Promise<void>;
  clearError: () => void;
};

/**
 * Chạy một thao tác ghi của Admin.
 *
 * Kết quả "chưa xác định" (mất mạng, máy chủ 5xx) thì khóa toàn bộ thao tác cho tới khi Admin tải lại
 * danh sách: thao tác có thể đã được ghi, bấm lại có thể duyệt nhầm hoặc ghi đè lên việc người khác vừa làm.
 */
export function useAdminAction(onDone: () => void): AdminAction {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async (id: string, action: () => Promise<void>) => {
      if (busy.current || needsReload) return;
      busy.current = true;
      setBusyId(id);
      setError("");
      try {
        await action();
        onDone();
      } catch (err) {
        if (err instanceof AdminApiError && err.uncertain) setNeedsReload(true);
        setError(messageOf(err, "Chưa lưu được thay đổi."));
      } finally {
        busy.current = false;
        setBusyId(null);
      }
    },
    [needsReload, onDone],
  );

  return { busyId, error, needsReload, run, clearError: () => setError("") };
}

// ───────── Mảnh giao diện dùng chung ─────────

export function AdminTabs<T extends string>({
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

export function AdminFilterChips({
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
export function AdminSearch({
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

export function AdminStateCard({
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
export function AdminActionAlert({ action, onReload }: { action: AdminAction; onReload: () => void }) {
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

export function AdminPager({ list, unit }: { list: AdminMobileList<unknown>; unit: string }) {
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
