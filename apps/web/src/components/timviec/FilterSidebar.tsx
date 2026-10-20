import Link from "next/link";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { IndustryFilterSelect } from "@/components/shared/IndustryFilterSelect";

const FILTER_FIELD_KEYS = [
  "q",
  "province",
  "industry",
  "salaryMin",
  "shift",
  "housing",
  "shuttle",
  "meals",
  "noExperience",
] as const;

const salaryOptions = [
  { value: "", label: "Tất cả" },
  { value: "7", label: "Từ 7 triệu" },
  { value: "10", label: "Từ 10 triệu" },
  { value: "15", label: "Từ 15 triệu" },
  { value: "20", label: "Từ 20 triệu" },
];

const shiftOptions = [
  { value: "", label: "Tất cả" },
  { value: "day", label: "Ca ngày" },
  { value: "night", label: "Ca đêm" },
  { value: "rotating", label: "Ca xoay" },
];

export function FilterSidebar({ sp }: { sp: Record<string, string | undefined> }) {
  const hasActiveSidebarFilters = FILTER_FIELD_KEYS.some((k) => sp[k]);

  // Các input dưới đây là uncontrolled (defaultValue/defaultChecked) nên React chỉ
  // đọc giá trị mặc định lúc mount ‑ điều hướng qua Link (không reload trang) đổi sp
  // nhưng KHÔNG tự cập nhật lại DOM input đã mount. Gắn key theo chính các tham số lọc
  // để buộc React remount cả form mỗi khi sp đổi, đảm bảo form luôn khớp URL hiện tại
  // (kể cả khi bấm "Xóa lọc"/"Xóa tất cả bộ lọc" ‑ không còn bị kẹt giá trị cũ).
  const formKey = FILTER_FIELD_KEYS.map((k) => `${k}=${sp[k] ?? ""}`).join("&");

  return (
    <form
      key={formKey}
      action={ROUTES.timViecLam}
      method="get"
      className="h-fit rounded-2xl border border-black/5 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="tab" value="jobs" />
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      {sp.kcnId && <input type="hidden" name="kcnId" value={sp.kcnId} />}
      {sp.urgent && <input type="hidden" name="urgent" value={sp.urgent} />}
      <div className="mb-4 text-[13px] font-extrabold text-brand-navy">🔽 Lọc kết quả</div>

      <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
        Vị trí / Từ khoá
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Công nhân may, lắp ráp..."
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
        Tỉnh / Thành phố
        <select
          name="province"
          defaultValue={sp.province ?? ""}
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        >
          <option value="">Tất cả</option>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
        Ngành nghề
        <IndustryFilterSelect
          name="industry"
          defaultValue={sp.industry ?? ""}
          options={JOB_INDUSTRIES}
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
        Mức lương
        <select
          name="salaryMin"
          defaultValue={sp.salaryMin ?? ""}
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        >
          {salaryOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-4 block text-[12px] font-semibold text-brand-navy/60">
        Ca làm việc
        <select
          name="shift"
          defaultValue={sp.shift ?? ""}
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        >
          {shiftOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-4">
        <div className="mb-2 text-[12px] font-semibold text-brand-navy/60">Phúc lợi</div>
        <div className="flex flex-col gap-2">
          {[
            { name: "housing", label: "Có nhà ở tập thể" },
            { name: "shuttle", label: "Bao xe đưa đón" },
            { name: "meals", label: "Bao bữa ăn" },
            { name: "noExperience", label: "Không cần kinh nghiệm" },
          ].map((c) => (
            <label key={c.name} className="flex cursor-pointer items-center gap-2 text-[13px] text-brand-navy/70">
              <input type="checkbox" name={c.name} value="1" defaultChecked={sp[c.name] === "1"} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-brand-orange py-2.5 text-[13.5px] font-bold text-white shadow-sm transition hover:brightness-105"
      >
        Lọc kết quả
      </button>

      {hasActiveSidebarFilters && (
        <Link
          href={`${ROUTES.timViecLam}?tab=jobs`}
          className="mt-2 block w-full rounded-lg border border-black/10 py-2.5 text-center text-[13px] font-semibold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange"
        >
          ✕ Xóa lọc
        </Link>
      )}
    </form>
  );
}
