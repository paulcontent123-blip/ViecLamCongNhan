import { getAdminArticles } from "@/lib/admin";
import { ArticleManagement } from "@/components/admin/ArticleManagement";

export default async function AdminNewsPage() {
  const articles = await getAdminArticles();
  return <ArticleManagement articles={articles} />;
}
