import { getAdminBlasts } from "@/lib/admin";
import { StatusPill } from "@/components/admin/StatusPill";

const STATUS_LABEL: Record<string, { label: string; tone: "amber" | "green" | "gray" | "red" }> = {
  queued: { label: "Đang chờ", tone: "amber" },
  sending: { label: "Đang gửi", tone: "amber" },
  done: { label: "Hoàn tất", tone: "green" },
  failed: { label: "Thất bại", tone: "red" },
};

const CHANNEL_LABEL: Record<string, string> = { sms: "SMS", zalo: "Zalo OA", combo: "SMS + Zalo" };

export default async function AdminBlastPage() {
  const blasts = await getAdminBlasts();

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">📲 Blast Campaigns</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Lịch sử toàn bộ chiến dịch Blast SMS/Zalo do nhà tuyển dụng gửi trên hệ thống.
      </p>

      {blasts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có chiến dịch Blast nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Chiến dịch</th>
                <th className="px-4 py-3 font-semibold">Nhà tuyển dụng</th>
                <th className="px-4 py-3 font-semibold">Kênh</th>
                <th className="px-4 py-3 font-semibold">Nội dung</th>
                <th className="px-4 py-3 font-semibold">Đối tượng</th>
                <th className="px-4 py-3 font-semibold">Chi phí</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {blasts.map((b) => {
                const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.queued;
                return (
                  <tr key={b.id} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <div className="font-bold text-brand-navy">{b.campaign_name || "—"}</div>
                      <div className="text-[11px] text-brand-navy/40">
                        {new Date(b.created_at).toLocaleString("vi-VN")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">{b.employers?.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-brand-navy/60">{CHANNEL_LABEL[b.channel] ?? b.channel}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-brand-navy/60">{b.message}</td>
                    <td className="px-4 py-3 font-mono text-brand-navy/60">
                      {b.recipient_count?.toLocaleString("vi-VN") ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-brand-orange">
                      {b.cost_vnd ? `${b.cost_vnd.toLocaleString("vi-VN")}đ` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={st.label} tone={st.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
