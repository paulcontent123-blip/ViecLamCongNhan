import { PostJobForm } from "@/components/ntd/PostJobForm";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified, getEmployerAccountTier, countJobsPostedToday } from "@/lib/employer";
import { getKcnList } from "@/lib/kcn";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";

export default async function PostJobPage() {
  const session = await getEmployerSession();
  const verified = session ? await isEmployerVerified(session.employerId) : false;
  const accountTier = session ? await getEmployerAccountTier(session.employerId) : "free";
  const postedToday = session ? await countJobsPostedToday(session.employerId) : 0;
  const kcnList = await getKcnList();

  return (
    <div>
      <h2 className="mb-4 text-[15px] font-extrabold text-brand-navy">📋 Đăng tin tuyển dụng mới</h2>
      <PostJobForm
        verified={verified}
        accountTier={accountTier}
        dailyPostLimit={ACCOUNT_TIERS[accountTier].dailyPostLimit}
        postedToday={postedToday}
        kcnList={kcnList}
      />
    </div>
  );
}
