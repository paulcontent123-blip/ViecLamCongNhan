import { CandidateQuickForm } from "@/components/ungvien/CandidateQuickForm";

export default async function UngVienPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; title?: string; company?: string }>;
}) {
  const sp = await searchParams;
  const hasJobContext = Boolean(sp.job && sp.title);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Ứng viên</div>
        <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Để lại thông tin tìm việc
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-brand-navy/55">
          Điền SĐT + Zalo + tỉnh thành mong muốn ‑ nhà tuyển dụng phù hợp sẽ liên hệ trực tiếp với bạn.
        </p>
      </div>

      {hasJobContext && (
        <div className="mt-6 rounded-xl border border-brand-orange/20 bg-brand-orange-light px-4 py-3 text-[13px]">
          <div className="font-semibold text-brand-orange">Bạn đang ứng tuyển:</div>
          <div className="mt-0.5 font-bold text-brand-navy">{sp.title}</div>
          {sp.company && <div className="text-brand-navy/60">tại {sp.company}</div>}
        </div>
      )}

      <div className="mt-6">
        <CandidateQuickForm jobSlug={sp.job} />
      </div>
    </div>
  );
}
