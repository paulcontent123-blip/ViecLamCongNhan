const TONE_CLASS: Record<"amber" | "green" | "red" | "gray" | "blue", string> = {
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  gray: "bg-black/5 text-brand-navy/50",
  blue: "bg-sky-50 text-sky-700",
};

export function StatusPill({ label, tone }: { label: string; tone: keyof typeof TONE_CLASS }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}
