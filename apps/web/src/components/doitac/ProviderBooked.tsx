"use client";

// "Dịch vụ đã đặt": các yêu cầu tư vấn dịch vụ / quảng cáo mà đối tác đã gửi cho bộ phận kinh doanh, khớp theo số điện
// thoại của tài khoản. Chỉ XEM ‑ khác trang của nhà tuyển dụng, route của đối tác không có thao tác hủy.
// Cả năm loại đối tác dùng chung một hàm ở máy chủ (`provider-service-inquiries.ts`) nên dùng chung một màn.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { formatDateTime } from "@/lib/format-date";
import { BOOKED_STATUS_LABEL, BOOKED_STATUS_TONE, BOOKED_TYPE_LABEL } from "@/lib/health-provider-portal";

const text = (value: unknown) => (typeof value === "string" ? value : "");

type BookedRow = Record<string, unknown> & { id: string; status: string };

export function ProviderBooked({
  listBooked,
  loginHref,
}: {
  listBooked: () => Promise<{ items: Record<string, unknown>[]; total: number }>;
  loginHref: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BookedRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listBooked();
      setRows(result.items as BookedRow[]);
      setTotal(result.total);
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(loginHref);
        return;
      }
      setError(messageOf(err, "Chưa tải được dịch vụ đã đặt."));
    } finally {
      setLoading(false);
    }
  }, [listBooked, loginHref, router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PortalHeading
        title="📦 Dịch vụ đã đặt"
        description="Các yêu cầu tư vấn dịch vụ, quảng cáo hoặc hợp tác được gửi bằng số điện thoại của tài khoản. Bộ phận kinh doanh sẽ liên hệ lại."
      />

      {error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được dịch vụ đã đặt"
            description={rows?.length ? `Đang giữ danh sách đã tải trước đó. ${error}` : error}
            onRetry={load}
          />
        </div>
      )}

      {loading && !rows && !error && <MobileStateCard tone="loading" title="Đang tải…" />}

      {rows && rows.length === 0 && !error && (
        <MobileStateCard
          tone="empty"
          title="Chưa có yêu cầu nào"
          description="Yêu cầu chỉ hiện ở đây khi được gửi bằng số điện thoại trùng với tài khoản."
        />
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="mb-3 text-[12.5px] text-brand-navy/50">
            Hiển thị {rows.length.toLocaleString("vi-VN")}
            {total > rows.length ? `/${total.toLocaleString("vi-VN")}` : ""} yêu cầu mới nhất
          </p>
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-extrabold text-brand-navy">
                    {text(row.service_name) || BOOKED_TYPE_LABEL[text(row.type)] || text(row.type) || "Yêu cầu tư vấn"}
                  </h3>
                  <StatusPill label={BOOKED_STATUS_LABEL[row.status] ?? row.status} tone={BOOKED_STATUS_TONE[row.status] ?? "gray"} />
                </div>
                <p className="mt-1 text-[12px] text-brand-navy/45">
                  {BOOKED_TYPE_LABEL[text(row.type)] ?? text(row.type)}
                  {text(row.kcn_target) ? ` · ${text(row.kcn_target)}` : ""}
                </p>
                {text(row.request) && (
                  <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/60">{text(row.request)}</p>
                )}
                {text(row.cancel_reason) && <p className="mt-2 text-[12px] text-red-600">Lý do hủy: {text(row.cancel_reason)}</p>}
                <p className="mt-2 text-[11.5px] text-brand-navy/40">
                  Gửi {formatDateTime(text(row.created_at))}
                  {text(row.consulted_at) ? ` · tư vấn ${formatDateTime(text(row.consulted_at))}` : ""}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
