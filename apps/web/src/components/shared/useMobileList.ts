"use client";

// Hook dùng chung cho mọi màn web đọc danh sách qua `api/mobile/*` (khu Quản trị và cổng đối tác).
//
// Nhận thẳng hàm tải thay vì đường dẫn, để mỗi khu truyền client của mình vào (`adminList`,
// `listCourses`, `listLearners`…) mà không phải chép lại phần quản lý trạng thái.

import { useCallback, useEffect, useRef, useState } from "react";
import { MobileApiError, buildMobileQuery, type MobileListResult, type MobileQuery } from "@/lib/mobile-session-client";

export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Phiên hết hạn: màn gọi tự quyết định đưa người dùng về đâu. */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof MobileApiError && error.status === 401;
}

export type MobileList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  extra: Record<string, unknown>;
  /** Đang tải trang đầu, hoặc đang tải lại sau khi đổi bộ lọc. */
  loading: boolean;
  error: string;
  /** Đã tải xong ít nhất một lần: phân biệt "không có kết quả" với "chưa tải". */
  loaded: boolean;
  setPage: (page: number) => void;
  reload: () => void;
};

export type MobileListFetcher<T> = (params: MobileQuery) => Promise<MobileListResult<T>>;

/**
 * Đọc một danh sách và theo dõi trạng thái tải.
 *
 * Đổi bộ lọc thì quay về trang 1. Tải lại hỏng thì GIỮ danh sách đang xem và chỉ hiện thẻ lỗi, để người dùng
 * không mất chỗ đang làm khi mạng chập chờn. Mỗi lần tải mang số thứ tự; phản hồi của yêu cầu cũ về muộn bị bỏ.
 * `onSessionExpired` được gọi khi máy chủ trả 401, để màn đưa người dùng về trang đăng nhập.
 */
export function useMobileList<T>(
  fetcher: MobileListFetcher<T>,
  filters: MobileQuery,
  options: { pageSize?: number; onSessionExpired?: () => void } = {},
): MobileList<T> {
  const { pageSize = 20, onSessionExpired } = options;
  // Bộ lọc giữ dưới dạng chuỗi query đã chuẩn hóa để dùng làm phụ thuộc của hook.
  const key = buildMobileQuery(filters);

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  // Hàm tải và hàm xử lý hết phiên đổi tham chiếu mỗi lần render; giữ trong ref để không tải lại vô ích.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const expiredRef = useRef(onSessionExpired);
  expiredRef.current = onSessionExpired;

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
      const params = Object.fromEntries(new URLSearchParams(key));
      const result = await fetcherRef.current({ ...params, page, pageSize });
      if (mine !== seq.current) return;
      setItems(result.items);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setExtra(result.extra);
      setLoaded(true);
    } catch (err) {
      if (mine !== seq.current) return;
      if (isSessionExpired(err)) expiredRef.current?.();
      setError(messageOf(err, "Chưa tải được danh sách."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [key, page, pageSize]);

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

export type MobileAction = {
  /** Id bản ghi đang chạy thao tác, để khoá đúng dòng đó. */
  busyId: string | null;
  error: string;
  /** Thao tác ghi chưa rõ kết quả: phải tải lại trước khi làm tiếp. */
  needsReload: boolean;
  run: (id: string, action: () => Promise<void>) => Promise<void>;
  clearError: () => void;
};

/**
 * Chạy một thao tác ghi.
 *
 * Kết quả "chưa xác định" (mất mạng, máy chủ 5xx, phản hồi không khớp) thì khoá toàn bộ thao tác cho tới khi
 * tải lại: thao tác có thể đã được ghi, bấm lại có thể gây trùng hoặc đè lên việc người khác vừa làm.
 */
export function useMobileAction(onDone: () => void, onSessionExpired?: () => void): MobileAction {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const busy = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const expiredRef = useRef(onSessionExpired);
  expiredRef.current = onSessionExpired;

  const run = useCallback(
    async (id: string, action: () => Promise<void>) => {
      if (busy.current || needsReload) return;
      busy.current = true;
      setBusyId(id);
      setError("");
      try {
        await action();
        doneRef.current();
      } catch (err) {
        if (isSessionExpired(err)) expiredRef.current?.();
        if (err instanceof MobileApiError && err.uncertain) setNeedsReload(true);
        setError(messageOf(err, "Chưa lưu được thay đổi."));
      } finally {
        busy.current = false;
        setBusyId(null);
      }
    },
    [needsReload],
  );

  return { busyId, error, needsReload, run, clearError: () => setError("") };
}
