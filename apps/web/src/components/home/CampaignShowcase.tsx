import { getFeaturedCampaigns } from "@/lib/jobs";
import { CampaignGrid } from "@/components/home/CampaignGrid";

export async function CampaignShowcase({ candidatesCount }: { candidatesCount: number }) {
  const campaigns = await getFeaturedCampaigns();

  if (campaigns.length === 0) return null;

  return (
    <div className="bg-black/[0.015] px-4 py-14 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          Chiến dịch tuyển dụng nổi bật
        </div>
        <h2 className="mt-2 max-w-xl text-[24px] font-extrabold text-brand-navy sm:text-[28px]">
          Các công ty đang tuyển <em className="text-brand-orange not-italic">quy mô lớn</em>
        </h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-brand-navy/50">
          Những chiến dịch tuyển dụng hàng trăm công nhân ‑ được ViecLamCongNhan.com triển khai PR chuyên sâu,
          tiếp cận đúng ứng viên trong KCN.
        </p>

        <CampaignGrid campaigns={campaigns} candidatesCount={candidatesCount} />
      </div>
    </div>
  );
}
