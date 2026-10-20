import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { PROVINCES } from "@/lib/provinces";
import type { HomeStats } from "@/lib/home-stats";

const salaryOptions = [
  { value: "", label: "Tất cả mức lương" },
  { value: "7", label: "Từ 7 triệu/tháng" },
  { value: "10", label: "Từ 10 triệu/tháng" },
  { value: "15", label: "Từ 15 triệu/tháng" },
  { value: "20", label: "Từ 20 triệu/tháng" },
];

// Trỏ thẳng vào bộ lọc thật của /tim-viec-lam (không còn là chip tĩnh như bản HTML demo cũ).
const hotkeys = [
  { label: "May mặc", query: "industry=may_mac" },
  { label: "Điện tử", query: "industry=dien_tu" },
  { label: "Bốc xếp", query: "industry=kho_van" },
  { label: "Tuyển gấp", query: "urgent=1" },
  { label: "TP. Hồ Chí Minh", query: "province=HCM" },
  { label: "Có nhà ở", query: "housing=1" },
];

export function Hero({ stats }: { stats: HomeStats }) {
  const trustItems = [
    `${stats.approvedJobs.toLocaleString("vi-VN")} tin tuyển dụng`,
    `${stats.employers.toLocaleString("vi-VN")} nhà máy & KCN`,
    `${stats.provinces} tỉnh thành`,
    "Cập nhật hàng ngày",
  ];

  return (
    <div className="bg-gradient-to-b from-brand-orange-light to-white px-4 pb-14 pt-12 sm:px-8 lg:px-[52px]">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-[12px] font-bold text-brand-orange shadow-sm">
            Nền tảng việc làm công nhân · KCN toàn quốc
          </div>
          <h1 className="text-[34px] font-extrabold leading-tight text-brand-navy sm:text-[44px]">
            Tìm việc <em className="text-brand-orange not-italic">công nhân</em>
            <br />
            gần nhà ‑ lương tốt.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-brand-navy/60">
            {stats.approvedJobs.toLocaleString("vi-VN")} tin tuyển dụng từ nhà máy, KCN trên {stats.provinces} tỉnh
            thành. Ứng tuyển ngay không cần lập tài khoản ‑ chỉ cần số điện thoại là xong.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={ROUTES.timViecLam}
              className="rounded-xl bg-brand-orange px-6 py-3.5 text-[14.5px] font-bold text-white shadow-md transition hover:brightness-105"
            >
              🔍 Tìm việc ngay
            </a>
            <a
              href={ROUTES.ungVien}
              className="rounded-xl border-2 border-brand-navy/15 bg-white px-6 py-3.5 text-[14.5px] font-bold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
            >
              📝 Để lại thông tin
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
            {trustItems.map((item) => (
              <span key={item} className="text-[12.5px] font-semibold text-brand-navy/50">
                ✓ {item}
              </span>
            ))}
          </div>
        </div>

        <form
          action={ROUTES.timViecLam}
          method="get"
          className="rounded-2xl border border-black/5 bg-white p-5 shadow-xl"
        >
          <div className="mb-3 text-[14px] font-extrabold text-brand-navy">🔍 Tìm việc làm ngay</div>

          <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
            Vị trí / Ngành nghề
            <input
              name="q"
              placeholder="Công nhân may, lắp ráp, bốc xếp..."
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>

          <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
            Tỉnh / Thành phố
            <select
              name="province"
              defaultValue=""
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            >
              <option value="">-- Chọn tỉnh thành --</option>
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-4 block text-[12px] font-semibold text-brand-navy/60">
            Mức lương mong muốn
            <select
              name="salaryMin"
              defaultValue=""
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            >
              {salaryOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
          >
            🔍 Tìm việc ngay
          </button>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {hotkeys.map((tag) => (
              <Link
                key={tag.label}
                href={`${ROUTES.timViecLam}?${tag.query}`}
                className="rounded-full bg-brand-orange-light px-2.5 py-1 text-[11.5px] font-semibold text-brand-orange transition hover:bg-brand-orange hover:text-white"
              >
                {tag.label}
              </Link>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
