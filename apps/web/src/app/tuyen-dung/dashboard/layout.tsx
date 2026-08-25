import { redirect } from "next/navigation";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified } from "@/lib/employer";
import { DashboardSidebar } from "@/components/ntd/DashboardSidebar";
import { EmployerLogoutButton } from "@/components/ntd/EmployerLogoutButton";
import { VerificationBanner } from "@/components/ntd/VerificationBanner";
import { ROUTES } from "@/lib/routes";

export default async function EmployerDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getEmployerSession();
  if (!session) redirect(ROUTES.ntdLogin);

  const verified = await isEmployerVerified(session.employerId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
            Nhà tuyển dụng
          </div>
          <h1 className="mt-1 text-[20px] font-extrabold text-brand-navy">
            {session.companyName}
          </h1>
        </div>
        <EmployerLogoutButton />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr]">
        <DashboardSidebar />
        <div className="min-w-0">
          <VerificationBanner verified={verified} />
          {children}
        </div>
      </div>
    </div>
  );
}
