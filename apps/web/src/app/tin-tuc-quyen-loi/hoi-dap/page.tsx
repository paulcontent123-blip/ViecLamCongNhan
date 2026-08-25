import { getPublishedFaqs } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { SectionTabs } from "@/components/tintuc/SectionTabs";
import { QAAccordionItem } from "@/components/tintuc/QAAccordionItem";
import { QAQuestionForm } from "@/components/tintuc/QAQuestionForm";

export default async function HoiDapPage() {
  const faqs = await getPublishedFaqs();

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      {/* Khung ngoài dùng chung max-w-6xl với 2 trang tab còn lại (Tin tức / Quyền
          lợi) — không co giãn kích thước khi chuyển tab. Nội dung bên trong canh lề
          trái đồng nhất với heading/tab phía trên (không bọc mx-auto căn giữa), khớp
          bố cục trong file .html gốc. */}
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          Tin tức & Quyền lợi công nhân
        </div>
        <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Hỏi & Đáp — <em className="text-brand-orange not-italic">quyền lợi người lao động</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] text-brand-navy/50">
          Câu hỏi thường gặp về pháp luật lao động — hoặc gửi câu hỏi riêng để VEA Law phản hồi trong 24 giờ.
        </p>

        <div className="mt-6">
          <SectionTabs active={ROUTES.hoiDap} />
        </div>

        {faqs.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Hỏi & Đáp</div>
            <h2 className="mt-1.5 text-[22px] font-extrabold leading-tight text-brand-navy">
              Câu hỏi thường gặp
              <br />
              <em className="text-brand-orange not-italic">về quyền lợi NLĐ</em>
            </h2>

            <div className="mb-8 mt-5 space-y-2.5">
              {faqs.map((faq) => (
                <QAAccordionItem key={faq.id} question={faq.question} answer={faq.answer ?? ""} />
              ))}
            </div>

            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-navy to-slate-700 p-6">
              <div>
                <h3 className="text-[16px] font-extrabold text-white">📞 Tư vấn miễn phí quyền lợi NLĐ</h3>
                <p className="mt-1 text-[12.5px] text-white/70">
                  Luật sư lao động VEA Law sẵn sàng hỗ trợ · 8:00–18:00 Thứ 2 – Thứ 7 · Bảo mật 100%
                </p>
              </div>
              <a
                href="tel:18006888"
                className="shrink-0 rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white transition hover:brightness-105"
              >
                Gọi ngay 0767977415
              </a>
            </div>
          </div>
        )}

        <div className="max-w-3xl">
          <div className="mb-3 text-[15px] font-extrabold text-brand-navy">💬 Gửi câu hỏi của bạn</div>
          <QAQuestionForm />
        </div>
      </div>
    </div>
  );
}
