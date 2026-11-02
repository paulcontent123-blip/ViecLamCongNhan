import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { ADMIN_PAGE_SIZE } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { WORKER_INQUIRY_KINDS, parseWorkerInquiryFilters, workerInquiryForwardingEnabled, workerInquiryListQuery } from "@/lib/worker-inquiries";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusPill } from "@/components/admin/StatusPill";
import { WorkerInquiryActions } from "@/components/admin/WorkerInquiryActions";

// Danh sách đổi ngay sau mỗi thao tác chuyển hoặc đóng.
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  vocational_inquiry: "Học nghề · Hỏi khóa học",
  vocational_application: "Học nghề · Hồ sơ học viên",
  insurance_inquiry: "Bảo hiểm",
  finance_inquiry: "Tài chính",
};
const ADMIN_STATUS: Record<string, { label: string; tone: "amber" | "blue" | "green" }> = {
  new: { label: "Chưa xử lý", tone: "amber" },
  contacted: { label: "Đã liên hệ", tone: "blue" },
  closed: { label: "Đã đóng", tone: "green" },
};
const PARTNER_STATUS: Record<string, string> = {
  new: "Chờ đối tác", viewed: "Đối tác đã xem", contacted: "Đối tác đã liên hệ", advising: "Đang tư vấn", registered: "Đã đăng ký",
  resolved: "Đã giải quyết", accepted: "Đã nhận", rejected: "Từ chối", closed: "Đã đóng", cancelled: "Đã hủy",
};

interface InquiryRow {
  kind: string; id: string; full_name: string; phone: string; email: string | null; message: string | null; subject: string; provider_name: string;
  partner_status: string; routed_to: "admin" | "provider"; admin_status: "new" | "contacted" | "closed"; admin_note: string | null; forwarded_at: string | null; created_at: string;
}

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}

export default async function AdminWorkerInquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = toSp(await searchParams);
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);
  const canForward = workerInquiryForwardingEnabled();
  const params = new URLSearchParams();
  for (const key of ["kind", "routed", "status", "q"]) if (sp[key]) params.set(key, sp[key] as string);

  let filterError: string | null = null;
  let filters = parseWorkerInquiryFilters(new URLSearchParams());
  try {
    filters = parseWorkerInquiryFilters(params);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    filterError = error.message;
  }

  const supabase = createSupabaseAdminClient();
  const [list, pending] = await Promise.all([
    workerInquiryListQuery(supabase, filters, (currentPage - 1) * ADMIN_PAGE_SIZE, ADMIN_PAGE_SIZE),
    supabase.from("admin_worker_inquiries").select("id", { count: "exact", head: true }).eq("routed_to", "admin").eq("admin_status", "new"),
  ]);
  const loadError = list.error || pending.error;
  const items = ((list.data ?? []) as unknown as InquiryRow[]);
  const total = list.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const newCount = pending.count ?? 0;

  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-[12px] font-bold transition ${active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"}`;
  const link = (overrides: Record<string, string | undefined>) => `${ROUTES.adminWorkerInquiries}${buildQuery(sp, overrides)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">🙋 Yêu cầu dịch vụ của công nhân</h1>
          <p className="mt-1 text-[12.5px] text-brand-navy/50">
            Học nghề, bảo hiểm, tài chính · {total.toLocaleString("vi-VN")} yêu cầu{newCount > 0 ? ` · ${newCount} chưa xử lý` : ""}
          </p>
        </div>
        <form action={ROUTES.adminWorkerInquiries} method="get" className="flex gap-2">
          {sp.kind && <input type="hidden" name="kind" value={sp.kind} />}
          {sp.routed && <input type="hidden" name="routed" value={sp.routed} />}
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tên, SĐT, khóa học, sản phẩm..."
            className="w-64 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
          <button type="submit" className="rounded-lg bg-brand-orange px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-105">Tìm</button>
        </form>
      </div>

      <div className="mb-4 rounded-xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange-light to-transparent px-4 py-3 text-[12.5px] text-brand-navy/60">
        🔒 Yêu cầu do công nhân chủ động gửi cho Admin. Chỉ Admin xem và liên hệ tư vấn; thông tin không được chuyển cho đối tác.
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {[{ key: "admin", label: "Đang ở Admin" }, { key: "provider", label: "Đã gửi đối tác (trước đây)" }, { key: "all", label: "Tất cả" }].map((tab) => (
          <Link key={tab.key} href={link({ routed: tab.key === "admin" ? undefined : tab.key, status: undefined })} className={pill(filters.routed === tab.key)}>{tab.label}</Link>
        ))}
      </div>
      {filters.routed === "admin" && (
        <div className="mb-2 flex flex-wrap gap-2">
          {[{ key: undefined, label: "Mọi trạng thái" }, { key: "new", label: "Chưa xử lý" }, { key: "contacted", label: "Đã liên hệ" }, { key: "closed", label: "Đã đóng" }].map((tab) => (
            <Link key={tab.label} href={link({ status: tab.key })} className={pill((filters.status || undefined) === tab.key)}>{tab.label}</Link>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={link({ kind: undefined })} className={pill(!filters.kind)}>Tất cả loại</Link>
        {WORKER_INQUIRY_KINDS.map((kind) => (
          <Link key={kind} href={link({ kind })} className={pill(filters.kind === kind)}>{KIND_LABEL[kind]}</Link>
        ))}
      </div>

      {filterError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{filterError}</div>}
      {loadError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">Chưa tải được yêu cầu. Hãy thử lại sau.</div>}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const status = ADMIN_STATUS[item.admin_status];
          return (
            <div key={`${item.kind}:${item.id}`} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-extrabold text-brand-navy">{item.full_name}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-brand-orange">{KIND_LABEL[item.kind] ?? item.kind}</div>
                </div>
                {item.routed_to === "admin" ? <StatusPill label={status.label} tone={status.tone} /> : <StatusPill label="Đã gửi đối tác" tone="green" />}
              </div>
              <div className="mt-1 text-[12.5px] text-brand-navy/60">{item.subject} · {item.provider_name}</div>
              <div className="text-[11.5px] text-brand-navy/40">Gửi lúc {new Date(item.created_at).toLocaleString("vi-VN")}</div>
              <div className="mt-2 text-[12.5px] text-brand-navy">SĐT: <span className="font-semibold">{item.phone}</span>{item.email ? ` · Email: ${item.email}` : ""}</div>
              {item.message && <div className="mt-1 whitespace-pre-line text-[12.5px] text-brand-navy/70">{item.message}</div>}
              {item.routed_to === "provider" && (
                <div className="mt-1 text-[11.5px] text-brand-navy/50">
                  Đã chuyển lúc {item.forwarded_at ? new Date(item.forwarded_at).toLocaleString("vi-VN") : "(trước khi có hàng đợi Admin)"} · Đối tác: {PARTNER_STATUS[item.partner_status] ?? item.partner_status}
                </div>
              )}
              <WorkerInquiryActions
                kind={item.kind}
                id={item.id}
                name={item.full_name}
                providerName={item.provider_name}
                routedTo={item.routed_to}
                canForward={canForward}
                adminStatus={item.admin_status}
                adminNote={item.admin_note}
              />
            </div>
          );
        })}
        {!loadError && items.length === 0 && <div className="rounded-2xl border border-black/5 bg-white p-8 text-center text-[13px] text-brand-navy/40">Không có yêu cầu phù hợp.</div>}
      </div>

      <AdminPagination baseHref={ROUTES.adminWorkerInquiries} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
