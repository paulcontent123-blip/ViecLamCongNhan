import Link from "next/link";
import { notFound } from "next/navigation";
import { getRightCardBySlug } from "@/lib/content";
import { ROUTES } from "@/lib/routes";

export default async function RightCardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getRightCardBySlug(slug);
  if (!card) notFound();

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-3xl">
        <Link href={ROUTES.quyenLoi} className="text-[12.5px] font-bold text-brand-orange">
          ← Quyền lợi & Pháp lý
        </Link>

        <div className="mt-4 text-[56px]">{card.icon}</div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-brand-navy sm:text-[28px]">
          {card.title}
        </h1>
        {card.effective_note && (
          <div className="mt-2 text-[12.5px] font-semibold text-brand-navy/40">{card.effective_note}</div>
        )}

        <div className="mt-6 whitespace-pre-line text-[14.5px] leading-[1.85] text-brand-navy/75">
          {card.content ?? card.summary}
        </div>

        <div className="mt-8 rounded-xl border border-brand-orange/20 bg-brand-orange-light p-5">
          <div className="text-[13.5px] font-bold text-brand-navy">📞 Cần tư vấn thêm về quyền lợi lao động?</div>
          <p className="mt-1 text-[12.5px] text-brand-navy/55">
            Luật sư lao động VEA Law tư vấn miễn phí, bảo mật 100%.{" "}
            <Link href={ROUTES.hoiDap} className="font-bold text-brand-orange">
              Gửi câu hỏi →
            </Link>{" "}
            hoặc gọi <strong>1800 6888</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
