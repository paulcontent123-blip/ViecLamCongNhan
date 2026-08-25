import { getActiveRightCards, RIGHT_CARDS_PAGE_SIZE } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { SectionTabs } from "@/components/tintuc/SectionTabs";
import { RightCardTile } from "@/components/tintuc/RightCardTile";
import { Pagination } from "@/components/timviec/Pagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function QuyenLoiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const { cards, total } = await getActiveRightCards({
    limit: RIGHT_CARDS_PAGE_SIZE,
    offset: (currentPage - 1) * RIGHT_CARDS_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / RIGHT_CARDS_PAGE_SIZE));

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          Tin tức & Quyền lợi công nhân
        </div>
        <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Quyền lợi & <em className="text-brand-orange not-italic">Pháp lý lao động</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] text-brand-navy/50">
          Tra cứu nhanh số liệu pháp luật lao động hiện hành — lương tối thiểu vùng, BHXH, hợp đồng lao động và
          các chế độ khác.
        </p>

        <div className="mt-6">
          <SectionTabs active={ROUTES.quyenLoi} />
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
            Chưa có nội dung quyền lợi nào.
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <RightCardTile key={card.id} card={card} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          sp={sp}
          basePath={ROUTES.quyenLoi}
          extraParams={{}}
        />

        <div className="mt-8 rounded-xl border border-brand-orange/30 bg-brand-orange-light p-4">
          <div className="mb-2 text-[26px]">📞</div>
          <div className="mb-2 text-[14px] font-bold text-brand-orange">Cần tư vấn quyền lợi?</div>
          <div className="text-[12.5px] leading-relaxed text-brand-navy/60">
            Tư vấn miễn phí · Bảo mật thông tin · Kết nối với luật sư lao động VEA Law ·{" "}
            <strong className="text-brand-orange">Hotline: 0767977415</strong> · 8:00 – 18:00 Thứ 2 – Thứ 7
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-navy to-slate-700 p-6">
          <div>
            <h3 className="text-[16px] font-extrabold text-white">📞 Tư vấn miễn phí quyền lợi NLĐ</h3>
            <p className="mt-1 text-[12.5px] text-white/70">
              Luật sư lao động VEA Law sẵn sàng hỗ trợ · 8:00–18:00 Thứ 2 – Thứ 7 · Bảo mật 100%
            </p>
          </div>
          <a
            href="tel:0767977415"
            className="shrink-0 rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white transition hover:brightness-105"
          >
            Gọi ngay 0767977415
          </a>
        </div>
      </div>
    </div>
  );
}
