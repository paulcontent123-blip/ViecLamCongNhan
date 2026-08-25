export function ComingSoonSection({
  icon,
  title,
  description,
  plannedFeatures,
}: {
  icon: string;
  title: string;
  description: string;
  plannedFeatures: string[];
}) {
  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">
        {icon} {title}
      </h1>
      <p className="mb-5 text-[13px] text-brand-navy/50">{description}</p>

      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
        <div className="text-[28px]">🚧</div>
        <div className="mt-2 text-[14px] font-bold text-brand-navy">Chưa kết nối cơ sở dữ liệu</div>
        <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-brand-navy/50">
          Mục này cần thêm bảng dữ liệu trong Supabase (chưa có trong schema hiện tại) — sẽ xây khi có yêu cầu cụ
          thể. Các tính năng dự kiến:
        </p>
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-[12.5px] text-brand-navy/60">
          {plannedFeatures.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-orange">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
