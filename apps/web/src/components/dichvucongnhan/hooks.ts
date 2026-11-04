"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildListQuery,
  fetchList,
  WorkerServiceError,
  type ListQuery,
  type RequestOptions,
} from "@/lib/worker-service-client";

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof WorkerServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type ServiceList<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  /** Đang tải trang đầu (hoặc đang tải lại sau khi đổi bộ lọc). */
  loading: boolean;
  loadingMore: boolean;
  error: string;
  /** Đã tải xong ít nhất một lần: dùng để phân biệt "chưa có kết quả" với "chưa tải". */
  loaded: boolean;
  reload: () => void;
  loadMore: () => void;
};

/**
 * Đọc một danh sách công khai từ `api/mobile/*` và theo dõi trạng thái tải.
 *
 * Đổi bộ lọc thì tải lại từ trang 1. Nếu lần tải lại thất bại thì GIỮ dữ liệu đã có và chỉ hiện thẻ lỗi,
 * giống cách app xử lý, để công nhân không mất danh sách đang xem khi mạng chập chờn.
 * Mỗi lần tải mang một số thứ tự; phản hồi của yêu cầu cũ về muộn sẽ bị bỏ, tránh hiện kết quả của bộ lọc trước.
 */
export function useServiceList<T extends { id: string }>(
  path: string,
  params: ListQuery,
  pageSize = 20,
): ServiceList<T> {
  // Bộ lọc được giữ dưới dạng chuỗi query đã chuẩn hóa, không phải đối tượng `params` (đổi mỗi lần render
  // nên không dùng làm phụ thuộc của hook được). Khi cần gọi API thì đọc lại từ chuỗi này.
  const key = buildListQuery(params);

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const moreBusy = useRef(false);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchList<T>(path, { ...Object.fromEntries(new URLSearchParams(key)), page: 1, pageSize });
      if (mine !== seq.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
      setHasMore(result.hasMore);
      setLoaded(true);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(messageOf(err, "Chưa tải được danh sách."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path, key, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (moreBusy.current || loading || !hasMore) return;
    moreBusy.current = true;
    const mine = seq.current;
    setLoadingMore(true);
    setError("");
    try {
      const result = await fetchList<T>(path, {
        ...Object.fromEntries(new URLSearchParams(key)),
        page: page + 1,
        pageSize,
      });
      if (mine !== seq.current) return;
      // Trang sau có thể lặp bản ghi nếu dữ liệu vừa đổi; lọc theo id để không hiện trùng.
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (err) {
      if (mine === seq.current) setError(messageOf(err, "Chưa tải thêm được."));
    } finally {
      moreBusy.current = false;
      if (mine === seq.current) setLoadingMore(false);
    }
  }, [hasMore, key, loading, page, path, pageSize]);

  return { items, total, hasMore, loading, loadingMore, error, loaded, reload: load, loadMore };
}

export type InquiryPhase = "idle" | "sending" | "sent" | "uncertain";

export type InquirySubmit = {
  phase: InquiryPhase;
  error: string;
  /** Mã yêu cầu máy chủ trả về, để công nhân đọc lại cho đơn vị khi cần tra. */
  resultId: string | null;
  /** Không được gửi nữa: đang gửi, đã gửi xong, hoặc kết quả chưa xác định. */
  locked: boolean;
  submit: (validate: () => string | null, action: () => Promise<string>) => Promise<void>;
  reset: () => void;
};

/**
 * Quản lý một lần gửi yêu cầu.
 *
 * Quy tắc sao từ app: khi mất mạng hoặc máy chủ lỗi 5xx thì kết quả là "chưa xác định" ‑ KHÔNG tự gửi lại và
 * khóa luôn nút gửi, vì yêu cầu có thể đã được ghi nhận. Lỗi dữ liệu (4xx) thì chỉ hiện thông báo để sửa và gửi lại.
 */
export function useInquirySubmit(): InquirySubmit {
  const [phase, setPhase] = useState<InquiryPhase>("idle");
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState<string | null>(null);
  const busy = useRef(false);

  const locked = phase !== "idle";

  const submit = useCallback(async (validate: () => string | null, action: () => Promise<string>) => {
    if (busy.current || phase !== "idle") return;
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setPhase("sending");
    setError("");
    try {
      const id = await action();
      setResultId(id);
      setPhase("sent");
    } catch (err) {
      if (err instanceof WorkerServiceError && err.uncertain) {
        setPhase("uncertain");
        setError(err.message);
      } else {
        setPhase("idle");
        setError(messageOf(err, "Chưa gửi được yêu cầu. Vui lòng thử lại."));
      }
    } finally {
      busy.current = false;
    }
  }, [phase]);

  const reset = useCallback(() => {
    busy.current = false;
    setPhase("idle");
    setError("");
    setResultId(null);
  }, []);

  return { phase, error, resultId, locked, submit, reset };
}

/** Kiểm tra tối thiểu ở trình duyệt để báo lỗi sớm; máy chủ vẫn là nơi quyết định (giống app). */
export function validateContact(fullName: string, phone: string): string | null {
  if (fullName.trim().length < 2) return "Nhập họ tên từ 2 ký tự.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) return "Số điện thoại phải có 9 đến 12 chữ số.";
  return null;
}

export type { RequestOptions };
