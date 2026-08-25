const factoryPartners = [
  "🏭 Samsung VN",
  "🏭 Canon VN",
  "🏭 Foxconn",
  "🏭 LG Electronics",
  "🏭 Pouyuen",
  "🏭 Panasonic",
  "🏭 Hyosung",
  "🏭 Hansae VN",
  "🏭 Jabil VN",
  "🏭 Intel Products VN",
];

const servicePartners = [
  { label: "🛡 FWD Bảo hiểm", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { label: "🛡 Prudential VN", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { label: "🛡 Bảo Việt", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { label: "📱 MoMo", className: "bg-violet-50 border-violet-200 text-violet-700" },
  { label: "💬 ZaloPay", className: "bg-violet-50 border-violet-200 text-violet-700" },
  { label: "💵 Tima.vn", className: "bg-brand-orange-light border-brand-orange/20 text-brand-orange" },
  { label: "💵 MCredit", className: "bg-brand-orange-light border-brand-orange/20 text-brand-orange" },
  { label: "🏛 BHXH Tự nguyện", className: "bg-amber-50 border-amber-200 text-amber-700" },
  { label: "⚖ VEA Law", className: "bg-sky-50 border-sky-200 text-sky-700" },
];

function Pill({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-bold ${
        className || "border-brand-orange/20 bg-brand-orange-light text-brand-orange"
      }`}
    >
      {label}
    </div>
  );
}

export function PartnerMarquee() {
  // Ghép [...list, ...list] để 2 nửa giống hệt nhau → animation translateX(-50%)
  // luôn khớp nối liền mạch, không bị giật ở điểm nối (khác bản HTML demo cũ,
  // nơi số lượng phần tử lặp lại không khớp số gốc).
  const row1 = [...factoryPartners, ...factoryPartners];
  const row2 = [...servicePartners, ...servicePartners];

  return (
    <div className="mb-3 space-y-3">
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="animate-marquee flex w-max gap-3">
          {row1.map((label, i) => (
            <Pill key={`${label}-${i}`} label={label} />
          ))}
        </div>
      </div>
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="animate-marquee-reverse flex w-max gap-3">
          {row2.map((p, i) => (
            <Pill key={`${p.label}-${i}`} label={p.label} className={p.className} />
          ))}
        </div>
      </div>
    </div>
  );
}
