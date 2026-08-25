import Link from "next/link";
import { getAdminEmployers, ADMIN_PAGE_SIZE } from "@/lib/admin";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { StatusPill } from "@/components/admin/StatusPill";
import { EmployerVerifyToggle } from "@/components/admin/EmployerVerifyToggle";
import { AdminPagination } from "@/components/admin/AdminPagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminEmployersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const verified = sp.verified === "1" ? true : sp.verified === "0" ? false : undefined;
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const { employers, total } = await getAdminEmployers({
    verified,
    q: sp.q,
    limit: ADMIN_PAGE_SIZE,
    offset: (currentPage - 1) * ADMIN_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const tabs: { key: string | undefined; label: string }[] = [
    { key: undefined, label: "Tất cả" },
    { key: "0", label: "Chưa xác minh" },
    { key: "1", label: "Đã xác minh" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-extrabold text-brand-navy">🏢 Nhà tuyển dụng</h1>
        <form action={ROUTES.adminEmployers} method="get" className="flex gap-2">
          {sp.verified && <input type="hidden" name="verified" value={sp.verified} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm theo tên công ty…"
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

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === sp.verified;
          return (
            <Link
              key={tab.label}
              href={`${ROUTES.adminEmployers}${buildQuery(sp, { verified: tab.key, q: sp.q })}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {employers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Không có nhà tuyển dụng nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Công ty</th>
                <th className="px-4 py-3 font-semibold">Liên hệ</th>
                <th className="px-4 py-3 font-semibold">Ngành / Tỉnh</th>
                <th className="px-4 py-3 font-semibold">MST</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {employers.map((e) => (
                <tr key={e.id} className="border-t border-black/5">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-navy">{e.company_name}</div>
                    <div className="text-[11px] text-brand-navy/45">{e.users?.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">{e.contact_phone}</td>
                  <td className="px-4 py-3 text-brand-navy/60">
                    {industryLabel(e.industry) || "—"} · {provinceName(e.province_code)}
                  </td>
                  <td className="px-4 py-3 text-brand-navy/60">{e.tax_code ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.is_verified ? (
                      <StatusPill label="Đã xác minh" tone="green" />
                    ) : (
                      <StatusPill label="Chưa xác minh" tone="amber" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EmployerVerifyToggle employerId={e.id} verified={e.is_verified} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination baseHref={ROUTES.adminEmployers} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
