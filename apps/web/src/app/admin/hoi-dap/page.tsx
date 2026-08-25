import { getAdminQAQuestions, ADMIN_QA_PAGE_SIZE } from "@/lib/admin";
import { QAManagement } from "@/components/admin/QAManagement";
import { ROUTES } from "@/lib/routes";
import { AdminPagination } from "@/components/admin/AdminPagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminQAPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const { questions, total, newCount } = await getAdminQAQuestions({
    limit: ADMIN_QA_PAGE_SIZE,
    offset: (currentPage - 1) * ADMIN_QA_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_QA_PAGE_SIZE));

  return (
    <div>
      <QAManagement questions={questions} total={total} newCount={newCount} />
      <AdminPagination baseHref={ROUTES.adminQA} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
