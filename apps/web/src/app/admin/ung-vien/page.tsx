import Link from "next/link";
import { getAdminCandidates, ADMIN_PAGE_SIZE } from "@/lib/admin";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { CandidateStatusSelect } from "@/components/admin/CandidateStatusSelect";
import { AdminPagination } from "@/components/admin/AdminPagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const { candidates, total } = await getAdminCandidates({
    q: sp.q,
    limit: ADMIN_PAGE_SIZE,
    offset: (currentPage - 1) * ADMIN_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-extrabold text-brand-navy">👥 Database Ứng viên — Nội bộ</h1>
        <Link
          href={ROUTES.adminApplications}
          className="rounded-lg bg-brand-orange-light px-3 py-2 text-[12px] font-bold text-brand-orange transition hover:brightness-95"
        >
          📨 Xem đơn ứng tuyển
        </Link>
        <form action={ROUTES.adminCandidates} method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm theo tên…"
            className="w-56 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] outline-none focus:border-brand-orange"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="mb-4 rounded-xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange-light to-transparent px-4 py-3 text-[12.5px] text-brand-navy/60">
        🔒 <strong className="text-brand-navy">Thông tin ứng viên được bảo mật.</strong> Chỉ Admin thấy được SĐT đầy
        đủ. Nhà tuyển dụng chỉ nhận danh sách phù hợp theo gói đăng tin, không có quyền tra cứu trực tiếp. Với hồ sơ
        có đơn ứng tuyển, trạng thái được đồng bộ từ đơn; xem chi tiết từng tin tại mục Đơn ứng tuyển.
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có ứng viên nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Ứng viên</th>
                <th className="px-4 py-3 font-semibold">Tỉnh cư trú</th>
                <th className="px-4 py-3 font-semibold">Ngành mong muốn</th>
                <th className="px-4 py-3 font-semibold">Lương kỳ vọng</th>
                <th className="px-4 py-3 font-semibold">Kinh nghiệm</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-black/5">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-navy">{c.full_name}</div>
                    <div className="text-[11px] text-brand-navy/45">
                      📞 {c.phone}
                      {c.zalo && <> · Zalo: {c.zalo}</>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">{provinceName(c.province) || "—"}</td>
                  <td className="px-4 py-3 text-brand-navy/60">{industryLabel(c.desired_industry) || "—"}</td>
                  <td className="px-4 py-3 text-brand-navy/60">
                    {c.desired_salary_min ? `${(c.desired_salary_min / 1_000_000).toLocaleString("vi-VN")}tr+` : "—"}
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">
                    {c.experience_years !== null ? `${c.experience_years} năm` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <CandidateStatusSelect candidateId={c.id} currentStatus={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 text-right text-[11.5px] text-brand-navy/40">
        Hiển thị {candidates.length}/{total.toLocaleString("vi-VN")} hồ sơ
      </div>

      <AdminPagination baseHref={ROUTES.adminCandidates} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
