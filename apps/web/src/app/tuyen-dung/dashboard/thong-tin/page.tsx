import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerProfile } from "@/lib/employer";
import { ProfileForm } from "@/components/ntd/ProfileForm";

export default async function EmployerProfilePage() {
  const session = await getEmployerSession();
  if (!session) return null;

  const profile = await getEmployerProfile(session.employerId);
  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
        Không tải được thông tin tài khoản.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-[15px] font-extrabold text-brand-navy">🧾 Thông tin tài khoản</h2>
      <ProfileForm profile={profile} />
    </div>
  );
}
